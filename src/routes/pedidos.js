const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BusinessCalculations = require('../services/calculations');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar pedidos (con filtros de estado, cliente, vendedor y búsqueda)
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';
  const { estado, estado_pago, cliente_id, q } = req.query;

  let query = `
    SELECT 
      p.*,
      c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion,
      u.nombre as vendedor_nombre,
      prov.nombre as proveedor_nombre,
      paq.codigo_paquete,
      rut.codigo_ruta,
      com.monto_comision, com.estado as comision_estado
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    JOIN usuarios u ON u.id = p.vendedor_id
    LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
    LEFT JOIN paquetes paq ON paq.id = p.paquete_id
    LEFT JOIN rutas_entrega rut ON rut.id = p.ruta_entrega_id
    LEFT JOIN comisiones com ON com.pedido_id = p.id
    WHERE 1=1
  `;

  const params = [];

  // Vendedor solo puede ver sus propios pedidos
  if (!isAdmin) {
    query += ` AND p.vendedor_id = ? `;
    params.push(req.user.id);
  }

  if (estado) {
    query += ` AND p.estado = ? `;
    params.push(estado);
  }

  if (estado_pago) {
    query += ` AND p.estado_pago = ? `;
    params.push(estado_pago);
  }

  if (cliente_id) {
    query += ` AND p.cliente_id = ? `;
    params.push(cliente_id);
  }

  if (q) {
    query += ` AND (p.codigo_pedido LIKE ? OR p.perfume_nombre LIKE ? OR c.nombre LIKE ?) `;
    const term = `%${q.trim()}%`;
    params.push(term, term, term);
  }

  query += ` ORDER BY p.created_at DESC `;

  const pedidos = db.prepare(query).all(...params);

  // SANITIZACIÓN DE SEGURIDAD PARA VENDEDORES:
  // Si no es admin, ocultar los campos confidenciales de costos, márgenes y ganancias del negocio
  const resultado = pedidos.map(p => {
    if (!isAdmin) {
      const {
        costo_compra_perfume,
        costo_envio_asignado,
        costo_gasolina_asignado,
        margen_directo,
        ganancia_negocio,
        ...safeData
      } = p;
      return safeData;
    }
    return p;
  });

  res.json({ pedidos: resultado });
});

