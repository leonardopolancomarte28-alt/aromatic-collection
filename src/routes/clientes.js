const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar clientes con búsqueda y totales consolidados
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const search = req.query.q ? `%${req.query.q.trim()}%` : null;

  let query = `
    SELECT 
      c.id, c.nombre, c.telefono, c.direccion, c.notas, c.created_at,
      u.nombre as registrado_por_nombre,
      COUNT(p.id) as total_pedidos,
      COALESCE(SUM(p.precio_venta_total), 0) as total_comprado,
      COALESCE(SUM(p.total_cobrado), 0) as total_pagado,
      COALESCE(SUM(p.balance_pendiente), 0) as balance_pendiente
    FROM clientes c
    LEFT JOIN usuarios u ON u.id = c.created_by
    LEFT JOIN pedidos p ON p.cliente_id = c.id AND p.estado != 'CANCELADO'
  `;

  const params = [];
  if (search) {
    query += ` WHERE c.nombre LIKE ? OR c.telefono LIKE ? `;
    params.push(search, search);
  }

  query += ` GROUP BY c.id ORDER BY c.nombre ASC `;

  const clientes = db.prepare(query).all(...params);
  res.json({ clientes });
});

// Detalle de un cliente con historial completo de pedidos
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado.' });
  }

  const pedidos = db.prepare(`
    SELECT 
      p.id, p.codigo_pedido, p.perfume_nombre, p.cantidad, p.precio_venta_total, 
      p.estado, p.estado_pago, p.total_cobrado, p.balance_pendiente, p.created_at,
      u.nombre as vendedor_nombre
    FROM pedidos p
    JOIN usuarios u ON u.id = p.vendedor_id
    WHERE p.cliente_id = ?
    ORDER BY p.created_at DESC
  `).all(cliente.id);

  res.json({ cliente, pedidos });
});

// Registrar nuevo cliente
router.post('/', authenticateToken, (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;

  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'El nombre y el teléfono del cliente son campos obligatorios.' });
  }

  const db = getDb();
  const id = 'CLI-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  db.prepare(`
    INSERT INTO clientes (id, nombre, telefono, direccion, notas, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, nombre.trim(), telefono.trim(), direccion ? direccion.trim() : null, notas ? notas.trim() : null, req.user.id);

  logAudit({
    tabla: 'clientes',
    registroId: id,
    accion: 'CREAR',
    usuarioId: req.user.id,
    valoresNuevos: { nombre, telefono, direccion, notas },
    detalles: `Registro de cliente: ${nombre}`
  });

  const nuevoCliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  res.status(201).json({ message: 'Cliente registrado con éxito', cliente: nuevoCliente });
});

// Actualizar datos del cliente
router.put('/:id', authenticateToken, (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;
  const db = getDb();

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado.' });
  }

  db.prepare(`
    UPDATE clientes 
    SET nombre = ?, telefono = ?, direccion = ?, notas = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nombre ? nombre.trim() : cliente.nombre,
    telefono ? telefono.trim() : cliente.telefono,
    direccion !== undefined ? direccion : cliente.direccion,
    notas !== undefined ? notas : cliente.notas,
    req.params.id
  );

  logAudit({
    tabla: 'clientes',
    registroId: req.params.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    valoresAnteriores: cliente,
    valoresNuevos: { nombre, telefono, direccion, notas },
    detalles: `Actualización de datos de cliente ${req.params.id}`
  });

  res.json({ message: 'Cliente actualizado correctamente.' });
});

module.exports = router;
