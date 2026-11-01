const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/metrics', authenticateToken, (req, res) => {
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';
  const userId = req.user.id;

  if (isAdmin) {
    // 1. Conteo de pedidos por estado
    const pedidosPorEstado = db.prepare(`
      SELECT estado, COUNT(*) as cantidad, SUM(precio_venta_total) as volumen_ventas
      FROM pedidos
      GROUP BY estado
    `).all();

    // 2. Métricas de cobro y saldo
    const totalesPedidos = db.prepare(`
      SELECT 
        COUNT(*) as total_pedidos,
        COALESCE(SUM(precio_venta_total), 0) as total_ventas,
        COALESCE(SUM(total_cobrado), 0) as dinero_cobrado,
        COALESCE(SUM(balance_pendiente), 0) as dinero_pendiente,
        COALESCE(SUM(CASE WHEN balance_pendiente > 0 AND estado != 'CANCELADO' THEN 1 ELSE 0 END), 0) as pedidos_pendientes_cobro
      FROM pedidos
      WHERE estado != 'CANCELADO'
    `).get();

    // 3. Ganancia neta real generada (solo pedidos entregados y pagados con margen)
    const ganancias = db.prepare(`
      SELECT 
        COALESCE(SUM(ganancia_negocio), 0) as ganancia_total_entregada,
        COALESCE(SUM(margen_directo), 0) as margen_directo_total
      FROM pedidos
      WHERE estado = 'ENTREGADO'
    `).get();

    // 4. Comisiones
    const comisiones = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto_comision ELSE 0 END), 0) as comisiones_pendientes,
        COALESCE(SUM(CASE WHEN estado = 'GANADA' THEN monto_comision ELSE 0 END), 0) as comisiones_ganadas_por_pagar,
        COALESCE(SUM(CASE WHEN estado = 'PAGADA' THEN monto_comision ELSE 0 END), 0) as comisiones_pagadas
      FROM comisiones
      WHERE estado != 'ANULADA'
    `).get();

    // 5. Movimientos reales de caja
    const caja = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN monto ELSE 0 END), 0) as total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN monto ELSE 0 END), 0) as total_salidas,
        COALESCE(SUM(CASE WHEN tipo = 'SALIDA' AND categoria = 'GASTO_OPERATIVO' THEN monto ELSE 0 END), 0) as gastos_operativos,
        COALESCE(SUM(CASE WHEN tipo = 'SALIDA' AND categoria = 'FLETE_PAQUETE' THEN monto ELSE 0 END), 0) as fletes_totales,
        COALESCE(SUM(CASE WHEN tipo = 'SALIDA' AND categoria = 'GASOLINA_RUTA' THEN monto ELSE 0 END), 0) as gasolina_total
      FROM movimientos_caja
    `).get();

    const balanceCajaActual = Number((caja.total_entradas - caja.total_salidas).toFixed(2));

    // 6. Rendimiento de vendedores
    const rendimientoVendedores = db.prepare(`
      SELECT 
        u.id, 
        u.nombre, 
        u.email, 
        u.telefono,
        u.activo,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(CASE WHEN p.estado = 'ENTREGADO' THEN 1 ELSE 0 END), 0) as pedidos_entregados,
        COALESCE(SUM(p.precio_venta_total), 0) as volumen_ventas,
        COALESCE(SUM(CASE WHEN c.estado = 'GANADA' OR c.estado = 'PAGADA' THEN c.monto_comision ELSE 0 END), 0) as comisiones_generadas
      FROM usuarios u
      LEFT JOIN pedidos p ON p.vendedor_id = u.id AND p.estado != 'CANCELADO'
      LEFT JOIN comisiones c ON c.pedido_id = p.id
      WHERE u.rol = 'VENDEDOR'
      GROUP BY u.id
      ORDER BY volumen_ventas DESC
    `).all();

    // 7. Pedidos recientes para tabla rápida
    const pedidosRecientes = db.prepare(`
      SELECT 
        p.id, p.codigo_pedido, p.perfume_nombre, p.cantidad, p.precio_venta_total, 
        p.estado, p.estado_pago, p.total_cobrado, p.balance_pendiente, p.created_at,
        c.nombre as cliente_nombre,
        u.nombre as vendedor_nombre
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN usuarios u ON u.id = p.vendedor_id
      ORDER BY p.created_at DESC
      LIMIT 6
    `).all();

    return res.json({
      rol: 'ADMIN',
      totalesPedidos,
      pedidosPorEstado,
      ganancias,
      comisiones,
      caja: {
        ...caja,
        balanceActual: balanceCajaActual
      },
      rendimientoVendedores,
      pedidosRecientes
    });
  } else {
    // VISTA VENDEDOR: Estrictamente filtrada para su propia cartera
    const vendedorPedidos = db.prepare(`
      SELECT 
        COUNT(*) as total_pedidos,
        COALESCE(SUM(CASE WHEN estado = 'ENTREGADO' THEN 1 ELSE 0 END), 0) as pedidos_entregados,
        COALESCE(SUM(CASE WHEN estado != 'ENTREGADO' AND estado != 'CANCELADO' THEN 1 ELSE 0 END), 0) as pedidos_en_proceso,
        COALESCE(SUM(precio_venta_total), 0) as total_ventas,
        COALESCE(SUM(total_cobrado), 0) as dinero_cobrado,
        COALESCE(SUM(balance_pendiente), 0) as balance_pendiente_clientes
      FROM pedidos
      WHERE vendedor_id = ? AND estado != 'CANCELADO'
    `).get(userId);

    const comisionesVendedor = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto_comision ELSE 0 END), 0) as comisiones_pendientes,
        COALESCE(SUM(CASE WHEN estado = 'GANADA' THEN monto_comision ELSE 0 END), 0) as comisiones_por_cobrar,
        COALESCE(SUM(CASE WHEN estado = 'PAGADA' THEN monto_comision ELSE 0 END), 0) as comisiones_cobradas
      FROM comisiones
      WHERE vendedor_id = ? AND estado != 'ANULADA'
    `).get(userId);

    const misPedidosRecientes = db.prepare(`
      SELECT 
        p.id, p.codigo_pedido, p.perfume_nombre, p.cantidad, p.precio_venta_total, 
        p.estado, p.estado_pago, p.total_cobrado, p.balance_pendiente, p.created_at,
        c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.vendedor_id = ?
      ORDER BY p.created_at DESC
      LIMIT 8
    `).all(userId);

    return res.json({
      rol: 'VENDEDOR',
      resumen: vendedorPedidos,
      comisiones: comisionesVendedor,
      pedidosRecientes: misPedidosRecientes
    });
  }
});

module.exports = router;