// Detalle de un pedido
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';

  const pedido = db.prepare(`
    SELECT 
      p.*,
      c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion,
      u.nombre as vendedor_nombre,
      prov.nombre as proveedor_nombre,
      paq.codigo_paquete,
      rut.codigo_ruta,
      com.monto_comision, com.estado as comision_estado, com.porcentaje_aplicado as comision_porcentaje
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    JOIN usuarios u ON u.id = p.vendedor_id
    LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
    LEFT JOIN paquetes paq ON paq.id = p.paquete_id
    LEFT JOIN rutas_entrega rut ON rut.id = p.ruta_entrega_id
    LEFT JOIN comisiones com ON com.pedido_id = p.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }

  // Protección de acceso si es vendedor y no le pertenece
  if (!isAdmin && pedido.vendedor_id !== req.user.id) {
    return res.status(403).json({ error: 'No tienes autorización para ver este pedido.' });
  }

  // Pagos del pedido
  const pagos = db.prepare(`
    SELECT p.*, u.nombre as registrado_por_nombre
    FROM pagos p
    JOIN usuarios u ON u.id = p.registrado_por
    WHERE p.pedido_id = ?
    ORDER BY p.fecha_pago DESC
  `).all(pedido.id);

  // Historial de auditoría
  const historial = db.prepare(`
    SELECT a.*, u.nombre as usuario_nombre
    FROM audit_logs a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.registro_id = ?
    ORDER BY a.created_at DESC
  `).all(pedido.id);

  // Sanitización de confidencialidad para vendedor
  let pedidoData = pedido;
  if (!isAdmin) {
    const {
      costo_compra_perfume,
      costo_envio_asignado,
      costo_gasolina_asignado,
      margen_directo,
      ganancia_negocio,
      ...safe
    } = pedido;
    pedidoData = safe;
  }

  res.json({ pedido: pedidoData, pagos, historial });
});

// Crear nuevo pedido
router.post('/', authenticateToken, (req, res) => {
  const {
    cliente_id,
    vendedor_id,
    perfume_nombre,
    cantidad,
    precio_venta_unitario,
    adelanto_inicial,
    metodo_pago,
    notas
  } = req.body;

  if (!cliente_id || !perfume_nombre) {
    return res.status(400).json({ error: 'Debes seleccionar un cliente y especificar el perfume solicitado.' });
  }

  const cant = parseInt(cantidad) || 1;
  const precioUnitario = Number(precio_venta_unitario || 0);

  if (cant <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser de al menos 1 unidad.' });
  }

  if (precioUnitario <= 0) {
    return res.status(400).json({ error: 'El precio de venta debe ser un monto mayor a cero.' });
  }

  const precioTotal = Number((cant * precioUnitario).toFixed(2));
  const adelanto = Number(adelanto_inicial || 0);

  if (adelanto > precioTotal) {
    return res.status(400).json({ error: 'El monto de adelanto no puede ser superior al precio total del pedido.' });
  }

  const totalCobrado = adelanto;
  const balancePendiente = Number((precioTotal - totalCobrado).toFixed(2));
  const estadoPago = balancePendiente === 0 ? 'PAGADO' : (totalCobrado > 0 ? 'PARCIAL' : 'PENDIENTE');

  // Si es vendedor, el vendedor asignado DEBE ser él mismo
  const responsableVendedorId = req.user.rol === 'ADMIN' && vendedor_id
    ? vendedor_id
    : req.user.id;

  const db = getDb();
  const year = new Date().getFullYear();
  const countRow = db.prepare('SELECT COUNT(*) as c FROM pedidos').get();
  const numeroSecuencial = String(countRow.c + 1).padStart(4, '0');
  const codigoPedido = `PED-${year}-${numeroSecuencial}`;
  const pedidoId = 'PED-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  const crearPedidoTx = db.transaction(() => {
    // 1. Insertar pedido
    db.prepare(`
      INSERT INTO pedidos (
        id, codigo_pedido, cliente_id, vendedor_id, perfume_nombre, cantidad,
        precio_venta_unitario, precio_venta_total, estado, estado_pago,
        total_cobrado, balance_pendiente, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REGISTRADO', ?, ?, ?, ?)
    `).run(
      pedidoId,
      codigoPedido,
      cliente_id,
      responsableVendedorId,
      perfume_nombre.trim(),
      cant,
      precioUnitario,
      precioTotal,
      estadoPago,
      totalCobrado,
      balancePendiente,
      notas ? notas.trim() : null
    );

    // 2. Si hubo adelanto, registrar el pago y entrada a caja
    if (adelanto > 0) {
      const pagoId = 'PAG-' + Date.now().toString(36).toUpperCase();
      db.prepare(`
        INSERT INTO pagos (id, pedido_id, monto, metodo_pago, tipo, notas, registrado_por)
        VALUES (?, ?, ?, ?, 'ADELANTO', 'Adelanto inicial al registrar pedido', ?)
      `).run(pagoId, pedidoId, adelanto, metodo_pago || 'EFECTIVO', req.user.id);

      db.prepare(`
        INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
        VALUES (?, 'ENTRADA', 'COBRO_CLIENTE', ?, ?, ?, ?, ?)
      `).run(
        'MOV-' + pagoId,
        adelanto,
        metodo_pago || 'EFECTIVO',
        pedidoId,
        `Adelanto cobrado por pedido ${codigoPedido} (${perfume_nombre.trim()})`,
        req.user.id
      );
    }

    // 3. Crear registro de comisión en estado PENDIENTE
    const configComision = db.prepare("SELECT valor FROM configuracion WHERE clave = 'comision_porcentaje_default'").get();
    const pct = configComision ? Number(configComision.valor) : 30;

    db.prepare(`
      INSERT INTO comisiones (id, pedido_id, vendedor_id, margen_utilizado, porcentaje_aplicado, monto_comision, estado)
      VALUES (?, ?, ?, 0.00, ?, 0.00, 'PENDIENTE')
    `).run('COM-' + pedidoId, pedidoId, responsableVendedorId, pct);
  });

  crearPedidoTx();

  logAudit({
    tabla: 'pedidos',
    registroId: pedidoId,
    accion: 'CREAR',
    usuarioId: req.user.id,
    valoresNuevos: { codigoPedido, perfume_nombre, cantidad: cant, precioTotal, adelanto },
    detalles: `Pedido ${codigoPedido} registrado`
  });

  res.status(201).json({
    message: 'Pedido registrado con éxito.',
    codigoPedido,
    pedidoId
  });
});

// Registrar Compra de Perfume para el pedido (Solo Administrador)
router.post('/:id/registrar-compra', authenticateToken, requireAdmin, (req, res) => {
  const { proveedor_id, costo_compra_perfume, referencia_compra } = req.body;
  const costoCompra = Number(costo_compra_perfume);

  if (!costoCompra || costoCompra <= 0) {
    return res.status(400).json({ error: 'Debes indicar el costo real de compra del perfume.' });
  }

  const db = getDb();
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }

  const registrarCompraTx = db.transaction(() => {
    // 1. Salida real de caja para pagar al proveedor
    const movId = 'MOV-PRV-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
      VALUES (?, 'SALIDA', 'PAGO_PROVEEDOR', ?, 'TRANSFERENCIA', ?, ?, ?)
    `).run(
      movId,
      costoCompra,
      pedido.id,
      `Compra de perfume para pedido ${pedido.codigo_pedido} (${pedido.perfume_nombre})${referencia_compra ? ' Ref: ' + referencia_compra : ''}`,
      req.user.id
    );

    // 2. Recalcular margen directo
    const nuevoMargen = BusinessCalculations.calcularMargenDirecto(
      pedido.precio_venta_total,
      costoCompra,
      pedido.costo_envio_asignado,
      pedido.costo_gasolina_asignado
    );

    const configComision = db.prepare("SELECT valor FROM configuracion WHERE clave = 'comision_porcentaje_default'").get();
    const pct = configComision ? Number(configComision.valor) : 30;

    const comisionMonto = BusinessCalculations.calcularComisionVendedor(nuevoMargen, pct);
    const gananciaNegocio = BusinessCalculations.calcularGananciaNegocio(nuevoMargen, comisionMonto);

    // 3. Actualizar pedido a estado COMPRADO
    db.prepare(`
      UPDATE pedidos
      SET proveedor_id = ?,
          costo_compra_perfume = ?,
          margen_directo = ?,
          ganancia_negocio = ?,
          estado = 'COMPRADO',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(proveedor_id || null, costoCompra, nuevoMargen, gananciaNegocio, pedido.id);

    // 4. Actualizar comisión proyectada
    db.prepare(`
      UPDATE comisiones
      SET margen_utilizado = ?, monto_comision = ?
      WHERE pedido_id = ?
    `).run(nuevoMargen, comisionMonto, pedido.id);
  });

  registrarCompraTx();

  logAudit({
    tabla: 'pedidos',
    registroId: pedido.id,
    accion: 'ACTUALIZAR',
    usuarioId: req.user.id,
    detalles: `Compra registrada para pedido ${pedido.codigo_pedido}: Costo RD$${costoCompra}`
  });

  res.json({ message: 'Compra registrada con éxito y estado actualizado a COMPRADO.' });
});

// Cambiar estado de un pedido
router.put('/:id/estado', authenticateToken, (req, res) => {
  const { nuevo_estado, motivo } = req.body;
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';

  const estadosValidos = [
    'REGISTRADO', 'PENDIENTE_COMPRA', 'COMPRADO', 'EN_TRANSITO',
    'RECIBIDO', 'LISTO_ENTREGA', 'ENTREGADO', 'CANCELADO'
  ];

  if (!estadosValidos.includes(nuevo_estado)) {
    return res.status(400).json({ error: `Estado '${nuevo_estado}' no es válido.` });
  }

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }

  // Si es vendedor, solo puede marcar como ENTREGADO si el pedido le pertenece o él es el responsable de entrega
  if (!isAdmin) {
    if (pedido.vendedor_id !== req.user.id && pedido.responsable_entrega_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes autorización para cambiar el estado de este pedido.' });
    }
    if (nuevo_estado !== 'ENTREGADO') {
      return res.status(403).json({ error: 'Los vendedores solo pueden marcar entregas realizadas.' });
    }
  }

  const cambiarEstadoTx = db.transaction(() => {
    let fechaEntrega = pedido.fecha_entrega;
    if (nuevo_estado === 'ENTREGADO' && !fechaEntrega) {
      fechaEntrega = new Date().toISOString();
    }

    // Actualizar pedido
    db.prepare(`
      UPDATE pedidos
      SET estado = ?,
          fecha_entrega = ?,
          motivo_cancelacion = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nuevo_estado,
      fechaEntrega,
      nuevo_estado === 'CANCELADO' ? (motivo || 'Cancelación de pedido') : pedido.motivo_cancelacion,
      pedido.id
    );

    // Evaluar estado de la comisión:
    // La comisión solo pasa a GANADA si está ENTREGADO y balance_pendiente === 0
    const evaluacion = BusinessCalculations.evaluarElegibilidadComision(nuevo_estado, pedido.balance_pendiente);

    db.prepare(`
      UPDATE comisiones
      SET estado = ?,
          fecha_generada = CASE WHEN ? = 'GANADA' AND fecha_generada IS NULL THEN CURRENT_TIMESTAMP ELSE fecha_generada END
      WHERE pedido_id = ?
    `).run(evaluacion.estadoComision, evaluacion.estadoComision, pedido.id);
  });

  cambiarEstadoTx();

  logAudit({
    tabla: 'pedidos',
    registroId: pedido.id,
    accion: nuevo_estado === 'CANCELADO' ? 'CANCELACION' : 'CAMBIO_ESTADO',
    usuarioId: req.user.id,
    valoresAnteriores: { estado: pedido.estado },
    valoresNuevos: { estado: nuevo_estado, motivo },
    detalles: `Cambio de estado a ${nuevo_estado}${motivo ? ': ' + motivo : ''}`
  });

  res.json({
    message: `Estado de pedido actualizado a ${nuevo_estado}.`,
    nuevoEstado: nuevo_estado
  });
});

module.exports = router;
