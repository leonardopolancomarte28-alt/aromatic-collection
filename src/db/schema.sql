-- =====================================================================
-- ESQUEMA DE BASE DE DATOS: PLATAFORMA DE GESTIÓN DE PERFUMES
-- Motor: SQLite 3 con Foreign Keys y WAL habilitado
-- Moneda base: Pesos Dominicanos (RD$)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- 1. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. USUARIOS (Administradores y Vendedores)
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('ADMIN', 'VENDEDOR')),
    telefono TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    direccion TEXT,
    notas TEXT,
    created_by TEXT REFERENCES usuarios(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);

-- 4. PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    contacto TEXT,
    telefono TEXT,
    direccion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAQUETES RECIBIDOS (Gestión de Flete Prorrateado)
CREATE TABLE IF NOT EXISTS paquetes (
    id TEXT PRIMARY KEY,
    codigo_paquete TEXT UNIQUE NOT NULL,
    proveedor_id TEXT REFERENCES proveedores(id),
    fecha_envio DATE,
    fecha_recepcion DATE,
    costo_envio_total REAL NOT NULL DEFAULT 0.00,
    total_perfumes_recibidos INTEGER NOT NULL DEFAULT 0,
    costo_envio_por_perfume REAL NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    caja_movimiento_id TEXT, -- Vinculación con salida de caja para no duplicar
    created_by TEXT REFERENCES usuarios(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. RUTAS DE ENTREGA (Gestión de Combustible Prorrateado)
CREATE TABLE IF NOT EXISTS rutas_entrega (
    id TEXT PRIMARY KEY,
    codigo_ruta TEXT UNIQUE NOT NULL,
    responsable_id TEXT REFERENCES usuarios(id),
    fecha_ruta DATE NOT NULL,
    costo_gasolina_total REAL NOT NULL DEFAULT 0.00,
    total_pedidos INTEGER NOT NULL DEFAULT 0,
    gasolina_por_pedido REAL NOT NULL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'PLANIFICADA' CHECK(estado IN ('PLANIFICADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA')),
    observaciones TEXT,
    caja_movimiento_id TEXT, -- Vinculación con salida de caja para no duplicar
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. PEDIDOS (Entidad central bajo pedido)
CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    codigo_pedido TEXT UNIQUE NOT NULL,
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    vendedor_id TEXT NOT NULL REFERENCES usuarios(id),
    perfume_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_venta_unitario REAL NOT NULL DEFAULT 0.00,
    precio_venta_total REAL NOT NULL DEFAULT 0.00,
    
    -- Estados del ciclo de vida
    estado TEXT NOT NULL DEFAULT 'REGISTRADO' CHECK(estado IN (
        'REGISTRADO', 
        'PENDIENTE_COMPRA', 
        'COMPRADO', 
        'EN_TRANSITO', 
        'RECIBIDO', 
        'LISTO_ENTREGA', 
        'ENTREGADO', 
        'CANCELADO'
    )),
    motivo_cancelacion TEXT,
    
    -- Control de Pagos
    estado_pago TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado_pago IN ('PENDIENTE', 'PARCIAL', 'PAGADO')),
    total_cobrado REAL NOT NULL DEFAULT 0.00,
    balance_pendiente REAL NOT NULL DEFAULT 0.00,
    
    -- Asignaciones de Abastecimiento
    proveedor_id TEXT REFERENCES proveedores(id),
    paquete_id TEXT REFERENCES paquetes(id),
    costo_compra_perfume REAL NOT NULL DEFAULT 0.00,
    costo_envio_asignado REAL NOT NULL DEFAULT 0.00,
    
    -- Asignaciones de Entrega
    ruta_entrega_id TEXT REFERENCES rutas_entrega(id),
    responsable_entrega_id TEXT REFERENCES usuarios(id),
    costo_gasolina_asignado REAL NOT NULL DEFAULT 0.00,
    fecha_entrega DATETIME,
    
    -- Rentabilidad Calculada
    margen_directo REAL NOT NULL DEFAULT 0.00,
    ganancia_negocio REAL NOT NULL DEFAULT 0.00,
    
    notas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_pago ON pedidos(estado_pago);

-- 8. PAGOS Y ADELANTOS
CREATE TABLE IF NOT EXISTS pagos (
    id TEXT PRIMARY KEY,
    pedido_id TEXT NOT NULL REFERENCES pedidos(id),
    monto REAL NOT NULL CHECK(monto > 0),
    metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK(metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO')),
    tipo TEXT NOT NULL DEFAULT 'ADELANTO' CHECK(tipo IN ('ADELANTO', 'PAGO_FINAL', 'ABONO', 'DEVOLUCION')),
    notas TEXT,
    registrado_por TEXT NOT NULL REFERENCES usuarios(id),
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(pedido_id);

-- 9. COMISIONES DE VENDEDORES
CREATE TABLE IF NOT EXISTS comisiones (
    id TEXT PRIMARY KEY,
    pedido_id TEXT UNIQUE NOT NULL REFERENCES pedidos(id),
    vendedor_id TEXT NOT NULL REFERENCES usuarios(id),
    margen_utilizado REAL NOT NULL DEFAULT 0.00,
    porcentaje_aplicado REAL NOT NULL DEFAULT 30.00,
    monto_comision REAL NOT NULL DEFAULT 0.00,
    
    -- Estado de la comisión
    -- PENDIENTE: no entregado o no cobrado al 100%
    -- GANADA: entregado Y 100% cobrado (lista para pagar)
    -- PAGADA: desembolsada en caja al vendedor
    -- ANULADA: pedido cancelado
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'GANADA', 'PAGADA', 'ANULADA')),
    fecha_generada DATETIME,
    fecha_pagada DATETIME,
    caja_movimiento_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comisiones_vendedor ON comisiones(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_estado ON comisiones(estado);

-- 10. MOVIMIENTOS DE CAJA (Control de Flujo de Efectivo Real)
CREATE TABLE IF NOT EXISTS movimientos_caja (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK(tipo IN ('ENTRADA', 'SALIDA')),
    categoria TEXT NOT NULL CHECK(categoria IN (
        'COBRO_CLIENTE',
        'PAGO_PROVEEDOR',
        'FLETE_PAQUETE',
        'GASOLINA_RUTA',
        'PAGO_COMISION',
        'GASTO_OPERATIVO',
        'DEVOLUCION_CLIENTE',
        'AJUSTE_CAJA'
    )),
    monto REAL NOT NULL CHECK(monto > 0),
    metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK(metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'OTRO')),
    referencia_id TEXT, -- ID de pedido, paquete, ruta, comisión o proveedor
    descripcion TEXT NOT NULL,
    registrado_por TEXT NOT NULL REFERENCES usuarios(id),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caja_fecha ON movimientos_caja(fecha);
CREATE INDEX IF NOT EXISTS idx_caja_tipo ON movimientos_caja(tipo);

-- 11. AUDITORÍA INMUTABLE (Trazabilidad estricta)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tabla TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    accion TEXT NOT NULL CHECK(accion IN ('CREAR', 'ACTUALIZAR', 'CAMBIO_ESTADO', 'CANCELACION', 'PAGO', 'LIQUIDACION', 'LOGIN')),
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    valores_anteriores TEXT, -- JSON serializado
    valores_nuevos TEXT,     -- JSON serializado
    detalles TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_registro ON audit_logs(registro_id);
