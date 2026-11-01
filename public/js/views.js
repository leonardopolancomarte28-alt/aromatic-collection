/**
 * Aromatic Collection - Vistas y Módulos de Interfaz
 */

window.views = {
  // ==================== 1. DASHBOARD ====================
  dashboard: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando métricas...</div>';

    try {
      const data = await apiFetch('/api/dashboard/metrics');

      if (data.rol === 'ADMIN') {
        const { totalesPedidos, ganancias, comisiones, caja, rendimientoVendedores, pedidosRecientes } = data;

        container.innerHTML = `
          <!-- KPI CARDS PRINCIPALES -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- Dinero Cobrado vs Pendiente -->
            <div class="card-premium p-5 border-l-4 border-l-emerald-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cobrado / Pendiente</span>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">RD$ ${totalesPedidos.dinero_cobrado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">Por cobrar: RD$ ${totalesPedidos.dinero_pendiente.toLocaleString('es-DO', { minimumFractionDigits: 2 })} (${totalesPedidos.pedidos_pendientes_cobro} pedidos)</p>
            </div>

            <!-- Ganancia Neta del Negocio -->
            <div class="card-premium p-5 border-l-4 border-l-amber-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ganancia Neta (Entregados)</span>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-bold text-amber-600 dark:text-amber-400">RD$ ${ganancias.ganancia_total_entregada.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Margen directo total: RD$ ${ganancias.margen_directo_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
            </div>

            <!-- Balance Real en Caja -->
            <div class="card-premium p-5 border-l-4 border-l-blue-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Balance Real en Caja</span>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-bold ${caja.balanceActual >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}">RD$ ${caja.balanceActual.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Entradas: RD$ ${caja.total_entradas.toLocaleString()} | Salidas: RD$ ${caja.total_salidas.toLocaleString()}</p>
            </div>

            <!-- Comisiones de Vendedores -->
            <div class="card-premium p-5 border-l-4 border-l-purple-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Comisiones Ganadas (30%)</span>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-bold text-purple-600 dark:text-purple-400">RD$ ${comisiones.comisiones_ganadas_por_pagar.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Pendientes: RD$ ${comisiones.comisiones_pendientes.toLocaleString()} | Pagadas: RD$ ${comisiones.comisiones_pagadas.toLocaleString()}</p>
            </div>
          </div>

          <!-- FILA DE GRÁFICO Y RESUMEN POR ESTADOS -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <!-- Gráfico de Flujo y Finanzas -->
            <div class="lg:col-span-2 card-premium p-5">
              <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between">
                <span>Resumen Financiero y Operativo</span>
                <span class="text-xs text-slate-400 font-normal">Valores reales acumulados</span>
              </h3>
              <div class="h-64">
                <canvas id="chart-finanzas"></canvas>
              </div>
            </div>

            <!-- Estados del Flujo de Pedidos -->
            <div class="card-premium p-5 flex flex-col justify-between">
              <div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-3">Ciclo de Vida de Pedidos</h3>
                <div class="space-y-2 text-xs" id="lista-estados-conteo">
                  ${data.pedidosPorEstado.length > 0 ? data.pedidosPorEstado.map(e => `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <span class="badge-status badge-${e.estado}">${e.estado.replace('_', ' ')}</span>
                      <span class="font-bold text-slate-700 dark:text-slate-300">${e.cantidad} unid. (RD$ ${Number(e.volumen_ventas || 0).toLocaleString()})</span>
                    </div>
                  `).join('') : '<p class="text-slate-400 text-center py-4">Aún no hay pedidos registrados.</p>'}
                </div>
              </div>
              <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-500 font-medium">
                <span>Total Pedidos Activos:</span>
                <span class="font-bold text-slate-800 dark:text-white">${totalesPedidos.total_pedidos}</span>
              </div>
            </div>
          </div>

          <!-- TABLA: RENDIMIENTO DE VENDEDORES -->
          <div class="card-premium p-5 mb-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>👔</span> Rendimiento del Equipo de Vendedores
              </h3>
              <button onclick="openModal('modal-nuevo-vendedor')" class="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">+ Agregar Vendedor</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th class="p-3">Vendedor</th>
                    <th class="p-3">Pedidos Totales</th>
                    <th class="p-3">Entregados</th>
                    <th class="p-3">Volumen Ventas</th>
                    <th class="p-3">Comisiones Generadas</th>
                    <th class="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  ${rendimientoVendedores.map(v => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td class="p-3 font-semibold text-slate-800 dark:text-white">
                        <div>${v.nombre}</div>
                        <div class="text-[10px] text-slate-400 font-normal">${v.email} • ${v.telefono || 'Sin tel.'}</div>
                      </td>
                      <td class="p-3">${v.total_pedidos}</td>
                      <td class="p-3 font-medium text-emerald-600 dark:text-emerald-400">${v.pedidos_entregados}</td>
                      <td class="p-3 font-bold text-slate-800 dark:text-white">RD$ ${v.volumen_ventas.toLocaleString()}</td>
                      <td class="p-3 font-bold text-amber-600 dark:text-amber-400">RD$ ${v.comisiones_generadas.toLocaleString()}</td>
                      <td class="p-3">
                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${v.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}">
                          ${v.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- TABLA: PEDIDOS RECIENTES -->
          <div class="card-premium p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📦</span> Últimos Pedidos Registrados
              </h3>
              <button onclick="navigate('pedidos')" class="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">Ver Todos →</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th class="p-3">Código</th>
                    <th class="p-3">Cliente</th>
                    <th class="p-3">Perfume</th>
                    <th class="p-3">Vendedor</th>
                    <th class="p-3">Total (RD$)</th>
                    <th class="p-3">Cobrado / Pendiente</th>
                    <th class="p-3">Estado</th>
                    <th class="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  ${pedidosRecientes.map(p => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td class="p-3 font-bold text-amber-600 dark:text-amber-400">${p.codigo_pedido}</td>
                      <td class="p-3 font-medium text-slate-800 dark:text-white">${p.cliente_nombre}</td>
                      <td class="p-3 text-slate-600 dark:text-slate-300">${p.perfume_nombre} (x${p.cantidad})</td>
                      <td class="p-3 text-slate-500">${p.vendedor_nombre}</td>
                      <td class="p-3 font-bold">RD$ ${p.precio_venta_total.toLocaleString()}</td>
                      <td class="p-3">
                        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">RD$ ${p.total_cobrado.toLocaleString()}</span>
                        ${p.balance_pendiente > 0 ? `<span class="block text-red-500 font-semibold text-[10px]">Debe: RD$ ${p.balance_pendiente.toLocaleString()}</span>` : '<span class="block text-emerald-500 text-[10px]">100% Pagado</span>'}
                      </td>
                      <td class="p-3"><span class="badge-status badge-${p.estado}">${p.estado.replace('_', ' ')}</span></td>
                      <td class="p-3 text-right">
                        ${p.balance_pendiente > 0 ? `
                          <button onclick="abrirModalPago('${p.id}', '${p.codigo_pedido}', '${p.cliente_nombre}', ${p.balance_pendiente})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]">Cobrar</button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        // Inicializar gráfico Chart.js
        setTimeout(() => {
          const ctx = document.getElementById('chart-finanzas');
          if (ctx) {
            new Chart(ctx, {
              type: 'bar',
              data: {
                labels: ['Cobrado Clientes', 'Costo Proveedores', 'Fletes Paquetes', 'Gasolina Rutas', 'Ganancia Neta'],
                datasets: [{
                  label: 'Montos en RD$',
                  data: [
                    totalesPedidos.dinero_cobrado,
                    caja.total_salidas - (caja.fletes_totales + caja.gasolina_total + caja.gastos_operativos),
                    caja.fletes_totales,
                    caja.gasolina_total,
                    ganancias.ganancia_total_entregada
                  ],
                  backgroundColor: ['#10b981', '#64748b', '#f59e0b', '#0284c7', '#8b5cf6'],
                  borderRadius: 6
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { grid: { color: '#33415522' }, ticks: { callback: v => 'RD$' + v.toLocaleString() } },
                  x: { grid: { display: false } }
                }
              }
            });
          }
        }, 50);

      } else {
        // VISTA PARA VENDEDOR
        const { resumen, comisiones, pedidosRecientes } = data;
        container.innerHTML = `
          <!-- KPI CARDS VENDEDOR -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="card-premium p-5 border-l-4 border-l-emerald-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Mis Ventas Cobradas</span>
              <div class="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">RD$ ${resumen.dinero_cobrado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
              <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">Pendiente de cobro: RD$ ${resumen.balance_pendiente_clientes.toLocaleString()}</p>
            </div>

            <div class="card-premium p-5 border-l-4 border-l-amber-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Mis Comisiones Ganadas</span>
              <div class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">RD$ ${comisiones.comisiones_por_cobrar.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
              <p class="text-xs text-slate-500 mt-1">Aprobadas listas para cobro al entregar</p>
            </div>

            <div class="card-premium p-5 border-l-4 border-l-blue-500">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Comisiones Pendientes</span>
              <div class="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">RD$ ${comisiones.comisiones_pendientes.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
              <p class="text-xs text-slate-500 mt-1">Se activan al entregar y cobrar 100%</p>
            </div>
          </div>

          <!-- ACCIÓN RÁPIDA: NUEVO PEDIDO -->
          <div class="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shadow-lg">
            <div>
              <h4 class="font-bold text-base">¿Tienes un nuevo pedido de cliente?</h4>
              <p class="text-xs text-amber-100">Regístralo ahora para que el administrador gestione la compra con el proveedor.</p>
            </div>
            <button onclick="openModal('modal-nuevo-pedido')" class="px-4 py-2.5 rounded-xl bg-white text-amber-700 font-bold text-xs hover:bg-amber-50 shadow-md">
              + Registrar Pedido
            </button>
          </div>

          <!-- TABLA: MIS PEDIDOS -->
          <div class="card-premium p-5">
            <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-4">Mis Pedidos Recientes</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th class="p-3">Código</th>
                    <th class="p-3">Cliente</th>
                    <th class="p-3">Perfume</th>
                    <th class="p-3">Precio Total</th>
                    <th class="p-3">Cobrado</th>
                    <th class="p-3">Estado</th>
                    <th class="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  ${pedidosRecientes.map(p => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td class="p-3 font-bold text-amber-600 dark:text-amber-400">${p.codigo_pedido}</td>
                      <td class="p-3 font-medium">${p.cliente_nombre}<span class="block text-[10px] text-slate-400">${p.cliente_telefono}</span></td>
                      <td class="p-3 text-slate-600 dark:text-slate-300">${p.perfume_nombre} (x${p.cantidad})</td>
                      <td class="p-3 font-bold">RD$ ${p.precio_venta_total.toLocaleString()}</td>
                      <td class="p-3">
                        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">RD$ ${p.total_cobrado.toLocaleString()}</span>
                        ${p.balance_pendiente > 0 ? `<span class="block text-red-500 text-[10px]">Debe: RD$ ${p.balance_pendiente.toLocaleString()}</span>` : ''}
                      </td>
                      <td class="p-3"><span class="badge-status badge-${p.estado}">${p.estado.replace('_', ' ')}</span></td>
                      <td class="p-3 text-right">
                        ${p.balance_pendiente > 0 ? `
                          <button onclick="abrirModalPago('${p.id}', '${p.codigo_pedido}', '${p.cliente_nombre}', ${p.balance_pendiente})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]">Cobrar</button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error al cargar dashboard: ${err.message}</div>`;
    }
  },

  // ==================== 2. PEDIDOS ====================
  pedidos: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando pedidos...</div>';

    try {
      const res = await apiFetch('/api/pedidos');
      const pedidos = res.pedidos;
      const isAdmin = state.user.rol === 'ADMIN';

      container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <input type="text" id="filtro-busqueda-pedidos" placeholder="Buscar por código, cliente o perfume..." class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500">
          </div>
          <div class="flex items-center gap-2">
            <select id="filtro-estado-pedidos" class="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
              <option value="">Todos los Estados</option>
              <option value="REGISTRADO">1. Registrado</option>
              <option value="PENDIENTE_COMPRA">2. Pendiente Compra</option>
              <option value="COMPRADO">3. Comprado</option>
              <option value="EN_TRANSITO">4. En Tránsito</option>
              <option value="RECIBIDO">5. Recibido</option>
              <option value="LISTO_ENTREGA">6. Listo para Entregar</option>
              <option value="ENTREGADO">7. Entregado</option>
              <option value="CANCELADO">8. Cancelado</option>
            </select>
            <button onclick="openModal('modal-nuevo-pedido')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
              + Nuevo Pedido
            </button>
          </div>
        </div>

        <div class="card-premium p-5">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left" id="tabla-pedidos">
              <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th class="p-3">Código</th>
                  <th class="p-3">Cliente / Teléfono</th>
                  <th class="p-3">Perfume</th>
                  <th class="p-3">Vendedor</th>
                  <th class="p-3">Precio Venta</th>
                  ${isAdmin ? '<th class="p-3">Costo / Flete / Gasolina</th>' : ''}
                  ${isAdmin ? '<th class="p-3">Margen Directo</th>' : ''}
                  <th class="p-3">Cobrado / Balance</th>
                  <th class="p-3">Estado</th>
                  <th class="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800" id="tbody-pedidos">
                ${pedidos.map(p => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td class="p-3 font-bold text-amber-600 dark:text-amber-400">${p.codigo_pedido}</td>
                    <td class="p-3 font-medium text-slate-800 dark:text-white">
                      <div>${p.cliente_nombre}</div>
                      <div class="text-[10px] text-slate-400 font-normal">${p.cliente_telefono}</div>
                    </td>
                    <td class="p-3 text-slate-600 dark:text-slate-300">
                      <div>${p.perfume_nombre}</div>
                      <div class="text-[10px] text-slate-400 font-normal">Cant: ${p.cantidad} unid.</div>
                    </td>
                    <td class="p-3 text-slate-500">${p.vendedor_nombre}</td>
                    <td class="p-3 font-bold">RD$ ${p.precio_venta_total.toLocaleString()}</td>
                    
                    ${isAdmin ? `
                      <td class="p-3 text-[11px] text-slate-500">
                        <div>Costo: RD$ ${Number(p.costo_compra_perfume || 0).toLocaleString()}</div>
                        <div class="text-[10px]">Flete: RD$ ${Number(p.costo_envio_asignado || 0).toLocaleString()} | Gas: RD$ ${Number(p.costo_gasolina_asignado || 0).toLocaleString()}</div>
                      </td>
                      <td class="p-3 font-bold ${p.margen_directo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
                        RD$ ${Number(p.margen_directo || 0).toLocaleString()}
                        <div class="text-[10px] font-normal text-amber-600 dark:text-amber-400">Com: RD$ ${Number(p.monto_comision || 0).toLocaleString()}</div>
                      </td>
                    ` : ''}

                    <td class="p-3">
                      <span class="text-emerald-600 dark:text-emerald-400 font-semibold">RD$ ${p.total_cobrado.toLocaleString()}</span>
                      ${p.balance_pendiente > 0 
                        ? `<span class="block text-red-500 font-bold text-[10px]">Debe: RD$ ${p.balance_pendiente.toLocaleString()}</span>` 
                        : '<span class="block text-emerald-500 font-medium text-[10px]">100% Pagado</span>'}
                    </td>

                    <td class="p-3">
                      <span class="badge-status badge-${p.estado}">${p.estado.replace('_', ' ')}</span>
                    </td>

                    <td class="p-3 text-right space-x-1 whitespace-nowrap">
                      ${p.balance_pendiente > 0 ? `
                        <button onclick="abrirModalPago('${p.id}', '${p.codigo_pedido}', '${p.cliente_nombre}', ${p.balance_pendiente})" title="Cobrar Saldo" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]">Cobrar</button>
                      ` : ''}

                      ${isAdmin && p.costo_compra_perfume === 0 && p.estado !== 'CANCELADO' ? `
                        <button onclick="abrirModalCompra('${p.id}', '${p.codigo_pedido}', '${p.perfume_nombre}')" title="Registrar Compra Proveedor" class="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px]">Comprar</button>
                      ` : ''}

                      <button onclick="abrirModalCambioEstado('${p.id}', '${p.codigo_pedido}', '${p.estado}')" title="Actualizar Estado" class="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]">Estado</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Filtros de búsqueda
      const inputBuscar = document.getElementById('filtro-busqueda-pedidos');
      const selectEstado = document.getElementById('filtro-estado-pedidos');

      const filtrar = () => {
        const query = inputBuscar.value.toLowerCase();
        const est = selectEstado.value;
        const filas = document.querySelectorAll('#tbody-pedidos tr');

        filas.forEach(fila => {
          const texto = fila.textContent.toLowerCase();
          const matchTexto = !query || texto.includes(query);
          const matchEstado = !est || fila.innerHTML.includes(`badge-${est}`);
          fila.style.display = (matchTexto && matchEstado) ? '' : 'none';
        });
      };

      inputBuscar.addEventListener('input', filtrar);
      selectEstado.addEventListener('change', filtrar);

    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 3. CLIENTES ====================
  clientes: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando clientes...</div>';

    try {
      const res = await apiFetch('/api/clientes');
      const clientes = res.clientes;

      container.innerHTML = `
        <div class="flex items-center justify-between gap-4 mb-6">
          <input type="text" id="filtro-cliente" placeholder="Buscar cliente por nombre o teléfono..." class="max-w-md w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500">
          <button onclick="openModal('modal-nuevo-cliente')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
            + Nuevo Cliente
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="grid-clientes">
          ${clientes.map(c => `
            <div class="card-premium p-5 flex flex-col justify-between cliente-card">
              <div>
                <div class="flex items-start justify-between">
                  <h4 class="font-bold text-slate-800 dark:text-white text-sm cliente-nombre">${c.nombre}</h4>
                  <a href="https://wa.me/${c.telefono.replace(/\D/g, '')}" target="_blank" title="Contactar WhatsApp" class="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform">💬</a>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 cliente-telefono">📞 ${c.telefono}</p>
                <p class="text-xs text-slate-600 dark:text-slate-300 mt-2">📍 ${c.direccion || 'Sin dirección registrada'}</p>
                ${c.notas ? `<p class="text-[11px] text-amber-700 dark:text-amber-400/80 mt-1 italic">"${c.notas}"</p>` : ''}
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <div class="flex justify-between">
                  <span class="text-slate-500">Pedidos realizados:</span>
                  <span class="font-bold text-slate-800 dark:text-white">${c.total_pedidos}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Total comprado:</span>
                  <span class="font-bold text-slate-800 dark:text-white">RD$ ${c.total_comprado.toLocaleString()}</span>
                </div>
                <div class="flex justify-between font-semibold">
                  <span>Balance pendiente:</span>
                  <span class="${c.balance_pendiente > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}">RD$ ${c.balance_pendiente.toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('filtro-cliente').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        document.querySelectorAll('.cliente-card').forEach(card => {
          const nom = card.querySelector('.cliente-nombre').textContent.toLowerCase();
          const tel = card.querySelector('.cliente-telefono').textContent.toLowerCase();
          card.style.display = (nom.includes(val) || tel.includes(val)) ? '' : 'none';
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 4. PAQUETES RECIBIDOS (FLETES) ====================
  paquetes: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando paquetes...</div>';

    try {
      const res = await apiFetch('/api/paquetes');
      const paquetes = res.paquetes;

      container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white">Gestión y Prorrateo Automático de Fletes</h3>
            <p class="text-xs text-slate-500">El costo real del flete se divide equitativamente entre los perfumes contenidos sin duplicar salidas en caja.</p>
          </div>
          <button onclick="openModal('modal-registrar-paquete')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
            + Registrar Paquete
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${paquetes.map(paq => `
            <div class="card-premium p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="font-bold text-base text-amber-600 dark:text-amber-400">${paq.codigo_paquete}</span>
                  <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">${paq.proveedor_nombre || 'Proveedor General'}</span>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-center">
                  <div>
                    <span class="block text-slate-400 text-[10px]">Costo Total Flete</span>
                    <span class="font-bold text-slate-800 dark:text-white text-sm">RD$ ${paq.costo_envio_total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span class="block text-slate-400 text-[10px]">Perfumes en Bulto</span>
                    <span class="font-bold text-slate-800 dark:text-white text-sm">${paq.total_perfumes_recibidos} unid.</span>
                  </div>
                  <div>
                    <span class="block text-slate-400 text-[10px]">Flete / Perfume</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400 text-sm">RD$ ${paq.costo_envio_por_perfume.toFixed(2)}</span>
                  </div>
                </div>

                <div class="mt-3 text-xs">
                  <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Pedidos Vinculados (${paq.pedidos.length}):</span>
                  <div class="space-y-1">
                    ${paq.pedidos.map(p => `
                      <div class="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span class="font-bold text-amber-600">${p.codigo_pedido}</span>
                        <span class="text-slate-600 dark:text-slate-300 truncate max-w-[140px]">${p.perfume_nombre} (x${p.cantidad})</span>
                        <span class="text-slate-400 text-[10px]">${p.cliente_nombre}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Fecha: ${paq.fecha_recepcion || paq.created_at.split(' ')[0]}</span>
                <span>Salida de Caja: REGISTRADA</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 5. RUTAS Y COMBUSTIBLE ====================
  rutas: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando rutas...</div>';

    try {
      const res = await apiFetch('/api/rutas');
      const rutas = res.rutas;
      const isAdmin = state.user.rol === 'ADMIN';

      container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white">Rutas de Entrega y Prorrateo de Gasolina</h3>
            <p class="text-xs text-slate-500">El combustible se divide entre los pedidos entregados en cada ruta sin cobrar delivery al cliente.</p>
          </div>
          ${isAdmin ? `
            <button onclick="openModal('modal-crear-ruta')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
              + Crear Ruta de Entrega
            </button>
          ` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${rutas.map(r => `
            <div class="card-premium p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-bold text-base text-amber-600 dark:text-amber-400">${r.codigo_ruta}</span>
                    <span class="block text-xs text-slate-500">Responsable: ${r.responsable_nombre}</span>
                  </div>
                  <span class="badge-status ${r.estado === 'COMPLETADA' ? 'badge-ENTREGADO' : 'badge-PENDIENTE_COMPRA'}">${r.estado}</span>
                </div>

                <div class="mt-3 grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-center">
                  <div>
                    <span class="block text-slate-400 text-[10px]">Gasto Gasolina</span>
                    <span class="font-bold text-slate-800 dark:text-white text-sm">RD$ ${r.costo_gasolina_total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span class="block text-slate-400 text-[10px]">Entregas en Ruta</span>
                    <span class="font-bold text-slate-800 dark:text-white text-sm">${r.total_pedidos}</span>
                  </div>
                  <div>
                    <span class="block text-slate-400 text-[10px]">Gasolina / Pedido</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400 text-sm">RD$ ${r.gasolina_por_pedido.toFixed(2)}</span>
                  </div>
                </div>

                <div class="mt-3 text-xs">
                  <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Entregas Asociadas:</span>
                  <div class="space-y-1">
                    ${r.pedidos.map(p => `
                      <div class="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span class="font-bold text-amber-600">${p.codigo_pedido}</span>
                          <span class="font-medium text-slate-800 dark:text-white ml-1">${p.cliente_nombre}</span>
                          <span class="block text-[10px] text-slate-400">${p.cliente_direccion || 'Sin dirección'}</span>
                        </div>
                        <div class="text-right">
                          <span class="badge-status badge-${p.estado} text-[10px]">${p.estado}</span>
                          ${p.balance_pendiente > 0 ? `<span class="block text-red-500 font-bold text-[10px]">Cobrar: RD$ ${p.balance_pendiente}</span>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span class="text-slate-400">Fecha: ${r.fecha_ruta}</span>
                ${r.estado !== 'COMPLETADA' ? `
                  <button onclick="completarRuta('${r.id}')" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">Marcar Ruta Completada</button>
                ` : '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Ruta Completada</span>'}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 6. COMISIONES ====================
  comisiones: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando comisiones...</div>';

    try {
      const res = await apiFetch('/api/comisiones');
      const comisiones = res.comisiones;
      const isAdmin = state.user.rol === 'ADMIN';

      container.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mb-6 text-xs flex items-center justify-between">
          <div>
            <span class="font-bold text-amber-800 dark:text-amber-300 block text-sm">Regla Estricta de Comisión (30% sobre margen directo neto):</span>
            <p class="text-slate-600 dark:text-slate-400 mt-0.5">La comisión únicamente se desbloquea en estado GANADA cuando el pedido está <strong>ENTREGADO</strong> y <strong>100% COBRADO</strong> (balance pendiente = 0).</p>
          </div>
        </div>

        <div class="card-premium p-5">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th class="p-3">Pedido</th>
                  <th class="p-3">Vendedor</th>
                  <th class="p-3">Perfume / Cliente</th>
                  <th class="p-3">Margen Utilizado</th>
                  <th class="p-3">% Aplicado</th>
                  <th class="p-3">Monto Comisión</th>
                  <th class="p-3">Estado</th>
                  ${isAdmin ? '<th class="p-3 text-right">Acción</th>' : ''}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                ${comisiones.map(c => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td class="p-3 font-bold text-amber-600 dark:text-amber-400">${c.codigo_pedido}</td>
                    <td class="p-3 font-semibold text-slate-800 dark:text-white">${c.vendedor_nombre}</td>
                    <td class="p-3">
                      <div>${c.perfume_nombre}</div>
                      <div class="text-[10px] text-slate-400">${c.cliente_nombre}</div>
                    </td>
                    <td class="p-3 font-semibold">RD$ ${Number(c.margen_utilizado || 0).toLocaleString()}</td>
                    <td class="p-3 font-bold">${c.porcentaje_aplicado}%</td>
                    <td class="p-3 font-bold text-emerald-600 dark:text-emerald-400 text-sm">RD$ ${c.monto_comision.toFixed(2)}</td>
                    <td class="p-3">
                      <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.estado === 'GANADA' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        c.estado === 'PAGADA' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                        c.estado === 'ANULADA' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }">
                        ${c.estado}
                      </span>
                    </td>
                    ${isAdmin ? `
                      <td class="p-3 text-right">
                        ${c.estado === 'GANADA' ? `
                          <button onclick="pagarComision('${c.id}', '${c.vendedor_nombre}', ${c.monto_comision})" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md">
                            Pagar Comisión
                          </button>
                        ` : (c.estado === 'PAGADA' ? '<span class="text-purple-500 font-medium">✓ Desembolsada</span>' : '<span class="text-slate-400 text-[10px]">No elegible aún</span>')}
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 7. CAJA Y FINANZAS ====================
  caja: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando módulo de caja...</div>';

    try {
      const resMov = await apiFetch('/api/caja/movimientos');
      const resComp = await apiFetch('/api/caja/comparativa');

      const { movimientos, totales } = resMov;
      const { flujoCajaReal, rentabilidadAnaliticaPedidos, principioNoDuplicidad } = resComp;

      container.innerHTML = `
        <!-- ENCABEZADO DE CAJA Y BALANCE -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="card-premium p-5 border-l-4 border-l-emerald-500">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Entradas Reales de Efectivo</span>
            <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">RD$ ${totales.totalEntradas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
            <p class="text-xs text-slate-400 mt-1">Cobros de adelantos y liquidaciones de clientes</p>
          </div>

          <div class="card-premium p-5 border-l-4 border-l-red-500">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Salidas Reales de Efectivo</span>
            <div class="text-2xl font-bold text-red-500 mt-2">RD$ ${totales.totalSalidas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
            <p class="text-xs text-slate-400 mt-1">Proveedores, fletes, gasolina, comisiones y gastos</p>
          </div>

          <div class="card-premium p-5 border-l-4 border-l-blue-500">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Balance Disponible en Caja</span>
            <div class="text-2xl font-bold ${totales.balanceActual >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'} mt-2">RD$ ${totales.balanceActual.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
            <p class="text-xs text-slate-400 mt-1">Efectivo físico y en cuenta</p>
          </div>
        </div>

        <!-- EXPLICACIÓN Y VERIFICACIÓN DE NO DUPLICIDAD DE GASTOS -->
        <div class="card-premium p-5 mb-6 border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <h4 class="font-bold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
            <span>🛡️</span> Principio de Separación Contable (Cero Duplicación de Costos)
          </h4>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1">${principioNoDuplicidad.explicacion}</p>
          
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span class="text-slate-400 block text-[10px]">Fletes Pagados en Caja</span>
              <span class="font-bold text-slate-800 dark:text-white">RD$ ${principioNoDuplicidad.fletesEnCaja.toLocaleString()}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span class="text-slate-400 block text-[10px]">Fletes Imputados a Pedidos</span>
              <span class="font-bold text-slate-800 dark:text-white">RD$ ${principioNoDuplicidad.fletesAsignadosEnPedidos.toLocaleString()}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span class="text-slate-400 block text-[10px]">Gasolina Pagada en Caja</span>
              <span class="font-bold text-slate-800 dark:text-white">RD$ ${principioNoDuplicidad.gasolinaEnCaja.toLocaleString()}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span class="text-slate-400 block text-[10px]">Gasolina Imputada a Pedidos</span>
              <span class="font-bold text-slate-800 dark:text-white">RD$ ${principioNoDuplicidad.gasolinaAsignadaEnPedidos.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- TABLA: LIBRO DIARIO DE MOVIMIENTOS DE CAJA -->
        <div class="card-premium p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>📖</span> Libro Diario de Movimientos de Caja
            </h3>
            <button onclick="openModal('modal-nuevo-movimiento-caja')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
              + Registrar Gasto / Entrada Manual
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th class="p-3">Fecha</th>
                  <th class="p-3">Tipo</th>
                  <th class="p-3">Categoría</th>
                  <th class="p-3">Descripción</th>
                  <th class="p-3">Método</th>
                  <th class="p-3">Monto</th>
                  <th class="p-3">Registrado Por</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                ${movimientos.map(m => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td class="p-3 text-slate-500 whitespace-nowrap">${m.fecha}</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'}">
                        ${m.tipo}
                      </span>
                    </td>
                    <td class="p-3 font-semibold text-slate-700 dark:text-slate-300">${m.categoria}</td>
                    <td class="p-3 text-slate-800 dark:text-white">${m.descripcion}</td>
                    <td class="p-3 text-slate-400">${m.metodo_pago}</td>
                    <td class="p-3 font-bold ${m.tipo === 'ENTRADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}">
                      ${m.tipo === 'ENTRADA' ? '+' : '-'} RD$ ${m.monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td class="p-3 text-slate-400">${m.registrado_por_nombre || 'Sistema'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 8. VENDEDORES ====================
  vendedores: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando vendedores...</div>';

    try {
      const res = await apiFetch('/api/vendedores');
      const vendedores = res.vendedores;

      container.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white">Equipo de Vendedores</h3>
            <p class="text-xs text-slate-500">Crea credenciales y administra el estado de los vendedores. No tienen acceso a costos ni finanzas.</p>
          </div>
          <button onclick="openModal('modal-nuevo-vendedor')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
            + Nuevo Vendedor
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${vendedores.map(v => `
            <div class="card-premium p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <h4 class="font-bold text-slate-800 dark:text-white text-base">${v.nombre}</h4>
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${v.activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'}">
                    ${v.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-1">✉ ${v.email}</p>
                <p class="text-xs text-slate-500">📞 ${v.telefono || 'Sin teléfono'}</p>

                <div class="mt-4 grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <span class="text-slate-400 text-[10px] block">Pedidos Asignados</span>
                    <span class="font-bold text-slate-800 dark:text-white">${v.total_pedidos} (${v.pedidos_entregados} entregados)</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[10px] block">Volumen Ventas</span>
                    <span class="font-bold text-slate-800 dark:text-white">RD$ ${v.volumen_ventas.toLocaleString()}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[10px] block">Comisión Pendiente</span>
                    <span class="font-bold text-amber-600">RD$ ${v.comisiones_pendientes.toLocaleString()}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[10px] block">Comisión Ganada</span>
                    <span class="font-bold text-emerald-600">RD$ ${v.comisiones_por_pagar.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button onclick="abrirModalEditarVendedor('${v.id}', '${v.nombre.replace(/'/g, "\\'")}', '${v.email.replace(/'/g, "\\'")}', '${(v.telefono || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm">
                  ✏️ Editar y Clave
                </button>
                <button onclick="toggleActivoVendedor('${v.id}')" class="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium">
                  ${v.activo ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 9. PROVEEDORES ====================
  proveedores: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando proveedores...</div>';

    try {
      const res = await apiFetch('/api/proveedores');
      const proveedores = res.proveedores;

      container.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white">Proveedores de Perfumería</h3>
            <p class="text-xs text-slate-500">Proveedores a los cuales se les emiten compras bajo pedido y despachan paquetes.</p>
          </div>
          <button onclick="openModal('modal-nuevo-proveedor')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
            + Nuevo Proveedor
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${proveedores.map(p => `
            <div class="card-premium p-5 flex flex-col justify-between">
              <div>
                <h4 class="font-bold text-slate-800 dark:text-white text-base">${p.nombre}</h4>
                <p class="text-xs text-slate-500 mt-1">👤 Contacto: ${p.contacto || 'Sin contacto'}</p>
                <p class="text-xs text-slate-500">📞 ${p.telefono || 'Sin teléfono'}</p>
                <p class="text-xs text-slate-600 dark:text-slate-300 mt-2">📍 ${p.direccion || 'Sin dirección'}</p>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400">
                <span>Paquetes Recibidos: ${p.paquetes_recibidos || 0}</span>
                <span>Pedidos: ${p.total_pedidos_asociados || 0}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  },

  // ==================== 10. CONFIGURACIÓN ====================
  configuracion: async () => {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400">Cargando configuración...</div>';

    try {
      const res = await apiFetch('/api/configuracion');
      const cfg = res.configuraciones;

      container.innerHTML = `
        <div class="max-w-2xl space-y-6">
          <!-- Tarjeta Mi Perfil -->
          <div class="card-premium p-6">
            <h3 class="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between">
              <span class="flex items-center gap-2"><span>👤</span> Mis Datos de Usuario y Contraseña</span>
              <button onclick="abrirModalPerfil()" class="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline">Abrir Formulario Completo ↗</button>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div>
                <span class="text-slate-400 block text-[10px]">Nombre:</span>
                <span class="font-bold text-slate-800 dark:text-white" id="cfg-perfil-nombre">${state.user.nombre}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Usuario / Correo:</span>
                <span class="font-bold text-slate-800 dark:text-white" id="cfg-perfil-email">${state.user.email}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Rol:</span>
                <span class="font-bold text-amber-600">${state.user.rol}</span>
              </div>
            </div>
            <button onclick="abrirModalPerfil()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs shadow-sm">
              Editar Mis Datos o Cambiar Mi Contraseña
            </button>
          </div>

          <div class="card-premium p-6">
            <h3 class="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span>⚙️</span> Reglas y Parámetros del Negocio
            </h3>
            
            <form id="form-configuracion" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Nombre Comercial de la Plataforma</label>
                <input type="text" id="cfg-nombre-negocio" value="${cfg.nombre_negocio || 'LuxePerfumes'}" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm">
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Porcentaje de Comisión para Vendedores (%) *</label>
                <input type="number" id="cfg-comision-default" min="0" max="100" step="0.5" value="${cfg.comision_porcentaje_default || '30'}" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold">
                <p class="text-[11px] text-slate-500 mt-1">Este porcentaje se aplica sobre el margen directo neto (Precio venta - Costo - Flete - Gasolina) una vez entregado y cobrado 100%.</p>
              </div>

              <div class="pt-2">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-md">
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>

          <div class="card-premium p-6">
            <h3 class="text-base font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <span>💾</span> Copia de Seguridad y Respaldo
            </h3>
            <p class="text-xs text-slate-500 mb-4">Descarga un archivo JSON con la copia íntegra de todas las tablas de la base de datos (pedidos, clientes, finanzas, caja, auditoría).</p>
            
            <a href="/api/configuracion/backup" target="_blank" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs shadow-md">
              <span>📥 Descargar Copia de Seguridad Completa (Backup)</span>
            </a>
          </div>
        </div>
      `;

      document.getElementById('form-configuracion').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await apiFetch('/api/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
              nombre_negocio: document.getElementById('cfg-nombre-negocio').value,
              comision_porcentaje_default: document.getElementById('cfg-comision-default').value
            })
          });
          showToast('Configuraciones actualizadas con éxito.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    }
  }
};

// ==================== ACCIONES ADICIONALES ====================
async function toggleActivoVendedor(vendedorId) {
  try {
    const res = await apiFetch(`/api/vendedores/${vendedorId}/toggle-activo`, { method: 'PUT' });
    showToast(res.message, 'success');
    window.views.vendedores();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function completarRuta(rutaId) {
  try {
    const res = await apiFetch(`/api/rutas/${rutaId}/completar`, { method: 'PUT' });
    showToast(res.message, 'success');
    window.views.rutas();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function pagarComision(comisionId, vendedorNombre, monto) {
  if (!confirm(`¿Confirmas el desembolso de RD$${parseFloat(monto).toFixed(2)} de comisión a ${vendedorNombre}? Esto registrará una salida en Caja.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/comisiones/${comisionId}/pagar`, { method: 'POST' });
    showToast(res.message, 'success');
    window.views.comisiones();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
