const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../perfumes.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    
    // Ejecutar el esquema si no está inicializado
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    dbInstance.exec(schemaSql);

    // Inicializar configuración por defecto si está vacía
    const configStmt = dbInstance.prepare("SELECT valor FROM configuracion WHERE clave = 'comision_porcentaje_default'");
    const config = configStmt.get();
    if (!config) {
      dbInstance.prepare(`
        INSERT INTO configuracion (clave, valor, descripcion)
        VALUES 
          ('comision_porcentaje_default', '30', 'Porcentaje de comisión para vendedores sobre el margen directo'),
          ('moneda', 'RD$', 'Moneda oficial del sistema'),
          ('nombre_negocio', 'Perfumes Bajo Pedido', 'Nombre comercial de la plataforma')
      `).run();
    }
  }
  return dbInstance;
}

module.exports = { getDb, DB_PATH };
