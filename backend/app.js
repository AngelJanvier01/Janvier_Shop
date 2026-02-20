const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const CUSTOM_TEXT_FILE = path.join(ROOT_DIR, 'data', 'custom-text.txt');
const PUBLIC_FILES = ['index.html', 'catalogo.html', 'contacto.html', 'admin.html', 'footer.html'];

const SESSION_COOKIE_NAME = 'janvier_admin_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 1000 * 60 * 15;
const PASSWORD_MIN_LENGTH = 12;

const DEFAULT_ADMIN_USERNAME = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'JanvierShop!2026';

const DEFAULT_SETTINGS = {
    siteName: 'Janvier Shop',
    logoPath: 'images/logo.gif',
    faviconPath: 'images/favicon.gif',
    heroTitle: 'Bienvenido a Ángel Janvier',
    heroDescription: 'Explora nuestros productos y servicios tecnológicos.',
    heroButtonLabel: 'Visita nuestro catálogo',
    heroButtonHref: 'catalogo.html',
    customText: 'Hola, soy Ángel Janvier: ingeniero de software, creador de experiencias digitales y fundador de Janvier Shop.\n\nMe apasiona combinar estrategia, código limpio y diseño con identidad para elevar cada proyecto con tecnología.',
    catalogTitle: 'Catálogo Janvier Shop',
    catalogDescription: 'Explora nuestra selección de productos tecnológicos y usa los filtros para encontrar justo lo que necesitas.',
    contactTitle: 'Conecta con Janvier Shop',
    contactDescription: 'Janvier Shop combina tienda tecnológica y estudio de software. Elige tu canal favorito y conversemos sobre productos, automatizaciones o soluciones digitales para tu negocio.',
    contactCtaTitle: '¿Listo para colaborar?',
    contactCtaDescription: 'Compárteme tu visión. Puedo ayudarte a lanzar un e-commerce, automatizar procesos o construir el portafolio digital que mereces.',
    carouselEnabled: true,
    carouselSlides: [
        { image: 'images/imagen1.jpg', alt: 'Laptop y accesorios tecnológicos' },
        { image: 'images/imagen2.jpg', alt: 'Espacio de trabajo con gadgets' },
        { image: 'images/imagen3.jpg', alt: 'Equipo de tecnología para oficina' }
    ]
};

const loginAttempts = new Map();
const LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

function origenPermitido(origin) {
    if (!origin) {
        return false;
    }
    if (origin === 'null') {
        return true;
    }
    return LOCAL_ORIGIN_REGEX.test(origin);
}

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origenPermitido(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/images', express.static(path.join(ROOT_DIR, 'images')));
app.use('/styles', express.static(path.join(ROOT_DIR, 'styles')));
app.use('/scripts', express.static(path.join(ROOT_DIR, 'scripts')));
app.use('/data', express.static(path.join(ROOT_DIR, 'data')));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row || null);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this);
        });
    });
}

function ahora() {
    return Date.now();
}

function normalizarTexto(valor) {
    if (valor === null || valor === undefined) {
        return '';
    }
    return String(valor).trim();
}

function limpiarTextoCorto(valor, maximo) {
    return normalizarTexto(valor)
        .replace(/\s+/g, ' ')
        .slice(0, maximo);
}

function limpiarTextoLargo(valor, maximo) {
    const texto = normalizarTexto(valor)
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
    return texto.slice(0, maximo);
}

function normalizarPrecio(valor, requerido = false) {
    if (valor === '' || valor === null || valor === undefined) {
        return requerido ? Number.NaN : null;
    }
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : Number.NaN;
}

function normalizarImagenes(imagenes) {
    if (!Array.isArray(imagenes)) {
        return [];
    }
    return imagenes
        .map((img) => normalizarTexto(img))
        .filter(Boolean);
}

