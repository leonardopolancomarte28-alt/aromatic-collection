/**
 * Aromatic Collection - Controlador Principal SPA
 */

const state = {
  user: null,
  token: localStorage.getItem('luxe_token') || null,
  activeView: 'dashboard',
  theme: localStorage.getItem('luxe_theme') || 'light'
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();

  if (state.token) {
    await checkAuth();
  } else {
    showLogin();
  }
});

// ==================== TEMA CLARO / OSCURO ====================
function initTheme() {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-icon').textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-icon').textContent = '🌙';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('luxe_theme', state.theme);
  initTheme();
}

// ==================== AUTENTICACIÓN Y SESIÓN ====================
async function checkAuth() {
  try {
    const res = await apiFetch('/api/auth/me');
    if (res && res.user) {
      state.user = res.user;
      hideLogin();
      renderApp();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
}

function hideLogin() {
  document.getElementById('login-view').classList.add('hidden');
}

function fillLogin(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
}

async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('luxe_token');
  state.token = null;
  state.user = null;
  showLogin();
}

// ==================== CLIENTE API FETCH ====================
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
    handleLogout();
    throw new Error('Sesión expirada.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error al procesar la solicitud.');
  }

  return data;
}

// ==================== RENDERIZADO DEL ENTORNO SEGÚN ROL ====================
function renderApp() {
  const user = state.user;
  document.getElementById('user-display-name').textContent = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre.charAt(0).toUpperCase();
  document.getElementById('user-role-badge').textContent = user.rol;
  document.getElementById('user-role-badge').className = user.rol === 'ADMIN'
    ? 'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase'
    : 'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase';

  // Mostrar selector de vendedor en modal si es Admin
  const grpVendedor = document.getElementById('grupo-select-vendedor');
  if (user.rol === 'ADMIN') {
    grpVendedor.classList.remove('hidden');
  } else {
    grpVendedor.classList.add('hidden');
  }

  renderNavigation();
  navigate(state.activeView || 'dashboard');
}

function renderNavigation() {
  const isAdmin = state.user.rol === 'ADMIN';
  const navContainer = document.getElementById('desktop-nav');
  const mobileNavContainer = document.getElementById('mobile-nav');
  const drawerContainer = document.getElementById('mobile-drawer-links');

  // Menús para Administrador
  const adminLinks = [
    { id: 'dashboard', label: 'Panel Principal', icon: '📊' },
    { id: 'pedidos', label: 'Gestión de Pedidos', icon: '📦' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'paquetes', label: 'Paquetes y Fletes', icon: '🚚' },
    { id: 'rutas', label: 'Rutas y Gasolina', icon: '🚗' },
    { id: 'comisiones', label: 'Comisiones (30%)', icon: '💼' },
    { id: 'caja', label: 'Caja y Finanzas', icon: '💰' },
    { id: 'vendedores', label: 'Equipo de Vendedores', icon: '👔' },
    { id: 'proveedores', label: 'Proveedores', icon: '🏭' },
    { id: 'configuracion', label: 'Configuración', icon: '⚙️' }
  ];

  // Menús para Vendedor (Protegido: sin finanzas ni proveedores ni compras)
  const vendedorLinks = [
    { id: 'dashboard', label: 'Mi Panel', icon: '📊' },
    { id: 'pedidos', label: 'Mis Pedidos', icon: '📦' },
    { id: 'clientes', label: 'Mis Clientes', icon: '👥' },
    { id: 'rutas', label: 'Mis Entregas Asignadas', icon: '🚗' },
    { id: 'comisiones', label: 'Mis Comisiones', icon: '💼' }
  ];

  const links = isAdmin ? adminLinks : vendedorLinks;

  // Render Sidebar Desktop
  navContainer.innerHTML = links.map(link => `
    <button onclick="navigate('${link.id}')" id="nav-${link.id}" class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
      <span class="text-lg">${link.icon}</span>
      <span>${link.label}</span>
    </button>
  `).join('');

  // Render Mobile Bottom Bar (Top 4 links + Menú)
  const mobileTopLinks = links.slice(0, 4);
  mobileNavContainer.innerHTML = mobileTopLinks.map(link => `
    <button onclick="navigate('${link.id}')" id="mob-nav-${link.id}" class="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400">
      <span class="text-xl">${link.icon}</span>
      <span class="text-[10px] font-semibold mt-0.5 truncate max-w-[60px]">${link.label.split(' ')[0]}</span>
    </button>
  `).join('') + `
    <button onclick="toggleMobileDrawer()" class="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400">
      <span class="text-xl">☰</span>
      <span class="text-[10px] font-semibold mt-0.5">Menú</span>
    </button>
  `;

  // Render Mobile Drawer Links
  drawerContainer.innerHTML = links.map(link => `
    <button onclick="navigate('${link.id}'); toggleMobileDrawer();" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
      <span class="text-lg">${link.icon}</span>
      <span>${link.label}</span>
    </button>
  `).join('');
}

