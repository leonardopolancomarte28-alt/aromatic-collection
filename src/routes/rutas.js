const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BusinessCalculations = require('../services/calculations');
const { logAudit } = require('../services/audit');
const crypto = require('crypto');

// Listar rutas de entrega
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const isAdmin = req.user.rol === 'ADMIN';

  let query = `
    SELECT r.*, u.nombre as responsable_nombre
    FROM rutas_entrega r
    LEFT JOIN usuarios u ON u.id = r.responsable_id
  `;

  const params = [];
  if (!isAdmin) {
    // Si es vendedor, solo ve rutas donde él es el responsable
    query += ` WHERE r.responsable_id = ? `;
    params.push(req.user.id);
  }

  query += ` ORDER BY r.fecha_ruta DESC, r.created_at DESC `;

  const rutas = db.prepare(query).all(...params);

  // Adjuntar pedidos asociados a cada ruta
  const resultado = rutas.map(ruta => {
    const pedidos = db.prepare(`
      SELECT p.id, p.codigo_pedido, p.perfume_nombre, p.estado, p.estado_pago,
        p.total_cobrado, p.balance_pendiente, p.costo_gasolina_asignado,
        c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.ruta_entrega_id = ?
    `).all(ruta.id);

    return { ...ruta, pedidos };
  });

  res.json({ rutas: resultado });
});

// Crear nueva ruta de entrega y distribuir combustible
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    codigo_ruta,
    responsable_id,
    fecha_ruta,
    costo_gasolina_total,
    pedidos_ids, // IDs de pedidos incluidos en la ruta
    observaciones
  } = req.body;

  const costoGasolina = Number(costo_gasolina_total || 0);
  const pedidosArray = Array.isArray(pedidos_ids) ? pedidos_ids : [];
  const totalPedidos = pedidosArray.length;

  if (totalPedidos === 0) {
    return res.status(400).json({ error: 'Debes seleccionar al menos un pedido para crear la ruta de entrega.' });
  }

  const db = getDb();
  const codigo = (codigo_ruta && codigo_ruta.trim())
    ? codigo_ruta.trim().toUpperCase()
    : 'RUT-' + Date.now().toString(36).toUpperCase();

  // Calcular gasolina prorrateada por pedido
  const gasolinaPorPedido = totalPedidos > 0 && costoGasolina > 0
    ? BusinessCalculations.calcularGasolinaPorPedido(costoGasolina, totalPedidos)
    : 0;

  const rutaId = 'RUT-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  const crearRutaTx = db.transaction(() => {
    let movCajaId = null;

    // A. Registrar gasto real de gasolina en CAJA (una sola salida para no duplicar)
    if (costoGasolina > 0) {
      movCajaId = 'MOV-GAS-' + Date.now().toString(36).toUpperCase();
      db.prepare(`
        INSERT INTO movimientos_caja (id, tipo, categoria, monto, metodo_pago, referencia_id, descripcion, registrado_por)
        VALUES (?, 'SALIDA', 'GASOLINA_RUTA', ?, 'EFECTIVO', ?, ?, ?)
      `).run(
        movCajaId,
        costoGasolina,
        rutaId,
        `Gasto de gasolina para ruta ${codigo} (${totalPedidos} entregas a RD$${gasolinaPorPedido}/pedido)`,
        req.user.id
      );
    }

    // B. Crear registro de la ruta
    db.prepare(`
      INSERT INTO rutas_entrega (
        id, codigo_ruta, responsable_id, fecha_ruta, costo_gasolina_total,
        total_pedidos, gasolina_por_pedido, estado, observaciones, caja_movimiento_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PLANIFICADA', ?, ?)
    `).run(
      rutaId,
      codigo,
      responsable_id || req.user.id,
      fecha_ruta || new Date().toISOString().split('T')[0],
      costoGasolina,
      totalPedidos,
      gasolinaPorPedido,
      observaciones || null,
      movCajaId
    );

    // C. Asignar pedidos a la ruta, actualizar costo de gasolina y recalcular márgenes
    const configComision = db.prepare("SELECT valor FROM configuracion WHERE clave = 'comision_porcentaje_default'").get();
    const pct = configComision ? Number(configComision.valor) : 30;

    for (const pedId of pedidosArray) {
      const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedId);
      if (pedido) {
        const nuevoMargen = BusinessCalculations.calcularMargenDirecto(
          pedido.precio_venta_total,
          pedido.costo_compra_perfume,
          pedido.costo_envio_asignado,
          gasolinaPorPedido
        );

        const comisionMonto = BusinessCalculations.calcularComisionVendedor(nuevoMargen, pct);
        const gananciaNegocio = BusinessCalculations.calcularGananciaNegocio(nuevoMargen, comisionMonto);

        // Si estaba en RECIBIDO o previo, ponerlo en LISTO_ENTREGA
        let nuevoEstado = pedido.estado;
        if (['REGISTRADO', 'PENDIENTE_COMPRA', 'COMPRADO', 'EN_TRANSITO', 'RECIBIDO'].includes(pedido.estado)) {
          nuevoEstado = 'LISTO_ENTREGA';
        }

        db.prepare(`
          UPDATE pedidos
          SET ruta_entrega_id = ?,
              responsable_entrega_id = ?,
              costo_gasolina_asignado = ?,
              margen_directo = ?,
              ganancia_negocio = ?,
              estado = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rutaId, responsable_id || req.user.id, gasolinaPorPedido, nuevoMargen, gananciaNegocio, nuevoEstado, pedId);

        // Actualizar comisión estimada
        db.prepare(`
          INSERT INTO comisiones (id, pedido_id, vendedor_id, margen_utilizado, porcentaje_aplicado, monto_comision, estado)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')
          ON CONFLICT(pedido_id) DO UPDATE SET
            margen_utilizado = excluded.margen_utilizado,
            monto_comision = excluded.monto_comision
        `).run('COM-' + pedId, pedId, pedido.vendedor_id, nuevoMargen, pct, comisionMonto);
      }
    }
  });

  crearRutaTx();

  logAudit({
    tabla: 'rutas_entrega',
    registroId: rutaId,
    accion: 'CREAR',
    usuarioId: req.user.id,
    detalles: `Creación de ruta ${codigo} con ${totalPedidos} pedidos y RD$${costoGasolina} de gasolina`
  });

  res.status(201).json({
    message: 'Ruta de entrega creada y combustible distribuido correctamente.',
    rutaId,
    gasolinaPorPedido
  });
});

// Completar ruta de entrega
router.put('/:id/completar', authenticateToken, (req, res) => {
  const db = getDb();
  const ruta = db.prepare('SELECT * FROM rutas_entrega WHERE id = ?').get(req.params.id);

  if (!ruta) {
    return res.status(404).json({ error: 'Ruta no encontrada.' });
  }

  db.prepare(`UPDATE rutas_entrega SET estado = 'COMPLETADA' WHERE id = ?`).run(ruta.id);

  res.json({ message: 'Ruta marcada como completada.' });
});

module.exports = router;
