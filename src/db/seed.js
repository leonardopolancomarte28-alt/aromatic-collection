const bcrypt = require('bcryptjs');
const { getDb } = require('./index');
const crypto = require('crypto');

async function seedDatabase() {
  const db = getDb();
  console.log('--- INICIALIZANDO DATOS INICIALES (SEED) ---');

  // 1. Crear Administrador por defecto
  const adminEmail = 'admin@perfumes.com';
  const existingAdmin = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(adminEmail);
  
  if (!existingAdmin) {
    const adminPasswordHash = await bcrypt.hash('Admin123456!', 10);
    const adminId = 'USR-ADMIN-01';
    db.prepare(`
      INSERT INTO usuarios (id, nombre, email, password_hash, rol, telefono, activo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(adminId, 'Administrador Principal', adminEmail, adminPasswordHash, 'ADMIN', '809-555-0100');
    console.log('✓ Administrador creado: admin@perfumes.com (Contraseña: Admin123456!)');
  } else {
    console.log('ℹ Administrador ya existente.');
  }

  // 2. Crear Vendedor de prueba
  const vendedorEmail = 'vendedor1@perfumes.com';
  const existingVendedor = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(vendedorEmail);
  
  if (!existingVendedor) {
    const vendedorPasswordHash = await bcrypt.hash('Vendedor123456!', 10);
    const vendedorId = 'USR-VEND-01';
    db.prepare(`
      INSERT INTO usuarios (id, nombre, email, password_hash, rol, telefono, activo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(vendedorId, 'Carlos Gómez (Vendedor)', vendedorEmail, vendedorPasswordHash, 'VENDEDOR', '809-555-0101');
    console.log('✓ Vendedor creado: vendedor1@perfumes.com (Contraseña: Vendedor123456!)');
  } else {
    console.log('ℹ Vendedor ya existente.');
  }

  // 3. Crear Proveedor por defecto
  const provId = 'PRV-001';
  const existingProv = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(provId);
  if (!existingProv) {
    db.prepare(`
      INSERT INTO proveedores (id, nombre, contacto, telefono, direccion, activo)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(provId, 'Importadora Fragancias del Caribe', 'Lic. Manuel Peña', '809-555-0200', 'Zona Industrial de Herrera, Santo Domingo');
    console.log('✓ Proveedor inicial creado: Importadora Fragancias del Caribe');
  }

  // 4. Clientes iniciales de muestra
  const cliente1Id = 'CLI-001';
  const existingCli1 = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente1Id);
  if (!existingCli1) {
    db.prepare(`
      INSERT INTO clientes (id, nombre, telefono, direccion, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(cliente1Id, 'Juan Pérez', '829-555-1122', 'Ensanche Naco, Calle Tetelo Vargas #12, Apto 3B, Santo Domingo', 'Cliente preferencial de fragancias dulces');
    console.log('✓ Cliente inicial creado: Juan Pérez');
  }

  const cliente2Id = 'CLI-002';
  const existingCli2 = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente2Id);
  if (!existingCli2) {
    db.prepare(`
      INSERT INTO clientes (id, nombre, telefono, direccion, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(cliente2Id, 'María Rodríguez', '849-555-3344', 'Bella Vista, Av. Sarasota esq. Núñez de Cáceres, Torre Altagracia', 'Prefiere entregas en horario de la tarde');
    console.log('✓ Cliente inicial creado: María Rodríguez');
  }

  console.log('--- SEED COMPLETADO SATISFACTORIAMENTE ---\n');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error en seed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