function validarRecurso(valor, permitirExterno = true) {
    const texto = normalizarTexto(valor);
    if (!texto) {
        return '';
    }
    if (texto.length > 500) {
        return '';
    }

    if (/^https?:\/\//i.test(texto)) {
        if (!permitirExterno) {
            return '';
        }
        try {
            return new URL(texto).toString();
        } catch (error) {
            return '';
        }
    }

    if (/^[a-zA-Z0-9/_\-.]+$/.test(texto)) {
        return texto;
    }

    return '';
}

function normalizarCarrusel(slides) {
    if (!Array.isArray(slides)) {
        return [];
    }

    return slides
        .slice(0, 12)
        .map((slide) => {
            if (!slide || typeof slide !== 'object') {
                return null;
            }
            const image = validarRecurso(slide.image, true);
            if (!image) {
                return null;
            }
            const alt = limpiarTextoCorto(slide.alt, 160) || 'Promoción Janvier Shop';
            return { image, alt };
        })
        .filter(Boolean);
}

function validarPayloadProducto(payload) {
    const producto = {
        marca: normalizarTexto(payload.marca),
        modelo: normalizarTexto(payload.modelo),
        codigo: normalizarTexto(payload.codigo),
        precioCompra: normalizarPrecio(payload.precioCompra),
        precioVenta: normalizarPrecio(payload.precioVenta, true),
        descripcion: normalizarTexto(payload.descripcion),
        clasificacion: normalizarTexto(payload.clasificacion),
        departamento: normalizarTexto(payload.departamento),
        imagenes: normalizarImagenes(payload.imagenes)
    };

    const errores = [];
    if (!producto.marca) errores.push('marca');
    if (!producto.modelo) errores.push('modelo');
    if (!producto.clasificacion) errores.push('clasificacion');
    if (!producto.departamento) errores.push('departamento');

    if (Number.isNaN(producto.precioVenta) || producto.precioVenta < 0) {
        errores.push('precioVenta');
    }
    if (Number.isNaN(producto.precioCompra) || producto.precioCompra < 0) {
        errores.push('precioCompra');
    }

    return { producto, errores };
}

function parseCookies(header) {
    if (!header) {
        return {};
    }

    return header
        .split(';')
        .map((parte) => parte.trim())
        .filter(Boolean)
        .reduce((acc, cookiePart) => {
            const index = cookiePart.indexOf('=');
            if (index <= 0) {
                return acc;
            }
            const key = cookiePart.slice(0, index);
            const rawValue = cookiePart.slice(index + 1);
            try {
                acc[key] = decodeURIComponent(rawValue);
            } catch (error) {
                acc[key] = rawValue;
            }
            return acc;
        }, {});
}

function obtenerCookie(req, nombre) {
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[nombre] || '';
}

function generarSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function derivarHashContrasena(contrasena, salt) {
    return crypto.scryptSync(contrasena, salt, 64).toString('hex');
}

