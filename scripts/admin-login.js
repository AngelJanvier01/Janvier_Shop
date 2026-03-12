const refs = {
    loginForm: document.getElementById('login-form'),
    loginFeedback: document.getElementById('login-feedback')
};

const STORAGE_KEYS = {
    adminToken: 'janvier:admin-token'
};

const RUTAS_ADMIN = {
    login: 'admin.html',
    panel: 'admin-panel.html'
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
    adminSession: `${API_BASE}/admin/session`,
    adminLogin: `${API_BASE}/admin/login`
};

function exigirTransporteSeguro() {
    const host = window.location.hostname || '';
    const esLocal = host === 'localhost' || host === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !esLocal && window.location.protocol !== 'file:') {
        const secureUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(secureUrl);
    }
}

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

function mostrarFeedback(mensaje, tipo = 'info') {
    if (!refs.loginFeedback) {
        return;
    }
    refs.loginFeedback.textContent = mensaje || '';
    refs.loginFeedback.classList.remove('is-error', 'is-success');
    if (!mensaje) {
        return;
    }
    if (tipo === 'error') {
        refs.loginFeedback.classList.add('is-error');
    }
    if (tipo === 'success') {
        refs.loginFeedback.classList.add('is-success');
    }
}

function irAlPanel() {
    window.location.replace(RUTAS_ADMIN.panel);
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

async function revisarSesionActiva() {
    try {
        const data = await fetchJson(API.adminSession, {}, 'No fue posible revisar sesion');
        if (data?.authenticated) {
            irAlPanel();
        }
    } catch (error) {
        // Se mantiene en login.
    }
}

function bindUI() {
    refs.loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        mostrarFeedback('');

        const username = refs.loginForm.username.value.trim().toLowerCase();
        const password = refs.loginForm.password.value;

        if (!username || !password) {
            mostrarFeedback('Ingresa usuario y contrasena.', 'error');
            return;
        }

        const submitBtn = refs.loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        try {
            const data = await fetchJson(API.adminLogin, {
                method: 'POST',
                body: { username, password }
            }, 'No fue posible iniciar sesion');

            adminToken = typeof data?.sessionToken === 'string' ? data.sessionToken : '';
            guardarToken(adminToken);
            mostrarFeedback('Acceso concedido.', 'success');
            refs.loginForm.reset();
            irAlPanel();
        } catch (error) {
            const texto = error?.status === 429
                ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
                : (error.message || 'Credenciales invalidas.');
            mostrarFeedback(texto, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    });
}

exigirTransporteSeguro();
bindUI();
revisarSesionActiva();