// ==================== ENRUTAMIENTO Y VISTAS ====================
function navigate(viewId) {
  state.activeView = viewId;

  // Actualizar estilos activos en sidebar
  document.querySelectorAll('#desktop-nav button').forEach(btn => {
    btn.classList.remove('bg-amber-600', 'text-white', 'shadow-md', 'shadow-amber-600/30');
    btn.classList.add('text-slate-300');
  });

  const activeBtn = document.getElementById(`nav-${viewId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-300');
    activeBtn.classList.add('bg-amber-600', 'text-white', 'shadow-md', 'shadow-amber-600/30');
  }

  // Título de la vista
  const titles = {
    dashboard: state.user.rol === 'ADMIN' ? 'Panel Principal de Control' : 'Mi Panel de Vendedor',
    pedidos: 'Control y Seguimiento de Pedidos',
    clientes: 'Directorio de Clientes',
    paquetes: 'Recepción de Paquetes y Distribución de Flete',
    rutas: 'Rutas de Entrega y Asignación de Combustible',
    comisiones: 'Liquidación de Comisiones de Vendedores',
    caja: 'Control de Caja y Flujo de Efectivo',
    vendedores: 'Gestión y Rendimiento del Equipo de Ventas',
    proveedores: 'Proveedores y Compras',
    configuracion: 'Configuración y Respaldo del Negocio'
  };

  document.getElementById('view-title').textContent = titles[viewId] || 'Aromatic Collection';

  // Despachar renderizado de vista
  if (window.views && window.views[viewId]) {
    window.views[viewId]();
  }
}

// ==================== NOTIFICACIONES TOAST ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const colors = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-red-600 text-white border-red-500',
    info: 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-medium border transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">${icons[type] || '•'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  // Animar entrada
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Salida automática
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== MODALES ====================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    // Pre-cargar datos dinámicos según modal
    if (id === 'modal-nuevo-pedido') prepararModalNuevoPedido();
    if (id === 'modal-registrar-paquete') prepararModalPaquete();
    if (id === 'modal-crear-ruta') prepararModalRuta();
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  drawer.classList.toggle('hidden');
}

// ==================== LISTENERS Y FORMULARIOS ====================
function setupEventListeners() {
  // Login Submit
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login-submit');

    try {
      btn.disabled = true;
      btn.innerHTML = '<span>Verificando...</span>';

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('luxe_token', res.token);

      hideLogin();
      renderApp();
      showToast(`¡Bienvenido, ${res.user.nombre}!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Iniciar Sesión</span>';
    }
  });

  // Calculadora en vivo de Nuevo Pedido
  const inputPrecio = document.getElementById('pedido-precio-unitario');
  const inputCant = document.getElementById('pedido-cantidad');
  const inputAdelanto = document.getElementById('pedido-adelanto');

  const updateCalculoPedido = () => {
    const cant = parseInt(inputCant.value) || 1;
    const precio = parseFloat(inputPrecio.value) || 0;
    const adelanto = parseFloat(inputAdelanto.value) || 0;
    const total = cant * precio;
    const balance = Math.max(0, total - adelanto);

    document.getElementById('calc-total-pedido').textContent = `RD$ ${total.toFixed(2)}`;
    document.getElementById('calc-balance-pedido').textContent = `RD$ ${balance.toFixed(2)}`;
  };

  inputPrecio.addEventListener('input', updateCalculoPedido);
  inputCant.addEventListener('input', updateCalculoPedido);
  inputAdelanto.addEventListener('input', updateCalculoPedido);

  // Calculadora en vivo de Prorrateo de Paquetes
  const inputCostoPaquete = document.getElementById('paquete-costo-total');
  const inputPerfumesPaquete = document.getElementById('paquete-total-perfumes');

  const updateProrrateoPaquete = () => {
    const costo = parseFloat(inputCostoPaquete.value) || 0;
    const cant = parseInt(inputPerfumesPaquete.value) || 1;
    const porPerfume = cant > 0 ? (costo / cant) : 0;
    document.getElementById('calc-envio-por-perfume').textContent = `RD$ ${porPerfume.toFixed(2)} por perfume`;
  };

  inputCostoPaquete.addEventListener('input', updateProrrateoPaquete);
  inputPerfumesPaquete.addEventListener('input', updateProrrateoPaquete);

  // Calculadora en vivo de Prorrateo de Gasolina
  const inputGasolina = document.getElementById('ruta-costo-gasolina');
  inputGasolina.addEventListener('input', () => {
    const checked = document.querySelectorAll('#lista-pedidos-para-ruta input[type="checkbox"]:checked').length;
    const costo = parseFloat(inputGasolina.value) || 0;
    const porPedido = checked > 0 ? (costo / checked) : 0;
    document.getElementById('calc-gasolina-por-pedido').textContent = `RD$ ${porPedido.toFixed(2)} por pedido`;
  });

  // Form Nuevo Pedido Submit
  document.getElementById('form-nuevo-pedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = {
        cliente_id: document.getElementById('pedido-cliente-id').value,
        perfume_nombre: document.getElementById('pedido-perfume-nombre').value,
        cantidad: parseInt(document.getElementById('pedido-cantidad').value) || 1,
        precio_venta_unitario: parseFloat(document.getElementById('pedido-precio-unitario').value),
        adelanto_inicial: parseFloat(document.getElementById('pedido-adelanto').value) || 0,
        metodo_pago: document.getElementById('pedido-metodo-pago').value,
        notas: document.getElementById('pedido-notas').value
      };

      if (state.user.rol === 'ADMIN') {
        const vendId = document.getElementById('pedido-vendedor-id').value;
        if (vendId) data.vendedor_id = vendId;
      }

      const res = await apiFetch('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast(`Pedido ${res.codigoPedido} registrado exitosamente.`, 'success');
      closeModal('modal-nuevo-pedido');
      document.getElementById('form-nuevo-pedido').reset();
      navigate('pedidos');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Registrar Pago Submit
  document.getElementById('form-registrar-pago').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = {
        pedido_id: document.getElementById('pago-pedido-id').value,
        monto: parseFloat(document.getElementById('pago-monto').value),
        metodo_pago: document.getElementById('pago-metodo').value,
        tipo: document.getElementById('pago-tipo').value
      };

      await apiFetch('/api/pagos', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast('Cobro registrado y caja actualizada exitosamente.', 'success');
      closeModal('modal-registrar-pago');
      navigate(state.activeView);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Registrar Compra Perfume Submit
  document.getElementById('form-registrar-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const pedidoId = document.getElementById('compra-pedido-id').value;
      const data = {
        proveedor_id: document.getElementById('compra-proveedor-id').value,
        costo_compra_perfume: parseFloat(document.getElementById('compra-costo').value),
        referencia_compra: document.getElementById('compra-referencia').value
      };

      await apiFetch(`/api/pedidos/${pedidoId}/registrar-compra`, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast('Compra registrada, salida de caja deducida y estado actualizado.', 'success');
      closeModal('modal-registrar-compra');
      navigate('pedidos');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Registrar Paquete Submit
  document.getElementById('form-registrar-paquete').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const checkboxes = document.querySelectorAll('#lista-pedidos-para-paquete input[type="checkbox"]:checked');
      const pedidos_ids = Array.from(checkboxes).map(cb => cb.value);

      const data = {
        codigo_paquete: document.getElementById('paquete-codigo').value,
        proveedor_id: document.getElementById('paquete-proveedor-id').value,
        costo_envio_total: parseFloat(document.getElementById('paquete-costo-total').value),
        total_perfumes_recibidos: parseInt(document.getElementById('paquete-total-perfumes').value),
        pedidos_ids,
        observaciones: document.getElementById('paquete-observaciones').value
      };

      const res = await apiFetch('/api/paquetes', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast(`Paquete guardado. Flete de RD$${res.costoPorPerfume}/u asignado a los pedidos.`, 'success');
      closeModal('modal-registrar-paquete');
      navigate('paquetes');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Crear Ruta Submit
  document.getElementById('form-crear-ruta').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const checkboxes = document.querySelectorAll('#lista-pedidos-para-ruta input[type="checkbox"]:checked');
      const pedidos_ids = Array.from(checkboxes).map(cb => cb.value);

      if (pedidos_ids.length === 0) {
        showToast('Debes seleccionar al menos un pedido para la ruta de entrega.', 'error');
        return;
      }

      const data = {
        responsable_id: document.getElementById('ruta-responsable-id').value,
        fecha_ruta: document.getElementById('ruta-fecha').value,
        costo_gasolina_total: parseFloat(document.getElementById('ruta-costo-gasolina').value) || 0,
        pedidos_ids,
        observaciones: document.getElementById('ruta-observaciones').value
      };

      const res = await apiFetch('/api/rutas', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast(`Ruta creada exitosamente (RD$${res.gasolinaPorPedido}/pedido asignado).`, 'success');
      closeModal('modal-crear-ruta');
      navigate('rutas');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Nuevo Cliente Submit
  document.getElementById('form-nuevo-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: document.getElementById('cliente-nombre').value,
        telefono: document.getElementById('cliente-telefono').value,
        direccion: document.getElementById('cliente-direccion').value,
        notas: document.getElementById('cliente-notas').value
      };

      await apiFetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast('Cliente guardado satisfactoriamente.', 'success');
      closeModal('modal-nuevo-cliente');
      document.getElementById('form-nuevo-cliente').reset();
      prepararModalNuevoPedido();
      if (state.activeView === 'clientes') navigate('clientes');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Nuevo Vendedor Submit
  document.getElementById('form-nuevo-vendedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: document.getElementById('vendedor-nombre').value,
        email: document.getElementById('vendedor-email').value,
        password: document.getElementById('vendedor-password').value,
        telefono: document.getElementById('vendedor-telefono').value
      };

      await apiFetch('/api/vendedores', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast('Nuevo vendedor registrado con éxito.', 'success');
      closeModal('modal-nuevo-vendedor');
      document.getElementById('form-nuevo-vendedor').reset();
      navigate('vendedores');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Nuevo Movimiento Caja Submit
  document.getElementById('form-movimiento-caja').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = {
        tipo: document.getElementById('caja-tipo').value,
        categoria: document.getElementById('caja-categoria').value,
        monto: parseFloat(document.getElementById('caja-monto').value),
        descripcion: document.getElementById('caja-descripcion').value
      };

      await apiFetch('/api/caja/movimientos', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      showToast('Movimiento registrado en caja.', 'success');
      closeModal('modal-nuevo-movimiento-caja');
      document.getElementById('form-movimiento-caja').reset();
      navigate('caja');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Cambio Estado Pedido Submit
  document.getElementById('form-cambiar-estado').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const pedidoId = document.getElementById('estado-pedido-id').value;
      const nuevoEstado = document.getElementById('estado-nuevo').value;
      const motivo = document.getElementById('estado-motivo').value;

      await apiFetch(`/api/pedidos/${pedidoId}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ nuevo_estado: nuevoEstado, motivo })
      });

      showToast(`Estado actualizado a ${nuevoEstado}.`, 'success');
      closeModal('modal-cambiar-estado');
      navigate(state.activeView);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Mostrar/Ocultar motivo si selecciona CANCELADO
  document.getElementById('estado-nuevo').addEventListener('change', (e) => {
    const cont = document.getElementById('motivo-cancelacion-container');
    if (e.target.value === 'CANCELADO') {
      cont.classList.remove('hidden');
    } else {
      cont.classList.add('hidden');
    }
  });

  // Form Editar Mi Perfil Submit
  const formEditarPerfil = document.getElementById('form-editar-perfil');
  if (formEditarPerfil) {
    formEditarPerfil.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = {
          nombre: document.getElementById('perfil-nombre').value,
          email: document.getElementById('perfil-email').value,
          telefono: document.getElementById('perfil-telefono').value
        };

        const res = await apiFetch('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify(data)
        });

        state.user = res.user;
        document.getElementById('user-display-name').textContent = res.user.nombre;
        document.getElementById('user-avatar').textContent = res.user.nombre.charAt(0).toUpperCase();
        
        const cfgNombre = document.getElementById('cfg-perfil-nombre');
        const cfgEmail = document.getElementById('cfg-perfil-email');
        if (cfgNombre) cfgNombre.textContent = res.user.nombre;
        if (cfgEmail) cfgEmail.textContent = res.user.email;

        showToast('Tus datos de perfil han sido actualizados con éxito.', 'success');
        closeModal('modal-editar-perfil');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Form Cambiar Mi Contraseña Submit
  const formCambiarPassword = document.getElementById('form-cambiar-password');
  if (formCambiarPassword) {
    formCambiarPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const currentPassword = document.getElementById('perfil-password-actual').value;
        const newPassword = document.getElementById('perfil-password-nueva').value;

        await apiFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });

        document.getElementById('perfil-password-actual').value = '';
        document.getElementById('perfil-password-nueva').value = '';
        showToast('Tu contraseña ha sido cambiada exitosamente.', 'success');
        closeModal('modal-editar-perfil');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Form Editar Vendedor y Clave Submit
  const formEditarVendedor = document.getElementById('form-editar-vendedor');
  if (formEditarVendedor) {
    formEditarVendedor.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const vendedorId = document.getElementById('editar-vendedor-id').value;
        const data = {
          nombre: document.getElementById('editar-vendedor-nombre').value,
          email: document.getElementById('editar-vendedor-email').value,
          telefono: document.getElementById('editar-vendedor-telefono').value,
          password: document.getElementById('editar-vendedor-password').value
        };

        const res = await apiFetch(`/api/vendedores/${vendedorId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });

        showToast(res.message, 'success');
        closeModal('modal-editar-vendedor');
        if (state.activeView === 'vendedores') {
          window.views.vendedores();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// ==================== FUNCIONES DE PERFIL Y VENDEDORES ====================
function abrirModalPerfil() {
  if (!state.user) return;
  document.getElementById('perfil-nombre').value = state.user.nombre || '';
  document.getElementById('perfil-email').value = state.user.email || '';
  document.getElementById('perfil-telefono').value = state.user.telefono || '';
  const passActual = document.getElementById('perfil-password-actual');
  const passNueva = document.getElementById('perfil-password-nueva');
  if (passActual) passActual.value = '';
  if (passNueva) passNueva.value = '';
  openModal('modal-editar-perfil');
}

function abrirModalEditarVendedor(id, nombre, email, telefono) {
  document.getElementById('editar-vendedor-id').value = id;
  document.getElementById('editar-vendedor-nombre').value = nombre;
  document.getElementById('editar-vendedor-email').value = email;
  document.getElementById('editar-vendedor-telefono').value = telefono || '';
  document.getElementById('editar-vendedor-password').value = '';
  openModal('modal-editar-vendedor');
}

// ==================== PREPARADORES DE MODALES ====================
async function prepararModalNuevoPedido() {
  try {
    const resCli = await apiFetch('/api/clientes');
    const selectCli = document.getElementById('pedido-cliente-id');
    selectCli.innerHTML = '<option value="">-- Seleccionar Cliente --</option>' + 
      resCli.clientes.map(c => `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`).join('');

    if (state.user.rol === 'ADMIN') {
      const resVend = await apiFetch('/api/vendedores');
      const selectVend = document.getElementById('pedido-vendedor-id');
      selectVend.innerHTML = '<option value="">-- Yo mismo (Administrador) --</option>' + 
        resVend.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');
    }
  } catch (err) {}
}

async function prepararModalPaquete() {
  try {
    const resProv = await apiFetch('/api/proveedores');
    const selectProv = document.getElementById('paquete-proveedor-id');
    selectProv.innerHTML = '<option value="">-- Proveedor --</option>' + 
      resProv.proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

    // Pedidos pendientes de recibir (COMPRADO o EN_TRANSITO)
    const resPed = await apiFetch('/api/pedidos');
    const pedidosCandidatos = resPed.pedidos.filter(p => ['REGISTRADO', 'PENDIENTE_COMPRA', 'COMPRADO', 'EN_TRANSITO'].includes(p.estado));
    const listDiv = document.getElementById('lista-pedidos-para-paquete');

    if (pedidosCandidatos.length === 0) {
      listDiv.innerHTML = '<p class="text-slate-400 py-2 text-center">No hay pedidos pendientes de recepción en este momento.</p>';
    } else {
      listDiv.innerHTML = pedidosCandidatos.map(p => `
        <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <input type="checkbox" value="${p.id}" class="rounded text-amber-600 focus:ring-amber-500">
          <span class="font-bold text-amber-600 dark:text-amber-400">${p.codigo_pedido}</span>
          <span class="text-slate-700 dark:text-slate-300">${p.perfume_nombre} (x${p.cantidad})</span>
          <span class="text-slate-400 text-[10px]">(${p.cliente_nombre})</span>
        </label>
      `).join('');
    }
  } catch (err) {}
}

async function prepararModalRuta() {
  try {
    document.getElementById('ruta-fecha').value = new Date().toISOString().split('T')[0];
    
    // Lista de usuarios para responsable (Admin o Vendedor)
    const resVend = await apiFetch('/api/vendedores');
    const selectResp = document.getElementById('ruta-responsable-id');
    selectResp.innerHTML = `<option value="${state.user.id}">Yo (${state.user.nombre})</option>` +
      resVend.vendedores.map(v => `<option value="${v.id}">${v.nombre} (Vendedor)</option>`).join('');

    // Pedidos listos para entrega o recibidos
    const resPed = await apiFetch('/api/pedidos');
    const listos = resPed.pedidos.filter(p => ['RECIBIDO', 'LISTO_ENTREGA'].includes(p.estado) && !p.ruta_entrega_id);
    const listDiv = document.getElementById('lista-pedidos-para-ruta');

    if (listos.length === 0) {
      listDiv.innerHTML = '<p class="text-slate-400 py-2 text-center">No hay pedidos pendientes de asignar a ruta.</p>';
    } else {
      listDiv.innerHTML = listos.map(p => `
        <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <input type="checkbox" value="${p.id}" onchange="document.getElementById('ruta-costo-gasolina').dispatchEvent(new Event('input'))" class="rounded text-amber-600 focus:ring-amber-500">
          <span class="font-bold text-amber-600 dark:text-amber-400">${p.codigo_pedido}</span>
          <span class="text-slate-700 dark:text-slate-300">${p.cliente_nombre} - ${p.cliente_direccion || 'Sin dirección'}</span>
          <span class="text-slate-500 text-[10px]">(${p.perfume_nombre})</span>
        </label>
      `).join('');
    }
  } catch (err) {}
}

// Helpers para abrir modales contextuales desde tablas
function abrirModalPago(pedidoId, codigo, cliente, balance) {
  document.getElementById('pago-pedido-id').value = pedidoId;
  document.getElementById('pago-pedido-codigo').textContent = `Pedido: ${codigo}`;
  document.getElementById('pago-pedido-cliente').textContent = `Cliente: ${cliente}`;
  document.getElementById('pago-pedido-balance').textContent = `RD$ ${parseFloat(balance).toFixed(2)}`;
  document.getElementById('pago-monto').value = parseFloat(balance).toFixed(2);
  openModal('modal-registrar-pago');
}

async function abrirModalCompra(pedidoId, codigo, perfume) {
  document.getElementById('compra-pedido-id').value = pedidoId;
  document.getElementById('compra-pedido-codigo').textContent = `Pedido: ${codigo}`;
  document.getElementById('compra-pedido-perfume').textContent = `Perfume: ${perfume}`;

  const resProv = await apiFetch('/api/proveedores');
  const selectProv = document.getElementById('compra-proveedor-id');
  selectProv.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
    resProv.proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

  openModal('modal-registrar-compra');
}

function abrirModalCambioEstado(pedidoId, codigo, estadoActual) {
  document.getElementById('estado-pedido-id').value = pedidoId;
  document.getElementById('estado-pedido-codigo').textContent = `Pedido: ${codigo}`;
  document.getElementById('estado-pedido-actual').textContent = `Estado Actual: ${estadoActual}`;
  document.getElementById('estado-nuevo').value = estadoActual;
  document.getElementById('estado-nuevo').dispatchEvent(new Event('change'));
  openModal('modal-cambiar-estado');
}
