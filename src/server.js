const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { getDb } = require('./db');
const { seedDatabase } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Inicializar BD
getDb();

// Rutas de API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/vendedores', require('./routes/vendedores'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/paquetes', require('./routes/paquetes'));
app.use('/api/rutas', require('./routes/rutas'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/comisiones', require('./routes/comisiones'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/configuracion', require('./routes/configuracion'));

// Endpoint de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sistema: 'Plataforma de Gestión de Perfumes Bajo Pedido',
    moneda: 'RD$',
    timestamp: new Date().toISOString()
  });
});

// Fallback para SPA en cualquier ruta no reconocida
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado en servidor:', err);
  res.status(500).json({
    error: 'Ocurrió un error interno en el servidor.',
    detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  // Asegurar que el seed exista
  seedDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` ✨ PLATAFORMA DE GESTIÓN DE PERFUMES ACTIVA ✨`);
      console.log(` Servidor escuchando en: http://localhost:${PORT}`);
      console.log(` Entorno: ${process.env.NODE_ENV || 'production'}`);
      console.log(`=======================================================`);
    });
  });
}

module.exports = app;
