const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'perfumes_secret_key_2026_super_secure';

function authenticateToken(req, res, next) {
  let token = null;

  // 1. Bearer token en cabecera
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token de autenticación válido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, nombre, email, rol, telefono, activo FROM usuarios WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    if (!user.activo) {
      return res.status(403).json({ error: 'Tu cuenta de usuario ha sido desactivada. Comunícate con el administrador.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido. Por favor inicia sesión nuevamente.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'ADMIN') {
    return res.status(403).json({
      error: 'Acceso restringido. Solo los administradores tienen permisos para realizar esta acción o ver estos datos.'
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};
