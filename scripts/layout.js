function obtenerRutaPaginaActual() {
    const pathname = window.location.pathname;
    const archivo = pathname.split('/').pop() || 'index.html';
    if (archivo === '' || archivo === '/') {
        return 'index.html';
    }
    return archivo;
}

const CACHE_KEYS = {
    footer: 'janvier:footer-html'
};

function leerCacheSesion(clave) {
    try {
        return sessionStorage.getItem(clave);
    } catch (error) {
        return null;
    }
}

function guardarCacheSesion(clave, valor) {
    try {
        sessionStorage.setItem(clave, valor);
    } catch (error) {
        // Ignora almacenamiento bloqueado por el navegador.
    }
}

function marcarNavegacionActiva() {
    const mapa = {
        'index.html': 'index',
        'catalogo.html': 'catalogo',
        'contacto.html': 'contacto'
    };
    const pagina = obtenerRutaPaginaActual();
    const navActual = mapa[pagina];
    if (!navActual) {
        return;
    }

    document.querySelectorAll('[data-nav]').forEach((enlace) => {
        const activo = enlace.dataset.nav === navActual;
        enlace.classList.toggle('is-active', activo);
        if (activo) {
            enlace.setAttribute('aria-current', 'page');
        } else {
            enlace.removeAttribute('aria-current');
        }
    });
}

function obtenerFooterFallback() {
    const year = new Date().getFullYear();
    return `
        <footer>
            <div class="footer-container">
                <p>&copy; <span data-current-year>${year}</span> <span data-site-name>Janvier Shop</span>.</p>
                <ul class="footer-links">
                    <li><a href="index.html">Inicio</a></li>
                    <li><a href="catalogo.html">Catálogo</a></li>
                    <li><a href="contacto.html">Contacto</a></li>
                </ul>
                <div class="footer-social">
                    <a href="https://wa.link/neupli" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    <a href="https://www.instagram.com/tech_solutions_janvier?igsh=MTE1MTA5NDdmbGlqYg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer">Instagram</a>
                    <a href="admin.html">Acceso Admin</a>
                </div>
            </div>
        </footer>
    `;
}

function actualizarAnioFooter(placeholder) {
    const yearLabel = placeholder.querySelector('[data-current-year]');
    if (yearLabel) {
        yearLabel.textContent = String(new Date().getFullYear());
    }
}

function notificarLayoutActualizado() {
    document.dispatchEvent(new Event('janvier:layout-updated'));
}

async function cargarFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) {
        return;
    }

    const footerCache = leerCacheSesion(CACHE_KEYS.footer);
    if (footerCache) {
        placeholder.innerHTML = footerCache;
        actualizarAnioFooter(placeholder);
        notificarLayoutActualizado();
        return;
    }

    try {
        const respuesta = await fetch('footer.html', { cache: 'force-cache' });
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const html = await respuesta.text();
        guardarCacheSesion(CACHE_KEYS.footer, html);
        placeholder.innerHTML = html;
        actualizarAnioFooter(placeholder);
        notificarLayoutActualizado();
    } catch (error) {
        console.error('No se pudo cargar el footer:', error);
        placeholder.innerHTML = obtenerFooterFallback();
        notificarLayoutActualizado();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    marcarNavegacionActiva();
    cargarFooter();
});
