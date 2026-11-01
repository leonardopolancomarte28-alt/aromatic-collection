const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar proveedores
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const proveedores = db.prepare(`
    SELECT p.*, 
      COUNT(DISTINCT pa.id) as paquetes_recibidos,
      COUNT(DISTINCT ped.id) as total_pedidos_asociados
    FROM proveedores p
    LEFT JOIN paquetes pa ON pa.proveedor_id = p.id
    LEFT JOIN pedidos ped ON ped.proveedor_id = p.id
    GROUP BY p.id
    ORDER BY p.nombre ASC
  `).all();
  res.json({ proveedores });
});

// Registrar nuevo proveedor
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { nombre, contacto, telefono, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
  }

  const db = getDb();
  const id = 'PRV-' + Date.now().toString(36).toUpperCase();

  db.prepare(`
    INSERT INTO proveedores (id, nombre, contacto, telefono, direccion, activo)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, nombre.trim(), contacto ? contacto.trim() : null, telefono ? telefono.trim() : null, direccion ? direccion.trim() : null);

  logAudit({
    tabla: 'proveedores',
    registroId: id,
    accion: 'CREAR',
    usuarioId: req.user.id,
    detalles: `Registro de proveedor: ${nombre}`
  });

  res.status(201).json({ message: 'Proveedor registrado satisfactoriamente.' });
});

// Actualizar proveedor
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { nombre, contacto, telefono, direccion, activo } = req.body;
  const db = getDb();

  const prov = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(req.params.id);
  if (!prov) {
    return res.status(404).json({ error: 'Proveedor no encontrado.' });
  }

  db.prepare(`
    UPDATE proveedores
    SET nombre = ?, contacto = ?, telefono = ?, direccion = ?, activo = ?
    WHERE id = ?
  `).run(
    nombre ? nombre.trim() : prov.nombre,
    contacto !== undefined ? contacto : prov.contacto,
    telefono !== undefined ? telefono : prov.telefono,
    direccion !== undefined ? direccion : prov.direccion,
    activo !== undefined ? (activo ? 1 : 0) : prov.activo,
    req.params.id
  );

  res.json({ message: 'Proveedor actualizado correctamente.' });
});

module.exports = router;
