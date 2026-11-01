/**
 * Motor de Cálculos y Reglas Financieras para Plataforma de Perfumes Bajo Pedido
 * Moneda: Pesos Dominicanos (RD$)
 */

class BusinessCalculations {
  /**
   * 1. Distribución de Costo de Envío por Paquete
   * Formula: Costo de envío por perfume = costo total de envío ÷ cantidad total de perfumes
   * @param {number} costoEnvioTotal 
   * @param {number} totalPerfumes 
   * @returns {number} Costo unitario de flete redondeado a 2 decimales
   */
  static calcularCostoEnvioPorPerfume(costoEnvioTotal, totalPerfumes) {
    if (!totalPerfumes || totalPerfumes <= 0) {
      throw new Error("El total de perfumes en el paquete debe ser mayor a cero.");
    }
    if (costoEnvioTotal < 0) {
      throw new Error("El costo de envío no puede ser negativo.");
    }
    return Number((costoEnvioTotal / totalPerfumes).toFixed(2));
  }

  /**
   * 2. Distribución de Gasolina por Ruta de Entrega
   * Formula: Gasolina asignada por pedido = gasto total de gasolina de la ruta ÷ cantidad de pedidos
   * @param {number} gastoGasolinaTotal 
   * @param {number} totalPedidos 
   * @returns {number} Costo de gasolina asignado por pedido
   */
  static calcularGasolinaPorPedido(gastoGasolinaTotal, totalPedidos) {
    if (!totalPedidos || totalPedidos <= 0) {
      throw new Error("La cantidad de pedidos en la ruta debe ser mayor a cero.");
    }
    if (gastoGasolinaTotal < 0) {
      throw new Error("El gasto de gasolina no puede ser negativo.");
    }
    return Number((gastoGasolinaTotal / totalPedidos).toFixed(2));
  }

  /**
   * 3. Margen Directo de un Pedido
   * Formula obligatoria: Precio de venta − costo del perfume − envío asignado − gasolina asignada
   * @param {number} precioVenta 
   * @param {number} costoPerfume 
   * @param {number} envioAsignado 
   * @param {number} gasolinaAsignada 
   * @returns {number} Margen directo resultante
   */
  static calcularMargenDirecto(precioVenta, costoPerfume, envioAsignado, gasolinaAsignada) {
    const margen = Number(precioVenta) - Number(costoPerfume) - Number(envioAsignado) - Number(gasolinaAsignada);
    return Number(margen.toFixed(2));
  }

  /**
   * 4. Comisión del Vendedor
   * Formula: Margen directo × porcentaje de comisión (ej. 30%)
   * @param {number} margenDirecto 
   * @param {number} porcentajeComision - Por defecto 30%
   * @returns {number} Monto de comisión
   */
  static calcularComisionVendedor(margenDirecto, porcentajeComision = 30) {
    if (margenDirecto <= 0) return 0;
    const comision = margenDirecto * (Number(porcentajeComision) / 100);
    return Number(comision.toFixed(2));
  }

  /**
   * 5. Ganancia Neta del Negocio
   * Formula: Margen directo − comisión
   * @param {number} margenDirecto 
   * @param {number} comision 
   * @returns {number} Ganancia neta para el negocio
   */
  static calcularGananciaNegocio(margenDirecto, comision) {
    const ganancia = Number(margenDirecto) - Number(comision);
    return Number(ganancia.toFixed(2));
  }

  /**
   * 6. Evaluación de Elegibilidad de Comisión
   * Regla de Negocio: La comisión solo se genera cuando se cumplen AMBAS condiciones:
   *  - El pedido ha sido ENTREGADO
   *  - El cliente ha pagado el total (Balance Pendiente === 0)
   * 
   * @param {string} estadoPedido - 'ENTREGADO', etc.
   * @param {number} balancePendiente - 0 si está pagado
   * @returns {{ esElegible: boolean, estadoComision: 'PENDIENTE' | 'GANADA' | 'ANULADA', motivo: string }}
   */
  static evaluarElegibilidadComision(estadoPedido, balancePendiente) {
    if (estadoPedido === 'CANCELADO') {
      return {
        esElegible: false,
        estadoComision: 'ANULADA',
        motivo: 'El pedido fue cancelado; no procede comisión.'
      };
    }

    const estaEntregado = (estadoPedido === 'ENTREGADO');
    const estaPagadoTotal = (Number(balancePendiente) <= 0);

    if (estaEntregado && estaPagadoTotal) {
      return {
        esElegible: true,
        estadoComision: 'GANADA',
        motivo: 'Pedido entregado y 100% cobrado. Comisión aprobada y lista para pago.'
      };
    }

    const motivos = [];
    if (!estaEntregado) motivos.push('El pedido no ha sido entregado aún');
    if (!estaPagadoTotal) motivos.push(`Tiene un balance pendiente de RD$${balancePendiente.toFixed(2)}`);

    return {
      esElegible: false,
      estadoComision: 'PENDIENTE',
      motivo: motivos.join(' y ')
    };
  }

  /**
   * 7. Resumen Completo de Rentabilidad de un Pedido
   */
  static liquidarRentabilidadPedido({
    precioVenta,
    costoPerfume,
    envioAsignado = 0,
    gasolinaAsignada = 0,
    porcentajeComision = 30,
    estadoPedido,
    totalCobrado,
  }) {
    const precio = Number(precioVenta);
    const cobrado = Number(totalCobrado || 0);
    const balancePendiente = Number(Math.max(0, precio - cobrado).toFixed(2));
    
    const margenDirecto = this.calcularMargenDirecto(
      precio,
      costoPerfume,
      envioAsignado,
      gasolinaAsignada
    );

    const comisionCalculada = this.calcularComisionVendedor(margenDirecto, porcentajeComision);
    const gananciaNegocio = this.calcularGananciaNegocio(margenDirecto, comisionCalculada);

    const evaluacionComision = this.evaluarElegibilidadComision(estadoPedido, balancePendiente);

    return {
      precioVenta: precio,
      totalCobrado: cobrado,
      balancePendiente,
      costoPerfume: Number(costoPerfume),
      envioAsignado: Number(envioAsignado),
      gasolinaAsignada: Number(gasolinaAsignada),
      margenDirecto,
      porcentajeComision,
      comisionEstimada: comisionCalculada,
      comisionEstado: evaluacionComision.estadoComision,
      comisionPagadera: evaluacionComision.esElegible ? comisionCalculada : 0,
      gananciaNegocio,
      motivoComision: evaluacionComision.motivo
    };
  }
}

module.exports = BusinessCalculations;
