const state = {
    productos: [],
    productoSeleccionadoId: null,
    settings: null,
    tabActiva: 'productos'
};

const refs = {
    authView: document.getElementById('auth-view'),
    dashboardView: document.getElementById('dashboard-view'),
    loginForm: document.getElementById('login-form'),
    loginFeedback: document.getElementById('login-feedback'),
    globalFeedback: document.getElementById('global-feedback'),
    sessionUser: document.getElementById('session-user'),

    tabProductosBtn: document.getElementById('tab-productos-btn'),
    tabAjustesBtn: document.getElementById('tab-ajustes-btn'),
    productosPanel: document.getElementById('productos-panel'),
    ajustesPanel: document.getElementById('ajustes-panel'),
    logoutBtn: document.getElementById('logout-btn'),

    productList: document.getElementById('product-list'),
    agregarBtn: document.getElementById('agregar-producto-btn'),
    formularioProducto: document.getElementById('product-form'),
    confirmarEliminarBtn: document.getElementById('confirmar-eliminar'),
    modalProducto: document.getElementById('modal-producto'),
    modalEliminar: document.getElementById('modal-eliminar'),
    modalTitle: document.getElementById('modal-title'),

    settingsForm: document.getElementById('settings-form'),
    slidesContainer: document.getElementById('carousel-slides'),
    addSlideBtn: document.getElementById('add-slide-btn'),
    passwordForm: document.getElementById('password-form')
};

function obtenerApiBase() {
    const apiBaseMeta = document.querySelector('meta[name="api-base"]');
    const apiBase = apiBaseMeta ? apiBaseMeta.content : '/api';
    const sanitizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

    if (window.location.protocol === 'file:' && sanitizedBase.startsWith('/')) {
        return `http://localhost:3000${sanitizedBase}`;
    }

    return sanitizedBase;
}

const API_BASE = obtenerApiBase();
const API = {
    productos: `${API_BASE}/productos`,
    adminSession: `${API_BASE}/admin/session`,
    adminLogin: `${API_BASE}/admin/login`,
    adminLogout: `${API_BASE}/admin/logout`,
    adminSettings: `${API_BASE}/admin/settings`,
    adminChangePassword: `${API_BASE}/admin/change-password`
};

const STORAGE_KEYS = {
    adminToken: 'janvier:admin-token'
};

function leerTokenGuardado() {
    try {
        return window.localStorage.getItem(STORAGE_KEYS.adminToken) || '';
    } catch (error) {
        return '';
    }
}

function guardarToken(token) {
    try {
        if (!token) {
            window.localStorage.removeItem(STORAGE_KEYS.adminToken);
            return;
        }
        window.localStorage.setItem(STORAGE_KEYS.adminToken, token);
    } catch (error) {
        // Ignora errores de storage.
    }
}

let adminToken = leerTokenGuardado();

function limpiarFeedback(element) {
    if (!element) {
        return;
    }
    element.textContent = '';
    element.classList.remove('is-error', 'is-success');
}

function mostrarFeedback(element, mensaje, tipo = 'info') {
    if (!element) {
        return;
    }

    element.textContent = mensaje || '';
    element.classList.remove('is-error', 'is-success');

    if (!mensaje) {
        return;
    }

    if (tipo === 'error') {
        element.classList.add('is-error');
    } else if (tipo === 'success') {
        element.classList.add('is-success');
    }
}

function mostrarVistaLogin() {
    if (refs.authView) {
        refs.authView.hidden = false;
    }
    if (refs.dashboardView) {
        refs.dashboardView.hidden = true;
    }
}

function mostrarVistaDashboard(username) {
    if (refs.authView) {
        refs.authView.hidden = true;
    }
    if (refs.dashboardView) {
        refs.dashboardView.hidden = false;
    }
    if (refs.sessionUser) {
        refs.sessionUser.textContent = username ? `Sesión activa: ${username}` : 'Sesión activa';
    }
}

function cambiarTab(tab) {
    state.tabActiva = tab;

    if (refs.productosPanel) {
        refs.productosPanel.hidden = tab !== 'productos';
    }
    if (refs.ajustesPanel) {
        refs.ajustesPanel.hidden = tab !== 'ajustes';
    }

    refs.tabProductosBtn?.classList.toggle('is-active', tab === 'productos');
    refs.tabAjustesBtn?.classList.toggle('is-active', tab === 'ajustes');
}

