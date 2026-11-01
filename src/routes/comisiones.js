const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

// Listar comisiones
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';
  const { estado, vendedor_id } = req.query;

  let query = `
    SELECT 
      c.*,
      p.codigo_pedido, p.perfume_nombre, p.precio_venta_total, p.estado as pedido_estado,
      p.total_cobrado, p.balance_pendiente, p.costo_compra_perfume, p.costo_envio_asignado, p.costo_gasolina_asignado,
      u.nombre as vendedor_nombre, u.email as vendedor_email, u.telefono as vendedor_telefono,
      cli.nombre as cliente_nombre
    FROM comisiones c
    JOIN pedidos p ON p.id = c.pedido_id
    JOIN usuarios u ON u.id = c.vendedor_id
    JOIN clientes cli ON cli.id = p.cliente_id
    WHERE 1=1
  `;

  const params = [];

  // Vendedor solo ve sus propias comisiones
  if (!isAdmin) {
    query += ` AND c.vendedor_id = ? `;
    params.push(req.user.id);
  } else if (vendedor_id) {
    query += ` AND c.vendedor_id = ? `;
    params.push(vendedor_id);
  }

  if (estado) {
    query += ` AND c.estado = ? `;
    params.push(estado);
  }

  query += ` ORDER BY c.created_at DESC `;

  const comisiones = db.prepare(query).all(...params);

  // Sanitizar si es vendedor (no ver costo_compra_perfume si viene incluido)
  const resultado = comisiones.map(c => {
    if (!isAdmin) {
      const { costo_compra_perfume, ...safe } = c;
      return safe;
    }
    return c;
  });

  res.json({ comisiones: resultado });
});

// Pagar comisión al vendedor (Solo Administrador)
router.post('/:id/pagar', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const comision = db.prepare(`
    SELECT c.*, p.codigo_pedido, u.nombre as vendedor_nombre
    FROM comisiones c
    JOIN pedidos p ON p.id = c.pedido_id
    JOIN usuarios u ON u.id = c.vendedor_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!comision) {
    return res.status(404).json({ error: 'Registro de comisión no encontrado.' });
  }

  if (comision.estado !== 'GANADA') {
    return res.status(400).json({
      error: `Solo se pueden desembolsar comisiones en estado 'GANADA'. Estado actual: '${comision.estado}'.`
    });
  }

  const pagarComisionTx = db.transaction(() => {
    // 1. Salida física de dinero de CAJA
    const movId = 'MOV-COM-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
      VALUES (?, 'SALIDA', 'PAGO_COMISION', ?, 'TRANSFERENCIA', ?, ?, ?)
    `).run(
      movId,
      comision.monto_comision,
      comision.id,
      `Pago de comisión a ${comision.vendedor_nombre} por pedido ${comision.codigo_pedido} (30% sobre margen)`,
      req.user.id
    );

    // 2. Actualizar estado de comisión a PAGADA
    db.prepare(`
      UPDATE comisiones
      SET estado = 'PAGADA',
          fecha_pagada = CURRENT_TIMESTAMP,
          caja_movimiento_id = ?
      WHERE id = ?
    `).run(movId, comision.id);
  });

  pagarComisionTx();

  logAudit({
    tabla: 'comisiones',
    registroId: comision.id,
    accion: 'LIQUIDACION',
    usuarioId: req.user.id,
    detalles: `Comisión de RD$${comision.monto_comision} pagada a ${comision.vendedor_nombre}`
  });

  res.json({
    message: `Comisión de RD$${comision.monto_comision.toFixed(2)} liquidada y registrada como salida de caja.`
  });
});

module.exports = router;