function hashTokenSesion(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function compararHexSeguro(a, b) {
    try {
        const aBuffer = Buffer.from(a, 'hex');
        const bBuffer = Buffer.from(b, 'hex');
        if (aBuffer.length === 0 || bBuffer.length === 0 || aBuffer.length !== bBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(aBuffer, bBuffer);
    } catch (error) {
        return false;
    }
}

function validarFortalezaContrasena(contrasena) {
    const errores = [];
    if (typeof contrasena !== 'string' || contrasena.length < PASSWORD_MIN_LENGTH) {
        errores.push(`mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
    }
    if (!/[a-z]/.test(contrasena)) {
        errores.push('al menos una minúscula');
    }
    if (!/[A-Z]/.test(contrasena)) {
        errores.push('al menos una mayúscula');
    }
    if (!/[0-9]/.test(contrasena)) {
        errores.push('al menos un número');
    }
    if (!/[^a-zA-Z0-9]/.test(contrasena)) {
        errores.push('al menos un símbolo');
    }
    return errores;
}

function obtenerClienteIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'desconocido';
}

function obtenerEstadoBloqueo(ip) {
    const data = loginAttempts.get(ip);
    if (!data) {
        return { bloqueado: false, restanteMs: 0 };
    }

    if (data.blockedUntil && data.blockedUntil > ahora()) {
        return { bloqueado: true, restanteMs: data.blockedUntil - ahora() };
    }

    if (data.blockedUntil && data.blockedUntil <= ahora()) {
        loginAttempts.delete(ip);
    }

    return { bloqueado: false, restanteMs: 0 };
}

function registrarIntentoFallido(ip) {
    const current = loginAttempts.get(ip) || { count: 0, firstAttemptAt: ahora(), blockedUntil: 0 };
    const now = ahora();

    if (now - current.firstAttemptAt > LOGIN_BLOCK_MS) {
        current.count = 0;
        current.firstAttemptAt = now;
        current.blockedUntil = 0;
    }

    current.count += 1;

    if (current.count >= LOGIN_MAX_ATTEMPTS) {
        current.count = 0;
        current.firstAttemptAt = now;
        current.blockedUntil = now + LOGIN_BLOCK_MS;
    }

    loginAttempts.set(ip, current);
}

function limpiarIntentos(ip) {
    loginAttempts.delete(ip);
}

function cookieDebeSerSegura(req) {
    return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function establecerCookieSesion(req, res, token, maxAgeMs = SESSION_DURATION_MS) {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieDebeSerSegura(req),
        maxAge: maxAgeMs,
        path: '/'
    });
}

function limpiarCookieSesion(req, res) {
    res.cookie(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieDebeSerSegura(req),
        maxAge: 0,
        path: '/'
    });
}

function obtenerTokenBearer(req) {
    const authorization = normalizarTexto(req.headers.authorization);
    if (!authorization) {
        return '';
    }

    const [scheme, token] = authorization.split(/\s+/, 2);
    if (!scheme || !token) {
        return '';
    }

    if (scheme.toLowerCase() !== 'bearer') {
        return '';
    }

    return normalizarTexto(token);
}

function obtenerTokensSesionSolicitud(req) {
    const tokens = [];
    const bearer = obtenerTokenBearer(req);
    const cookie = obtenerCookie(req, SESSION_COOKIE_NAME);

    if (bearer) {
        tokens.push(bearer);
    }
    if (cookie && cookie !== bearer) {
        tokens.push(cookie);
    }

    return tokens;
}

async function obtenerSesionAdmin(req) {
    const tokens = obtenerTokensSesionSolicitud(req);
    if (!tokens.length) {
        return null;
    }

    for (const token of tokens) {
        const tokenHash = hashTokenSesion(token);
        const session = await dbGet(
            `SELECT s.user_id, s.expires_at, u.username
             FROM admin_sessions s
             INNER JOIN admin_users u ON u.id = s.user_id
             WHERE s.token_hash = ?`,
            [tokenHash]
        );

        if (!session) {
            continue;
        }

        if (session.expires_at <= ahora()) {
            await dbRun('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
            continue;
        }

        return {
            userId: session.user_id,
            username: session.username,
            tokenHash
        };
    }

    return null;
}

async function requireAdminAuth(req, res, next) {
    try {
        const session = await obtenerSesionAdmin(req);
        if (!session) {
            limpiarCookieSesion(req, res);
            res.status(401).json({ error: 'No autorizado.' });
            return;
        }
        req.admin = session;
        next();
    } catch (error) {
        next(error);
    }
}

async function guardarAjustesSitio(updates) {
    const timestamp = ahora();
    const entries = Object.entries(updates);

    if (!entries.length) {
        return;
    }

    await Promise.all(
        entries.map(([key, value]) => dbRun(
            `INSERT INTO site_settings (key, value, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [key, JSON.stringify(value), timestamp]
        ))
    );

    if (Object.prototype.hasOwnProperty.call(updates, 'customText')) {
        try {
            fs.writeFileSync(CUSTOM_TEXT_FILE, String(updates.customText || ''), 'utf8');
        } catch (error) {
            console.error('No se pudo sincronizar data/custom-text.txt:', error);
        }
    }
}

async function obtenerAjustesSitio() {
    const rows = await dbAll('SELECT key, value FROM site_settings');
    const ajustes = { ...DEFAULT_SETTINGS };

    rows.forEach((row) => {
        if (!Object.prototype.hasOwnProperty.call(ajustes, row.key)) {
            return;
        }

        try {
            ajustes[row.key] = JSON.parse(row.value);
        } catch (error) {
            // Ignora registros inválidos.
        }
    });

    if (!Array.isArray(ajustes.carouselSlides)) {
        ajustes.carouselSlides = [...DEFAULT_SETTINGS.carouselSlides];
    }

    return ajustes;
}

function validarActualizacionAjustes(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { updates: null, errores: ['Payload inválido.'] };
    }

    const updates = {};
    const errores = [];

    if (Object.prototype.hasOwnProperty.call(payload, 'siteName')) {
        const valor = limpiarTextoCorto(payload.siteName, 80);
        if (!valor) {
            errores.push('siteName es obligatorio.');
        } else {
            updates.siteName = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'logoPath')) {
        const valor = validarRecurso(payload.logoPath, true);
        if (!valor) {
            errores.push('logoPath no es válido.');
        } else {
            updates.logoPath = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'faviconPath')) {
        const valor = validarRecurso(payload.faviconPath, true);
        if (!valor) {
            errores.push('faviconPath no es válido.');
        } else {
            updates.faviconPath = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'heroTitle')) {
        const valor = limpiarTextoCorto(payload.heroTitle, 120);
        if (!valor) {
            errores.push('heroTitle es obligatorio.');
        } else {
            updates.heroTitle = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'heroDescription')) {
        const valor = limpiarTextoCorto(payload.heroDescription, 260);
        if (!valor) {
            errores.push('heroDescription es obligatorio.');
        } else {
            updates.heroDescription = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'heroButtonLabel')) {
        const valor = limpiarTextoCorto(payload.heroButtonLabel, 60);
        if (!valor) {
            errores.push('heroButtonLabel es obligatorio.');
        } else {
            updates.heroButtonLabel = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'heroButtonHref')) {
        const valor = validarRecurso(payload.heroButtonHref, true);
        if (!valor) {
            errores.push('heroButtonHref no es válido.');
        } else {
            updates.heroButtonHref = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'customText')) {
        const valor = limpiarTextoLargo(payload.customText, 3200);
        if (!valor) {
            errores.push('customText no puede quedar vacío.');
        } else {
            updates.customText = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'catalogTitle')) {
        const valor = limpiarTextoCorto(payload.catalogTitle, 120);
        if (!valor) {
            errores.push('catalogTitle es obligatorio.');
        } else {
            updates.catalogTitle = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'catalogDescription')) {
        const valor = limpiarTextoCorto(payload.catalogDescription, 280);
        if (!valor) {
            errores.push('catalogDescription es obligatorio.');
        } else {
            updates.catalogDescription = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'contactTitle')) {
        const valor = limpiarTextoCorto(payload.contactTitle, 120);
        if (!valor) {
            errores.push('contactTitle es obligatorio.');
        } else {
            updates.contactTitle = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'contactDescription')) {
        const valor = limpiarTextoCorto(payload.contactDescription, 300);
        if (!valor) {
            errores.push('contactDescription es obligatorio.');
        } else {
            updates.contactDescription = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'contactCtaTitle')) {
        const valor = limpiarTextoCorto(payload.contactCtaTitle, 120);
        if (!valor) {
            errores.push('contactCtaTitle es obligatorio.');
        } else {
            updates.contactCtaTitle = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'contactCtaDescription')) {
        const valor = limpiarTextoCorto(payload.contactCtaDescription, 300);
        if (!valor) {
            errores.push('contactCtaDescription es obligatorio.');
        } else {
            updates.contactCtaDescription = valor;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'carouselEnabled')) {
        updates.carouselEnabled = Boolean(payload.carouselEnabled);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'carouselSlides')) {
        const slides = normalizarCarrusel(payload.carouselSlides);
        if (!slides.length && payload.carouselEnabled !== false) {
            errores.push('carouselSlides debe incluir al menos una imagen válida.');
        } else {
            updates.carouselSlides = slides;
        }
    }

    return { updates, errores };
}

