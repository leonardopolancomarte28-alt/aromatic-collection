const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

// Obtener todas las configuraciones
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const configs = db.prepare('SELECT clave, valor, descripcion FROM configuracion').all();
  const configMap = {};
  configs.forEach(c => {
    configMap[c.clave] = c.valor;
  });
  res.json({ configuraciones: configMap, lista: configs });
});

// Actualizar configuración (Solo Administrador)
router.put('/', authenticateToken, requireAdmin, (req, res) => {
  const { comision_porcentaje_default, nombre_negocio } = req.body;
  const db = getDb();

  const updates = [];

  if (comision_porcentaje_default !== undefined) {
    const pct = parseFloat(comision_porcentaje_default);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'El porcentaje de comisión debe ser un número entre 0 y 100.' });
    }
    db.prepare("UPDATE configuracion SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE clave = 'comision_porcentaje_default'").run(String(pct));
    updates.push(`Comisión por defecto: ${pct}%`);
  }

  if (nombre_negocio !== undefined && nombre_negocio.trim()) {
    db.prepare("UPDATE configuracion SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE clave = 'nombre_negocio'").run(nombre_negocio.trim());
    updates.push(`Nombre de negocio: ${nombre_negocio.trim()}`);
  }

  logAudit({
    tabla: 'configuracion',
    registroId: 'SISTEMA',
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: updates.join(', ')
  });

  res.json({ message: 'Configuraciones actualizadas con éxito.' });
});

// Copia de seguridad en JSON completo (Backup instantáneo)
router.get('/backup', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const tables = ['usuarios', 'clientes', 'proveedores', 'paquetes', 'rutas_entrega', 'pedidos', 'pagos', 'comisiones', 'movimientos_caja', 'audit_logs', 'configuracion'];

  const backupData = {
    fechaBackup: new Date().toISOString(),
    generadoPor: req.user.email,
    tablas: {}
  };

  for (const table of tables) {
    backupData.tablas[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }

  logAudit({
    tabla: 'sistema',
    registroId: 'BACKUP',
    accion: 'CREAR',
    usuarioId: req.user.id,
    detalles: 'Copia de seguridad del sistema descargada'
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-perfumes-${new Date().toISOString().split('T')[0]}.json"`);
  res.send(JSON.stringify(backupData, null, 2));
});

module.exports = router;
