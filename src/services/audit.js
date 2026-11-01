const { getDb } = require('../db');
const crypto = require('crypto');

function logAudit({ tabla, registroId, accion, usuarioId, valoresAnteriores = null, valoresNuevos = null, detalles = '' }) {
  try {
    const db = getDb();
    const id = 'AUD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos, detalles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      tabla,
      String(registroId),
      accion,
      usuarioId || 'SISTEMA',
      valoresAnteriores ? JSON.stringify(valoresAnteriores) : null,
      valoresNuevos ? JSON.stringify(valoresNuevos) : null,
      detalles
    );
  } catch (err) {
    console.error('Error al registrar auditoría:', err.message);
  }
}

module.exports = { logAudit };