async function crearSesionAdmin(req, res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashTokenSesion(token);
    const createdAt = ahora();
    const expiresAt = createdAt + SESSION_DURATION_MS;

    await dbRun(
        'INSERT INTO admin_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        [tokenHash, userId, createdAt, expiresAt]
    );

    establecerCookieSesion(req, res, token);
    return token;
}

async function borrarSesionActual(req) {
    const tokens = obtenerTokensSesionSolicitud(req);
    if (!tokens.length) {
        return;
    }

    await Promise.all(
        tokens.map((token) => {
            const tokenHash = hashTokenSesion(token);
            return dbRun('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
        })
    );
}

async function limpiarSesionesExpiradas() {
    await dbRun('DELETE FROM admin_sessions WHERE expires_at <= ?', [ahora()]);
}

async function asegurarDatosIniciales() {
    await limpiarSesionesExpiradas();

    const userRow = await dbGet('SELECT id FROM admin_users WHERE username = ?', [DEFAULT_ADMIN_USERNAME]);
    if (!userRow) {
        const salt = generarSalt();
        const hash = derivarHashContrasena(DEFAULT_ADMIN_PASSWORD, salt);
        const timestamp = ahora();

        await dbRun(
            `INSERT INTO admin_users (username, password_salt, password_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [DEFAULT_ADMIN_USERNAME, salt, hash, timestamp, timestamp]
        );

        const credencialPorDefecto = !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD;
        if (credencialPorDefecto) {
            console.log('Admin inicial creado con credenciales por defecto. Usuario: admin / Password: JanvierShop!2026');
            console.log('Configura ADMIN_USER y ADMIN_PASSWORD en entorno para mayor seguridad.');
        }
    }

    const timestamp = ahora();
    const keys = Object.keys(DEFAULT_SETTINGS);
    await Promise.all(
        keys.map((key) => dbRun(
            'INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)',
            [key, JSON.stringify(DEFAULT_SETTINGS[key]), timestamp]
        ))
    );

    if (!fs.existsSync(CUSTOM_TEXT_FILE)) {
        fs.writeFileSync(CUSTOM_TEXT_FILE, DEFAULT_SETTINGS.customText, 'utf8');
    }
}

function insertarImagenes(productId, imagenes, callback) {
    if (!imagenes.length) {
        callback();
        return;
    }

    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
    let pending = imagenes.length;
    let finalizado = false;

    function finalizar(err) {
        if (finalizado) {
            return;
        }
        finalizado = true;
        stmt.finalize(() => callback(err));
    }

    imagenes.forEach((img) => {
        stmt.run(productId, img, (err) => {
            if (err) {
                finalizar(err);
                return;
            }
            pending -= 1;
            if (pending === 0) {
                finalizar();
            }
        });
    });
}

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await obtenerAjustesSitio();
        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible cargar ajustes del sitio.' });
    }
});

app.get('/api/admin/session', async (req, res) => {
    try {
        const session = await obtenerSesionAdmin(req);
        if (!session) {
            res.json({ authenticated: false });
            return;
        }
        res.json({
            authenticated: true,
            user: {
                id: session.userId,
                username: session.username
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible validar la sesión.' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        await limpiarSesionesExpiradas();

        const ip = obtenerClienteIp(req);
        const estado = obtenerEstadoBloqueo(ip);
        if (estado.bloqueado) {
            res.status(429).json({
                error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
                retryAfterMs: estado.restanteMs
            });
            return;
        }

        const username = normalizarTexto(req.body.username).toLowerCase();
        const password = String(req.body.password || '');

        if (!username || !password) {
            res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
            return;
        }

        const usuario = await dbGet(
            'SELECT id, username, password_salt, password_hash FROM admin_users WHERE username = ?',
            [username]
        );

        if (!usuario) {
            registrarIntentoFallido(ip);
            res.status(401).json({ error: 'Credenciales inválidas.' });
            return;
        }

        const hashCalculado = derivarHashContrasena(password, usuario.password_salt);
        const esValido = compararHexSeguro(hashCalculado, usuario.password_hash);

        if (!esValido) {
            registrarIntentoFallido(ip);
            res.status(401).json({ error: 'Credenciales inválidas.' });
            return;
        }

        limpiarIntentos(ip);

        await dbRun('DELETE FROM admin_sessions WHERE user_id = ?', [usuario.id]);
        const sessionToken = await crearSesionAdmin(req, res, usuario.id);

        res.json({
            authenticated: true,
            user: {
                id: usuario.id,
                username: usuario.username
            },
            sessionToken
        });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible iniciar sesión.' });
    }
});

app.post('/api/admin/logout', async (req, res) => {
    try {
        await borrarSesionActual(req);
        limpiarCookieSesion(req, res);
        res.json({ loggedOut: true });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible cerrar sesión.' });
    }
});

app.post('/api/admin/change-password', requireAdminAuth, async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'currentPassword y newPassword son obligatorios.' });
            return;
        }

        const usuario = await dbGet(
            'SELECT id, password_salt, password_hash FROM admin_users WHERE id = ?',
            [req.admin.userId]
        );

        if (!usuario) {
            res.status(404).json({ error: 'Usuario admin no encontrado.' });
            return;
        }

        const hashActual = derivarHashContrasena(currentPassword, usuario.password_salt);
        const coincide = compararHexSeguro(hashActual, usuario.password_hash);
        if (!coincide) {
            res.status(401).json({ error: 'La contraseña actual no es correcta.' });
            return;
        }

        const erroresFortaleza = validarFortalezaContrasena(newPassword);
        if (erroresFortaleza.length) {
            res.status(400).json({
                error: `La nueva contraseña no cumple seguridad: ${erroresFortaleza.join(', ')}.`
            });
            return;
        }

        const salt = generarSalt();
        const hash = derivarHashContrasena(newPassword, salt);

        await dbRun(
            'UPDATE admin_users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?',
            [salt, hash, ahora(), req.admin.userId]
        );

        await dbRun('DELETE FROM admin_sessions WHERE user_id = ?', [req.admin.userId]);
        limpiarCookieSesion(req, res);

        res.json({ updated: true, reloginRequired: true });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible actualizar la contraseña.' });
    }
});

app.get('/api/admin/settings', requireAdminAuth, async (req, res) => {
    try {
        const settings = await obtenerAjustesSitio();
        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible cargar ajustes.' });
    }
});

app.put('/api/admin/settings', requireAdminAuth, async (req, res) => {
    try {
        const { updates, errores } = validarActualizacionAjustes(req.body || {});
        if (errores.length) {
            res.status(400).json({ error: 'Datos inválidos', detalles: errores });
            return;
        }

        if (!updates || Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No se recibieron cambios para guardar.' });
            return;
        }

        await guardarAjustesSitio(updates);
        const settings = await obtenerAjustesSitio();
        res.json({ saved: true, settings });
    } catch (error) {
        res.status(500).json({ error: 'No fue posible guardar ajustes.' });
    }
});

app.get('/api/productos', (req, res) => {
    const query = `SELECT p.*, GROUP_CONCAT(i.image_url) AS images
                   FROM products p
                   LEFT JOIN product_images i ON p.id = i.product_id
                   GROUP BY p.id
                   ORDER BY p.id DESC`;

    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'No fue posible consultar los productos.' });
            return;
        }

        const productos = rows.map((row) => ({
            id: row.id,
            marca: row.marca,
            modelo: row.modelo,
            codigo: row.codigo,
            precioCompra: row.precio_compra,
            precioVenta: row.precio_venta,
            descripcion: row.descripcion,
            clasificacion: row.clasificacion,
            departamento: row.departamento,
            imagenes: row.images ? row.images.split(',').map((img) => img.trim()).filter(Boolean) : []
        }));

        res.json({ productos });
    });
});

app.post('/api/productos', requireAdminAuth, (req, res) => {
    const { producto, errores } = validarPayloadProducto(req.body || {});
    if (errores.length) {
        res.status(400).json({ error: 'Datos inválidos', campos: errores });
        return;
    }

    const sql = `INSERT INTO products (
                    marca, modelo, codigo, precio_compra, precio_venta, descripcion, clasificacion, departamento
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(
        sql,
        [
            producto.marca,
            producto.modelo,
            producto.codigo,
            producto.precioCompra,
            producto.precioVenta,
            producto.descripcion,
            producto.clasificacion,
            producto.departamento
        ],
        function onInsert(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible crear el producto.' });
                return;
            }

            const productId = this.lastID;
            insertarImagenes(productId, producto.imagenes, (insertErr) => {
                if (insertErr) {
                    res.status(500).json({ error: 'Producto creado, pero hubo un error al guardar imágenes.' });
                    return;
                }
                res.status(201).json({ id: productId });
            });
        }
    );
});

app.put('/api/productos/:id', requireAdminAuth, (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    const { producto, errores } = validarPayloadProducto(req.body || {});
    if (errores.length) {
        res.status(400).json({ error: 'Datos inválidos', campos: errores });
        return;
    }

    const sql = `UPDATE products
                 SET marca = ?, modelo = ?, codigo = ?, precio_compra = ?, precio_venta = ?, descripcion = ?, clasificacion = ?, departamento = ?
                 WHERE id = ?`;

    db.run(
        sql,
        [
            producto.marca,
            producto.modelo,
            producto.codigo,
            producto.precioCompra,
            producto.precioVenta,
            producto.descripcion,
            producto.clasificacion,
            producto.departamento,
            productId
        ],
        function onUpdate(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible actualizar el producto.' });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Producto no encontrado.' });
                return;
            }

            db.run('DELETE FROM product_images WHERE product_id = ?', [productId], (deleteErr) => {
                if (deleteErr) {
                    res.status(500).json({ error: 'No fue posible actualizar las imágenes del producto.' });
                    return;
                }

                insertarImagenes(productId, producto.imagenes, (insertErr) => {
                    if (insertErr) {
                        res.status(500).json({ error: 'Producto actualizado, pero hubo un error al guardar imágenes.' });
                        return;
                    }
                    res.json({ updated: true });
                });
            });
        }
    );
});