async function fetchJson(url, options = {}, errorBase = 'Error de red') {
    const requestOptions = {
        credentials: 'include',
        ...options
    };

    const headers = {
        ...(requestOptions.headers || {})
    };

    if (requestOptions.body && typeof requestOptions.body === 'object' && !(requestOptions.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(requestOptions.body);
    }

    if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
    }

    requestOptions.headers = headers;

    const response = await fetch(url, requestOptions);

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // Puede no haber JSON.
    }

    if (!response.ok) {
        const error = new Error((data && data.error) || `${errorBase} (status ${response.status}).`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

function manejarSesionExpirada(error) {
    if (!error || error.status !== 401) {
        return false;
    }
    adminToken = '';
    guardarToken('');
    mostrarFeedback(refs.globalFeedback, 'Tu sesión expiró. Inicia sesión nuevamente.', 'error');
    mostrarVistaLogin();
    return true;
}

function formatearMoneda(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        return '—';
    }
    return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function crearLineaDetalle(etiqueta, valor) {
    const linea = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${etiqueta}: `;
    linea.appendChild(strong);
    linea.appendChild(document.createTextNode(valor || '—'));
    return linea;
}

function mostrarAvisoProductos(texto, tipo = 'error') {
    if (!refs.productList) {
        return;
    }
    refs.productList.innerHTML = '';
    const aviso = document.createElement('p');
    aviso.className = tipo === 'error' ? 'mensaje-error' : 'mensaje-vacio';
    aviso.textContent = texto;
    refs.productList.appendChild(aviso);
}

function obtenerProductoPorId(id) {
    return state.productos.find((item) => item.id === id) || null;
}

function abrirModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModales() {
    [refs.modalProducto, refs.modalEliminar].forEach((modal) => {
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

function limpiarFormularioProducto() {
    if (!refs.formularioProducto || !refs.modalTitle) {
        return;
    }
    refs.formularioProducto.reset();
    refs.formularioProducto.dataset.modo = 'crear';
    refs.modalTitle.textContent = 'Agregar Producto';
    state.productoSeleccionadoId = null;
}

function abrirFormularioProducto(modo, id = null) {
    if (!refs.formularioProducto || !refs.modalTitle) {
        return;
    }

    if (modo === 'crear') {
        limpiarFormularioProducto();
        abrirModal(refs.modalProducto);
        return;
    }

    const producto = obtenerProductoPorId(id);
    if (!producto) {
        window.alert('No encontramos el producto que deseas editar.');
        return;
    }

    state.productoSeleccionadoId = id;
    refs.formularioProducto.dataset.modo = 'editar';
    refs.modalTitle.textContent = 'Editar Producto';

    refs.formularioProducto.marca.value = producto.marca || '';
    refs.formularioProducto.modelo.value = producto.modelo || '';
    refs.formularioProducto.codigo.value = producto.codigo || '';
    refs.formularioProducto.precioCompra.value = producto.precioCompra ?? '';
    refs.formularioProducto.precioVenta.value = producto.precioVenta ?? '';
    refs.formularioProducto.descripcion.value = producto.descripcion || '';
    refs.formularioProducto.clasificacion.value = producto.clasificacion || '';
    refs.formularioProducto.departamento.value = producto.departamento || '';
    refs.formularioProducto.imagen.value = Array.isArray(producto.imagenes) ? producto.imagenes.join(', ') : '';

    abrirModal(refs.modalProducto);
}

function abrirModalEliminar(id) {
    state.productoSeleccionadoId = id;
    abrirModal(refs.modalEliminar);
}

function extraerImagenes(raw) {
    return String(raw || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
}

function parsearNumero(valor) {
    if (valor === '') {
        return null;
    }
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : Number.NaN;
}

function construirPayloadProducto() {
    if (!refs.formularioProducto) {
        return null;
    }

    return {
        marca: refs.formularioProducto.marca.value.trim(),
        modelo: refs.formularioProducto.modelo.value.trim(),
        codigo: refs.formularioProducto.codigo.value.trim(),
        precioCompra: parsearNumero(refs.formularioProducto.precioCompra.value.trim()),
        precioVenta: parsearNumero(refs.formularioProducto.precioVenta.value.trim()),
        descripcion: refs.formularioProducto.descripcion.value.trim(),
        clasificacion: refs.formularioProducto.clasificacion.value.trim(),
        departamento: refs.formularioProducto.departamento.value.trim(),
        imagenes: extraerImagenes(refs.formularioProducto.imagen.value)
    };
}

function validarPayloadProducto(payload) {
    if (!payload.marca || !payload.modelo || !payload.clasificacion || !payload.departamento) {
        return 'Completa marca, modelo, clasificación y departamento.';
    }
    if (payload.precioVenta === null || Number.isNaN(payload.precioVenta) || payload.precioVenta < 0) {
        return 'Ingresa un precio de venta válido.';
    }
    if (Number.isNaN(payload.precioCompra) || payload.precioCompra < 0) {
        return 'El precio de compra debe ser un número válido.';
    }
    return '';
}

function renderProductos() {
    if (!refs.productList) {
        return;
    }

    refs.productList.innerHTML = '';

    if (!state.productos.length) {
        mostrarAvisoProductos('Aún no hay productos registrados.', 'vacio');
        return;
    }

    const fragment = document.createDocumentFragment();

    state.productos.forEach((producto) => {
        const card = document.createElement('article');
        card.className = 'producto';

        const imagenPrincipal = (producto.imagenes && producto.imagenes[0]) || producto.imagen || '';
        if (imagenPrincipal) {
            const img = document.createElement('img');
            img.src = imagenPrincipal;
            img.alt = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto';
            img.loading = 'lazy';
            card.appendChild(img);
        }

        const nombre = document.createElement('p');
        nombre.className = 'producto-nombre';
        nombre.textContent = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto sin nombre';
        card.appendChild(nombre);

        card.appendChild(crearLineaDetalle('Código', producto.codigo));
        card.appendChild(crearLineaDetalle('Departamento', producto.departamento));
        card.appendChild(crearLineaDetalle('Clasificación', producto.clasificacion));
        card.appendChild(crearLineaDetalle('Precio venta', formatearMoneda(producto.precioVenta)));
        card.appendChild(crearLineaDetalle('Precio compra', formatearMoneda(producto.precioCompra)));

        const acciones = document.createElement('div');
        acciones.className = 'acciones';

        const editarBtn = document.createElement('button');
        editarBtn.className = 'btn';
        editarBtn.type = 'button';
        editarBtn.textContent = 'Editar';
        editarBtn.addEventListener('click', () => abrirFormularioProducto('editar', producto.id));
        acciones.appendChild(editarBtn);

        const eliminarBtn = document.createElement('button');
        eliminarBtn.className = 'btn danger';
        eliminarBtn.type = 'button';
        eliminarBtn.textContent = 'Eliminar';
        eliminarBtn.addEventListener('click', () => abrirModalEliminar(producto.id));
        acciones.appendChild(eliminarBtn);

        card.appendChild(acciones);
        fragment.appendChild(card);
    });

    refs.productList.appendChild(fragment);
}

async function cargarProductos() {
    try {
        const data = await fetchJson(API.productos, {}, 'No fue posible cargar productos');
        state.productos = Array.isArray(data?.productos) ? data.productos : [];
        renderProductos();
    } catch (error) {
        if (manejarSesionExpirada(error)) {
            return;
        }
        state.productos = [];
        mostrarAvisoProductos('No se pudieron cargar los productos.');
    }
}

async function crearProducto(payload) {
    await fetchJson(API.productos, {
        method: 'POST',
        body: payload
    }, 'No fue posible crear el producto');
}

async function actualizarProducto(id, payload) {
    await fetchJson(`${API.productos}/${id}`, {
        method: 'PUT',
        body: payload
    }, 'No fue posible actualizar el producto');
}

async function eliminarProducto(id) {
    await fetchJson(`${API.productos}/${id}`, {
        method: 'DELETE'
    }, 'No fue posible eliminar el producto');
}

function crearSlideRow(slide = {}, index = 0) {
    const row = document.createElement('div');
    row.className = 'slide-row';

    const fieldImage = document.createElement('div');
    fieldImage.className = 'field';
    const imageLabel = document.createElement('label');
    imageLabel.setAttribute('for', `slide-image-${index}`);
    imageLabel.textContent = 'Imagen';
    const imageInput = document.createElement('input');
    imageInput.id = `slide-image-${index}`;
    imageInput.type = 'text';
    imageInput.className = 'slide-image';
    imageInput.value = slide.image || '';

    fieldImage.appendChild(imageLabel);
    fieldImage.appendChild(imageInput);

    const fieldAlt = document.createElement('div');
    fieldAlt.className = 'field';
    const altLabel = document.createElement('label');
    altLabel.setAttribute('for', `slide-alt-${index}`);
    altLabel.textContent = 'Texto alterno';
    const altInput = document.createElement('input');
    altInput.id = `slide-alt-${index}`;
    altInput.type = 'text';
    altInput.className = 'slide-alt';
    altInput.value = slide.alt || '';

    fieldAlt.appendChild(altLabel);
    fieldAlt.appendChild(altInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn danger remove-slide-btn';
    removeBtn.textContent = 'Eliminar';
    removeBtn.addEventListener('click', () => {
        row.remove();
        renumerarSlides();
    });

    row.appendChild(fieldImage);
    row.appendChild(fieldAlt);
    row.appendChild(removeBtn);

    return row;
}

function renumerarSlides() {
    if (!refs.slidesContainer) {
        return;
    }

    const rows = Array.from(refs.slidesContainer.querySelectorAll('.slide-row'));
    rows.forEach((row, index) => {
        const imageInput = row.querySelector('.slide-image');
        const altInput = row.querySelector('.slide-alt');
        const labels = row.querySelectorAll('label');

        if (imageInput) {
            imageInput.id = `slide-image-${index}`;
        }
        if (altInput) {
            altInput.id = `slide-alt-${index}`;
        }
        if (labels[0]) {
            labels[0].setAttribute('for', `slide-image-${index}`);
        }
        if (labels[1]) {
            labels[1].setAttribute('for', `slide-alt-${index}`);
        }
    });
}

function renderSlides(slides) {
    if (!refs.slidesContainer) {
        return;
    }

    refs.slidesContainer.innerHTML = '';
    const lista = Array.isArray(slides) ? slides : [];
    const data = lista.length ? lista : [{ image: '', alt: '' }];

    data.forEach((slide, index) => {
        refs.slidesContainer.appendChild(crearSlideRow(slide, index));
    });
}

function poblarFormularioAjustes(settings) {
    if (!refs.settingsForm || !settings) {
        return;
    }

    const setValue = (fieldName, value = '') => {
        if (!refs.settingsForm[fieldName]) {
            return;
        }
        refs.settingsForm[fieldName].value = value;
    };

    setValue('siteName', settings.siteName || '');
    setValue('logoPath', settings.logoPath || '');
    setValue('faviconPath', settings.faviconPath || '');
    setValue('heroTitle', settings.heroTitle || '');
    setValue('heroDescription', settings.heroDescription || '');
    setValue('heroButtonLabel', settings.heroButtonLabel || '');
    setValue('heroButtonHref', settings.heroButtonHref || '');
    setValue('customText', settings.customText || '');
    setValue('catalogTitle', settings.catalogTitle || '');
    setValue('catalogDescription', settings.catalogDescription || '');
    setValue('contactTitle', settings.contactTitle || '');
    setValue('contactDescription', settings.contactDescription || '');
    setValue('contactCtaTitle', settings.contactCtaTitle || '');
    setValue('contactCtaDescription', settings.contactCtaDescription || '');

    if (refs.settingsForm.carouselEnabled) {
        refs.settingsForm.carouselEnabled.checked = settings.carouselEnabled !== false;
    }

    renderSlides(settings.carouselSlides || []);
}

function obtenerSlidesDesdeUI() {
    if (!refs.slidesContainer) {
        return [];
    }

    return Array.from(refs.slidesContainer.querySelectorAll('.slide-row'))
        .map((row) => {
            const image = row.querySelector('.slide-image')?.value.trim() || '';
            const alt = row.querySelector('.slide-alt')?.value.trim() || '';
            if (!image) {
                return null;
            }
            return { image, alt };
        })
        .filter(Boolean);
}

function construirPayloadAjustes() {
    if (!refs.settingsForm) {
        return null;
    }

    return {
        siteName: refs.settingsForm.siteName.value.trim(),
        logoPath: refs.settingsForm.logoPath.value.trim(),
        faviconPath: refs.settingsForm.faviconPath.value.trim(),
        heroTitle: refs.settingsForm.heroTitle.value.trim(),
        heroDescription: refs.settingsForm.heroDescription.value.trim(),
        heroButtonLabel: refs.settingsForm.heroButtonLabel.value.trim(),
        heroButtonHref: refs.settingsForm.heroButtonHref.value.trim(),
        customText: refs.settingsForm.customText.value.trim(),
        catalogTitle: refs.settingsForm.catalogTitle.value.trim(),
        catalogDescription: refs.settingsForm.catalogDescription.value.trim(),
        contactTitle: refs.settingsForm.contactTitle.value.trim(),
        contactDescription: refs.settingsForm.contactDescription.value.trim(),
        contactCtaTitle: refs.settingsForm.contactCtaTitle.value.trim(),
        contactCtaDescription: refs.settingsForm.contactCtaDescription.value.trim(),
        carouselEnabled: refs.settingsForm.carouselEnabled.checked,
        carouselSlides: obtenerSlidesDesdeUI()
    };
}

function validarPayloadAjustes(payload) {
    if (!payload) {
        return 'No fue posible leer el formulario de ajustes.';
    }

    const camposObligatorios = [
        'siteName',
        'logoPath',
        'faviconPath',
        'heroTitle',
        'heroDescription',
        'heroButtonLabel',
        'heroButtonHref',
        'customText',
        'catalogTitle',
        'catalogDescription',
        'contactTitle',
        'contactDescription',
        'contactCtaTitle',
        'contactCtaDescription'
    ];

    for (const campo of camposObligatorios) {
        if (!payload[campo]) {
            return 'Completa todos los campos de ajustes antes de guardar.';
        }
    }

    if (payload.carouselEnabled && !payload.carouselSlides.length) {
        return 'Agrega al menos una imagen válida para el carrusel.';
    }

    return '';
}

async function cargarAjustesAdmin() {
    try {
        const data = await fetchJson(API.adminSettings, {}, 'No fue posible cargar ajustes');
        state.settings = data?.settings || null;
        poblarFormularioAjustes(state.settings);
    } catch (error) {
        if (manejarSesionExpirada(error)) {
            return;
        }
        mostrarFeedback(refs.globalFeedback, error.message || 'No fue posible cargar ajustes.', 'error');
    }
}

async function guardarAjustes(payload) {
    const data = await fetchJson(API.adminSettings, {
        method: 'PUT',
        body: payload
    }, 'No fue posible guardar ajustes');

    state.settings = data?.settings || payload;
    poblarFormularioAjustes(state.settings);
}

async function revisarSesion() {
    try {
        const data = await fetchJson(API.adminSession, {}, 'No fue posible revisar sesión');
        if (!data?.authenticated) {
            adminToken = '';
            guardarToken('');
            mostrarVistaLogin();
            return;
        }

        const username = data?.user?.username || 'admin';
        mostrarVistaDashboard(username);
        cambiarTab(state.tabActiva);

        await Promise.all([cargarProductos(), cargarAjustesAdmin()]);
    } catch (error) {
        adminToken = '';
        guardarToken('');
        mostrarVistaLogin();
    }
}

async function iniciarSesion(username, password) {
    return fetchJson(API.adminLogin, {
        method: 'POST',
        body: { username, password }
    }, 'No fue posible iniciar sesión');
}

async function cerrarSesion() {
    await fetchJson(API.adminLogout, { method: 'POST' }, 'No fue posible cerrar sesión');
}

async function cambiarContrasena(currentPassword, newPassword) {
    return fetchJson(API.adminChangePassword, {
        method: 'POST',
        body: { currentPassword, newPassword }
    }, 'No fue posible actualizar contraseña');
}

function bindUI() {
    refs.tabProductosBtn?.addEventListener('click', () => cambiarTab('productos'));
    refs.tabAjustesBtn?.addEventListener('click', () => cambiarTab('ajustes'));

    refs.logoutBtn?.addEventListener('click', async () => {
        try {
            await cerrarSesion();
            adminToken = '';
            guardarToken('');
            mostrarFeedback(refs.globalFeedback, 'Sesión cerrada.', 'success');
            limpiarFeedback(refs.loginFeedback);
            mostrarVistaLogin();
        } catch (error) {
            mostrarFeedback(refs.globalFeedback, error.message || 'No fue posible cerrar sesión.', 'error');
        }
    });

    refs.loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        limpiarFeedback(refs.loginFeedback);

        const username = refs.loginForm.username.value.trim().toLowerCase();
        const password = refs.loginForm.password.value;

        if (!username || !password) {
            mostrarFeedback(refs.loginFeedback, 'Ingresa usuario y contraseña.', 'error');
            return;
        }

        const submitBtn = refs.loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        try {
            const data = await iniciarSesion(username, password);
            adminToken = typeof data?.sessionToken === 'string' ? data.sessionToken : '';
            guardarToken(adminToken);
            refs.loginForm.reset();
            mostrarFeedback(refs.loginFeedback, 'Acceso concedido.', 'success');
            mostrarVistaDashboard(data?.user?.username || username);
            cambiarTab('productos');
            await Promise.all([cargarProductos(), cargarAjustesAdmin()]);
            limpiarFeedback(refs.globalFeedback);
        } catch (error) {
            const texto = error?.status === 429
                ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
                : (error.message || 'Credenciales inválidas.');
            mostrarFeedback(refs.loginFeedback, texto, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    });

    refs.agregarBtn?.addEventListener('click', () => abrirFormularioProducto('crear'));

    refs.formularioProducto?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = construirPayloadProducto();
        if (!payload) {
            window.alert('No fue posible leer el formulario.');
            return;
        }

        const errorValidacion = validarPayloadProducto(payload);
        if (errorValidacion) {
            window.alert(errorValidacion);
            return;
        }

        try {
            if (state.productoSeleccionadoId) {
                await actualizarProducto(state.productoSeleccionadoId, payload);
            } else {
                await crearProducto(payload);
            }

            cerrarModales();
            await cargarProductos();
            mostrarFeedback(refs.globalFeedback, 'Producto guardado correctamente.', 'success');
        } catch (error) {
            if (manejarSesionExpirada(error)) {
                return;
            }
            window.alert(error.message || 'Ocurrió un problema al guardar el producto.');
        }
    });

    refs.confirmarEliminarBtn?.addEventListener('click', async () => {
        if (!state.productoSeleccionadoId) {
            return;
        }

        try {
            await eliminarProducto(state.productoSeleccionadoId);
            state.productoSeleccionadoId = null;
            cerrarModales();
            await cargarProductos();
            mostrarFeedback(refs.globalFeedback, 'Producto eliminado.', 'success');
        } catch (error) {
            if (manejarSesionExpirada(error)) {
                return;
            }
            window.alert(error.message || 'No se pudo eliminar el producto.');
        }
    });

    refs.settingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = construirPayloadAjustes();
        const errorValidacion = validarPayloadAjustes(payload);
        if (errorValidacion) {
            mostrarFeedback(refs.globalFeedback, errorValidacion, 'error');
            return;
        }

        try {
            await guardarAjustes(payload);
            mostrarFeedback(refs.globalFeedback, 'Ajustes guardados. El sitio público ya usa la nueva configuración.', 'success');
            if (window.JanvierSiteSettings && typeof window.JanvierSiteSettings.load === 'function') {
                window.JanvierSiteSettings.load();
            }
        } catch (error) {
            if (manejarSesionExpirada(error)) {
                return;
            }
            mostrarFeedback(refs.globalFeedback, error.message || 'No fue posible guardar ajustes.', 'error');
        }
    });

    refs.addSlideBtn?.addEventListener('click', () => {
        if (!refs.slidesContainer) {
            return;
        }
        refs.slidesContainer.appendChild(crearSlideRow({}, refs.slidesContainer.children.length));
        renumerarSlides();
    });

    refs.passwordForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const currentPassword = refs.passwordForm.currentPassword.value;
        const newPassword = refs.passwordForm.newPassword.value;
        const confirmPassword = refs.passwordForm.confirmPassword.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            mostrarFeedback(refs.globalFeedback, 'Completa todos los campos de contraseña.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            mostrarFeedback(refs.globalFeedback, 'La confirmación de la nueva contraseña no coincide.', 'error');
            return;
        }

        try {
            await cambiarContrasena(currentPassword, newPassword);
            adminToken = '';
            guardarToken('');
            refs.passwordForm.reset();
            mostrarFeedback(refs.globalFeedback, 'Contraseña actualizada. Inicia sesión de nuevo.', 'success');
            mostrarVistaLogin();
        } catch (error) {
            if (manejarSesionExpirada(error)) {
                return;
            }
            mostrarFeedback(refs.globalFeedback, error.message || 'No fue posible actualizar contraseña.', 'error');
        }
    });

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                cerrarModales();
            }
        });
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', cerrarModales);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarModales();
        }
    });
}

bindUI();
revisarSesion();
