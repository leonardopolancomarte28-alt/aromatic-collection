const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BusinessCalculations = require('../services/calculations');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar paquetes recibidos con sus pedidos vinculados
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const paquetes = db.prepare(`
    SELECT p.*, prv.nombre as proveedor_nombre,
      COUNT(ped.id) as pedidos_asignados_count
    FROM paquetes p
    LEFT JOIN proveedores prv ON prv.id = p.proveedor_id
    LEFT JOIN pedidos ped ON ped.paquete_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();

  // Para cada paquete, obtener la lista de pedidos
  const resultado = paquetes.map(paq => {
    const pedidos = db.prepare(`
      SELECT ped.id, ped.codigo_pedido, ped.perfume_nombre, ped.cantidad, c.nombre as cliente_nombre
      FROM pedidos ped
      JOIN clientes c ON c.id = ped.cliente_id
      WHERE ped.paquete_id = ?
    `).all(paq.id);

    return { ...paq, pedidos };
  });

  res.json({ paquetes: resultado });
});

// Registrar nuevo paquete recibido y distribuir automáticamente el flete
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    codigo_paquete,
    proveedor_id,
    fecha_envio,
    fecha_recepcion,
    costo_envio_total,
    total_perfumes_recibidos,
    pedidos_ids, // Array de IDs de pedidos incluidos en este paquete
    observaciones
  } = req.body;

  const costoTotal = Number(costo_envio_total);
  const totalPerfumes = Number(total_perfumes_recibidos);

  if (!costoTotal || costoTotal <= 0) {
    return res.status(400).json({ error: 'El costo total de envío debe ser un valor positivo (ej. RD$550).' });
  }

  if (!totalPerfumes || totalPerfumes <= 0) {
    return res.status(400).json({ error: 'La cantidad total de perfumes en el paquete debe ser mayor a 0.' });
  }

  const db = getDb();
  const codigo = (codigo_paquete && codigo_paquete.trim()) 
    ? codigo_paquete.trim().toUpperCase() 
    : 'PKG-' + Date.now().toString(36).toUpperCase();

  // 1. Calcular costo de envío prorrateado por perfume
  const costoPorPerfume = BusinessCalculations.calcularCostoEnvioPorPerfume(costoTotal, totalPerfumes);

  const paqueteId = 'PAQ-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  // Transacción en base de datos para atomicidad garantizada
  const registrarPaqueteTx = db.transaction(() => {
    // A. Registrar movimiento de salida en CAJA por el flete real del paquete
    const movCajaId = 'MOV-FLT-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
      VALUES (?, 'SALIDA', 'FLETE_PAQUETE', ?, 'EFECTIVO', ?, ?, ?)
    `).run(
      movCajaId,
      costoTotal,
      paqueteId,
      `Pago de flete/envío de paquete ${codigo} (${totalPerfumes} perfumes a RD$${costoPorPerfume}/u)`,
      req.user.id
    );

    // B. Insertar el registro del paquete
    db.prepare(`
      INSERT INTO paquetes (
        id, codigo_paquete, proveedor_id, fecha_envio, fecha_recepcion,
        costo_envio_total, total_perfumes_recibidos, costo_envio_por_perfume,
        observaciones, caja_movimiento_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paqueteId,
      codigo,
      proveedor_id || null,
      fecha_envio || null,
      fecha_recepcion || new Date().toISOString().split('T')[0],
      costoTotal,
      totalPerfumes,
      costoPorPerfume,
      observaciones || null,
      movCajaId,
      req.user.id
    );

    // C. Si se seleccionaron pedidos relacionados, vincularlos y prorratearles el flete
    if (Array.isArray(pedidos_ids) && pedidos_ids.length > 0) {
      for (const pedId of pedidos_ids) {
        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedId);
        if (pedido) {
          // El costo de envío del pedido es: cantidad_de_perfumes_en_pedido * costo_por_perfume
          const costoEnvioPedido = Number((pedido.cantidad * costoPorPerfume).toFixed(2));
          
          // Recalcular margen directo con el nuevo envío
          const nuevoMargen = BusinessCalculations.calcularMargenDirecto(
            pedido.precio_venta_total,
            pedido.costo_compra_perfume,
            costoEnvioPedido,
            pedido.costo_gasolina_asignado
          );

          // Obtener configuración de comisión
          const configComision = db.prepare("SELECT valor FROM configuracion WHERE clave = 'comision_porcentaje_default'").get();
          const pct = configComision ? Number(configComision.valor) : 30;

          const comisionMonto = BusinessCalculations.calcularComisionVendedor(nuevoMargen, pct);
          const gananciaNegocio = BusinessCalculations.calcularGananciaNegocio(nuevoMargen, comisionMonto);

          // Si el pedido estaba en COMPRADO o EN_TRANSITO, actualizar estado a RECIBIDO
          let nuevoEstado = pedido.estado;
          if (['REGISTRADO', 'PENDIENTE_COMPRA', 'COMPRADO', 'EN_TRANSITO'].includes(pedido.estado)) {
            nuevoEstado = 'RECIBIDO';
          }

          db.prepare(`
            UPDATE pedidos
            SET paquete_id = ?,
                costo_envio_asignado = ?,
                margen_directo = ?,
                ganancia_negocio = ?,
                estado = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(paqueteId, costoEnvioPedido, nuevoMargen, gananciaNegocio, nuevoEstado, pedId);

          // Actualizar registro de comisión asociada
          db.prepare(`
            INSERT INTO comisiones (id, pedido_id, vendedor_id, margen_utilizado, porcentaje_aplicado, monto_comision, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')
            ON CONFLICT(pedido_id) DO UPDATE SET
              margen_utilizado = excluded.margen_utilizado,
              monto_comision = excluded.monto_comision
          `).run('COM-' + pedId, pedId, pedido.vendedor_id, nuevoMargen, pct, comisionMonto);
        }
      }
    }
  });

  registrarPaqueteTx();

  logAudit({
    tabla: 'paquetes',
    registroId: paqueteId,
    accion: 'CREAR',
    usuarioId: req.user.id,
    detalles: `Registro de paquete ${codigo} por RD$${costoTotal} (${totalPerfumes} perfumes a RD$${costoPorPerfume}/u)`
  });

  res.status(201).json({
    message: 'Paquete registrado exitosamente y flete distribuido.',
    costoPorPerfume,
    paqueteId
  });
});

module.exports = router;
