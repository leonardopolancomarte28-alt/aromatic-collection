const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const BusinessCalculations = require('../services/calculations');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Registrar pago (adelanto, cuota final o abono)
router.post('/', authenticateToken, (req, res) => {
  const { pedido_id, monto, metodo_pago, tipo, notas } = req.body;
  const pagoMonto = Number(monto);

  if (!pedido_id || !pagoMonto || pagoMonto <= 0) {
    return res.status(400).json({ error: 'Debes especificar el pedido y un monto válido mayor a cero.' });
  }

  const db = getDb();
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedido_id);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }

  if (pedido.estado === 'CANCELADO') {
    return res.status(400).json({ error: 'No se pueden registrar pagos a un pedido cancelado.' });
  }

  if (pagoMonto > pedido.balance_pendiente) {
    return res.status(400).json({
      error: `El monto ingresado (RD$${pagoMonto.toFixed(2)}) supera el balance pendiente de este pedido (RD$${pedido.balance_pendiente.toFixed(2)}).`
    });
  }

  const nuevoTotalCobrado = Number((pedido.total_cobrado + pagoMonto).toFixed(2));
  const nuevoBalance = Number((pedido.precio_venta_total - nuevoTotalCobrado).toFixed(2));
  const nuevoEstadoPago = nuevoBalance <= 0 ? 'PAGADO' : 'PARCIAL';

  const pagoId = 'PAG-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  const registrarPagoTx = db.transaction(() => {
    // 1. Insertar registro en tabla pagos
    db.prepare(`
      INSERT INTO pagos (id, pedido_id, monto, metodo_pago, tipo, notas, registrado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      pagoId,
      pedido.id,
      pagoMonto,
      metodo_pago || 'EFECTIVO',
      tipo || (nuevoBalance <= 0 ? 'PAGO_FINAL' : 'ABONO'),
      notas ? notas.trim() : null,
      req.user.id
    );

    // 2. Registrar entrada en CAJA real
    db.prepare(`
      INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
      VALUES (?, 'ENTRADA', 'COBRO_CLIENTE', ?, ?, ?, ?, ?)
    `).run(
      'MOV-' + pagoId,
      pagoMonto,
      metodo_pago || 'EFECTIVO',
      pedido.id,
      `Cobro ${tipo || 'pago'} de pedido ${pedido.codigo_pedido} (${pedido.perfume_nombre})`,
      req.user.id
    );

    // 3. Actualizar balance en pedidos
    db.prepare(`
      UPDATE pedidos
      SET total_cobrado = ?,
          balance_pendiente = ?,
          estado_pago = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nuevoTotalCobrado, nuevoBalance, nuevoEstadoPago, pedido.id);

    // 4. Evaluar si la comisión se desbloquea:
    // Si el pedido YA está ENTREGADO y ahora nuevoBalance === 0, pasa a GANADA!
    const evaluacionComision = BusinessCalculations.evaluarElegibilidadComision(pedido.estado, nuevoBalance);

    db.prepare(`
      UPDATE comisiones
      SET estado = ?,
          fecha_generada = CASE WHEN ? = 'GANADA' AND fecha_generada IS NULL THEN CURRENT_TIMESTAMP ELSE fecha_generada END
      WHERE pedido_id = ?
    `).run(evaluacionComision.estadoComision, evaluacionComision.estadoComision, pedido.id);
  });

  registrarPagoTx();

  logAudit({
    tabla: 'pagos',
    registroId: pagoId,
    accion: 'PAGO',
    usuarioId: req.user.id,
    valoresNuevos: { monto: pagoMonto, metodo_pago, nuevoBalance, nuevoEstadoPago },
    detalles: `Pago de RD$${pagoMonto} registrado para pedido ${pedido.codigo_pedido}. Balance restante: RD$${nuevoBalance}`
  });

  res.status(201).json({
    message: 'Pago registrado exitosamente.',
    nuevoTotalCobrado,
    nuevoBalance,
    nuevoEstadoPago
  });
});

module.exports = router;
