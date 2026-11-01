const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Todos los endpoints de caja son estrictamente para ADMINISTRADORES
router.use(authenticateToken, requireAdmin);

// 1. Listar movimientos reales de caja
router.get('/movimientos', (req, res) => {
  const db = getDb();
  const { tipo, categoria, limit = 100 } = req.query;

  let query = `
    SELECT m.*, u.nombre as registrado_por_nombre
    FROM movimientos_caja m
    LEFT JOIN usuarios u ON u.id = m.registrado_por
    WHERE 1=1
  `;
  const params = [];

  if (tipo) {
    query += ` AND m.tipo = ? `;
    params.push(tipo);
  }

  if (categoria) {
    query += ` AND m.categoria = ? `;
    params.push(categoria);
  }

  query += ` ORDER BY m.fecha DESC LIMIT ? `;
  params.push(parseInt(limit));

  const movimientos = db.prepare(query).all(...params);

  // Totales de entradas, salidas y balance
  const totales = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN monto ELSE 0 END), 0) as total_entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN monto ELSE 0 END), 0) as total_salidas
    FROM movimientos_caja
  `).get();

  const balanceActual = Number((totales.total_entradas - totales.total_salidas).toFixed(2));

  res.json({
    movimientos,
    totales: {
      totalEntradas: totales.total_entradas,
      totalSalidas: totales.total_salidas,
      balanceActual
    }
  });
});

// 2. Registrar movimiento manual de caja (Gastos operativos, ajustes, etc.)
router.post('/movimientos', (req, res) => {
  const { tipo, categoria, monto, metodo_pago, descripcion } = req.body;
  const montoNum = Number(monto);

  if (!tipo || !['ENTRADA', 'SALIDA'].includes(tipo)) {
    return res.status(400).json({ error: "El tipo debe ser 'ENTRADA' o 'SALIDA'." });
  }

  if (!montoNum || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
  }

  if (!descripcion || !descripcion.trim()) {
    return res.status(400).json({ error: 'Debes proporcionar una descripción o concepto del movimiento.' });
  }

  const db = getDb();
  const id = 'MOV-MAN-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  db.prepare(`
    INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, descripcion, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tipo,
    categoria || (tipo === 'ENTRADA' ? 'AJUSTE_CAJA' : 'GASTO_OPERATIVO'),
    montoNum,
    metodo_pago || 'EFECTIVO',
    descripcion.trim(),
    req.user.id
  );

  logAudit({
    tabla: 'movimientos_caja',
    registroId: id,
    accion: 'CREAR',
    usuarioId: req.user.id,
    detalles: `Movimiento manual de caja: ${tipo} de RD$${montoNum} (${descripcion.trim()})`
  });

  res.status(201).json({ message: 'Movimiento registrado en caja con éxito.' });
});

// 3. Vista Comparativa: Flujo de Caja Real vs Rentabilidad Analítica
router.get('/comparativa', (req, res) => {
  const db = getDb();

  // A. Movimientos de Caja (Efectivo Real)
  const flujoCaja = db.prepare(`
    SELECT 
      categoria,
      tipo,
      COUNT(*) as conteo,
      SUM(monto) as total
    FROM movimientos_caja
    GROUP BY categoria, tipo
  `).all();

  const totalCobradoEnCaja = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_caja WHERE categoria = 'COBRO_CLIENTE'
  `).get().total;

  const totalProveedoresPagado = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_caja WHERE categoria = 'PAGO_PROVEEDOR'
  `).get().total;

  const totalFletesPagados = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_caja WHERE categoria = 'FLETE_PAQUETE'
  `).get().total;

  const totalGasolinaPagada = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_caja WHERE categoria = 'GASOLINA_RUTA'
  `).get().total;

  const totalComisionesPagadas = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_caja WHERE categoria = 'PAGO_COMISION'
  `).get().total;

  // B. Rentabilidad Devengada por Pedidos (Costos Directos Asignados)
  const analisisPedidos = db.prepare(`
    SELECT 
      COUNT(*) as total_pedidos,
      COALESCE(SUM(precio_venta_total), 0) as precio_venta_total,
      COALESCE(SUM(costo_compra_perfume), 0) as costo_compra_asignado_total,
      COALESCE(SUM(costo_envio_asignado), 0) as envio_asignado_total,
      COALESCE(SUM(costo_gasolina_asignado), 0) as gasolina_asignada_total,
      COALESCE(SUM(margen_directo), 0) as margen_directo_total,
      COALESCE(SUM(ganancia_negocio), 0) as ganancia_negocio_total
    FROM pedidos
    WHERE estado != 'CANCELADO'
  `).get();

  res.json({
    flujoCajaReal: {
      cobradoClientes: totalCobradoEnCaja,
      pagadoProveedores: totalProveedoresPagado,
      pagadoFletes: totalFletesPagados,
      pagadoGasolina: totalGasolinaPagada,
      pagadoComisiones: totalComisionesPagadas,
      desglose: flujoCaja
    },
    rentabilidadAnaliticaPedidos: analisisPedidos,
    principioNoDuplicidad: {
      fletesEnCaja: totalFletesPagados,
      fletesAsignadosEnPedidos: analisisPedidos.envio_asignado_total,
      gasolinaEnCaja: totalGasolinaPagada,
      gasolinaAsignadaEnPedidos: analisisPedidos.gasolina_asignada_total,
      explicacion: "Los fletes y gasolina registrados en Caja representan las salidas reales de dinero. Su desglose individual en cada pedido es un cálculo proporcional de rentabilidad que NO genera cargos dobles al negocio."
    }
  });
});

module.exports = router;
