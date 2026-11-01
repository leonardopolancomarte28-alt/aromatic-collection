const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar todos los vendedores con sus métricas
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const vendedores = db.prepare(`
    SELECT 
      u.id, u.nombre, u.email, u.telefono, u.activo, u.created_at,
      COUNT(p.id) as total_pedidos,
      COALESCE(SUM(CASE WHEN p.estado = 'ENTREGADO' THEN 1 ELSE 0 END), 0) as pedidos_entregados,
      COALESCE(SUM(p.precio_venta_total), 0) as volumen_ventas,
      COALESCE(SUM(CASE WHEN c.estado = 'PENDIENTE' THEN c.monto_comision ELSE 0 END), 0) as comisiones_pendientes,
      COALESCE(SUM(CASE WHEN c.estado = 'GANADA' THEN c.monto_comision ELSE 0 END), 0) as comisiones_por_pagar,
      COALESCE(SUM(CASE WHEN c.estado = 'PAGADA' THEN c.monto_comision ELSE 0 END), 0) as comisiones_pagadas
    FROM usuarios u
    LEFT JOIN pedidos p ON p.vendedor_id = u.id AND p.estado != 'CANCELADO'
    LEFT JOIN comisiones c ON c.pedido_id = p.id
    WHERE u.rol = 'VENDEDOR'
    GROUP BY u.id
    ORDER BY u.nombre ASC
  `).all();

  res.json({ vendedores });
});

// Registrar nuevo vendedor
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { nombre, email, password, telefono } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo electrónico y contraseña son campos obligatorios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (existing) {
    return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo electrónico.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = 'USR-VEND-' + Date.now().toString(36).toUpperCase();

  db.prepare(`
    INSERT INTO usuarios (id, nombre, email, password_hash, rol, telefono, activo)
    VALUES (?, ?, ?, ?, 'VENDEDOR', ?, 1)
  `).run(id, nombre.trim(), email.trim(), passwordHash, telefono ? telefono.trim() : null);

  logAudit({
    tabla: 'usuarios',
    registroId: id,
    accion: 'CREAR',
    usuarioId: req.user.id,
    valoresNuevos: { nombre, email, telefono, rol: 'VENDEDOR' },
    detalles: `Registro de nuevo vendedor: ${nombre}`
  });

  res.status(201).json({ message: 'Vendedor creado satisfactoriamente.' });
});

// Actualizar datos y/o restablecer contraseña de un vendedor
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { nombre, email, telefono, password } = req.body;
  const db = getDb();

  const vendedor = db.prepare("SELECT * FROM usuarios WHERE id = ? AND rol = 'VENDEDOR'").get(req.params.id);
  if (!vendedor) {
    return res.status(404).json({ error: 'Vendedor no encontrado.' });
  }

  if (!nombre || !email) {
    return res.status(400).json({ error: 'El nombre y el correo electrónico son obligatorios.' });
  }

  const existing = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?').get(email.trim(), vendedor.id);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe otro usuario registrado con este correo electrónico.' });
  }

  let newHash = vendedor.password_hash;
  let passwordCambiado = false;
  if (password && password.trim()) {
    if (password.trim().length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    newHash = await bcrypt.hash(password.trim(), 10);
    passwordCambiado = true;
  }

  db.prepare(`
    UPDATE usuarios
    SET nombre = ?, email = ?, telefono = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nombre.trim(), email.trim(), telefono ? telefono.trim() : null, newHash, vendedor.id);

  logAudit({
    tabla: 'usuarios',
    registroId: vendedor.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: `Vendedor ${nombre} actualizado por admin${passwordCambiado ? ' (contraseña restablecida)' : ''}`
  });

  res.json({
    message: `Vendedor actualizado con éxito${passwordCambiado ? ' y contraseña restablecida' : ''}.`
  });
});

// Activar / Desactivar cuenta de vendedor
router.put('/:id/toggle-activo', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare("SELECT id, nombre, activo FROM usuarios WHERE id = ? AND rol = 'VENDEDOR'").get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Vendedor no encontrado.' });
  }

  const nuevoEstado = user.activo ? 0 : 1;
  db.prepare('UPDATE usuarios SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoEstado, user.id);

  logAudit({
    tabla: 'usuarios',
    registroId: user.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: `Cambio de estado activo de ${user.nombre} a ${nuevoEstado === 1 ? 'ACTIVO' : 'INACTIVO'}`
  });

  res.json({
    message: `Vendedor ${nuevoEstado === 1 ? 'activado' : 'desactivado'} correctamente.`,
    activo: nuevoEstado === 1
  });
});

module.exports = router;
