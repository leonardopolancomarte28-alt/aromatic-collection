const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

// Iniciar sesión
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Debes proporcionar correo electrónico y contraseña.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  }

  if (!user.activo) {
    return res.status(403).json({ error: 'Tu cuenta ha sido desactivada por la administración.' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  logAudit({
    tabla: 'usuarios',
    registroId: user.id,
    accion: 'ACTUALIZAR',
    usuarioId: user.id,
    detalles: `Inicio de sesión exitoso desde ${req.ip || 'desconocido'}`
  });

  res.json({
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      telefono: user.telefono
    }
  });
});

// Obtener datos del usuario actual
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Actualizar perfil del usuario actual (nombre, correo, teléfono)
router.put('/profile', authenticateToken, async (req, res) => {
  const { nombre, email, telefono } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'El nombre y el correo electrónico son obligatorios.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?').get(email.trim(), req.user.id);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe otro usuario con este correo electrónico.' });
  }

  db.prepare(`
    UPDATE usuarios 
    SET nombre = ?, email = ?, telefono = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nombre.trim(), email.trim(), telefono ? telefono.trim() : null, req.user.id);

  logAudit({
    tabla: 'usuarios',
    registroId: req.user.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: `Perfil actualizado: ${nombre.trim()} (${email.trim()})`
  });

  const updatedUser = db.prepare('SELECT id, nombre, email, rol, telefono FROM usuarios WHERE id = ?').get(req.user.id);
  res.json({ message: 'Perfil actualizado correctamente.', user: updatedUser });
});

// Cambiar contraseña
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Debes ingresar tu contraseña actual y la nueva contraseña.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?').get(req.user.id);

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE usuarios SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

  logAudit({
    tabla: 'usuarios',
    registroId: req.user.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: 'Cambio de contraseña voluntario'
  });

  res.json({ message: 'Contraseña actualizada correctamente.' });
});

// Cerrar sesión
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada correctamente.' });
});

module.exports = router;