app.delete('/api/productos/:id', requireAdminAuth, (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    db.run('DELETE FROM product_images WHERE product_id = ?', [productId], (imagesErr) => {
        if (imagesErr) {
            res.status(500).json({ error: 'No fue posible eliminar imágenes del producto.' });
            return;
        }

        db.run('DELETE FROM products WHERE id = ?', [productId], function onDelete(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible eliminar el producto.' });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Producto no encontrado.' });
                return;
            }
            res.json({ deleted: true });
        });
    });
});

app.post('/api/productos/:id/images', requireAdminAuth, upload.array('imagenes'), (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    const imagenes = Array.isArray(req.files)
        ? req.files.map((file) => `/uploads/${file.filename}`)
        : [];

    if (!imagenes.length) {
        res.status(400).json({ error: 'No se recibieron imágenes.' });
        return;
    }

    insertarImagenes(productId, imagenes, (err) => {
        if (err) {
            res.status(500).json({ error: 'No fue posible guardar las imágenes.' });
            return;
        }
        res.json({ uploaded: imagenes.length });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

PUBLIC_FILES.forEach((file) => {
    app.get(`/${file}`, (req, res) => {
        res.sendFile(path.join(ROOT_DIR, file));
    });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ error: 'Error al subir archivo.', detalle: err.message });
        return;
    }
    if (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
        return;
    }
    next();
});

async function iniciarServidor() {
    try {
        await asegurarDatosIniciales();
        app.listen(PORT, () => {
            console.log(`Servidor iniciado en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('No fue posible iniciar el servidor:', error);
        process.exit(1);
    }
}

iniciarServidor();
