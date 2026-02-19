function obtenerRutaPaginaActual() {
    const pathname = window.location.pathname;
    const archivo = pathname.split('/').pop() || 'index.html';
    if (archivo === '' || archivo === '/') {
        return 'index.html';
    }
    return archivo;
}

const CACHE_KEYS = {
    footer: 'janvier:footer-html',
    customText: 'janvier:custom-text'
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
                <p>&copy; <span data-current-year>${year}</span> Janvier Shop.</p>
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

function obtenerTextoPersonalizadoFallback() {
    return [
        'Hola, soy Ángel Janvier: ingeniero de software y fundador de Janvier Shop.',
        'Aquí combinamos productos tecnológicos y desarrollo digital para crear soluciones con identidad.'
    ];
}

function actualizarAnioFooter(placeholder) {
    const yearLabel = placeholder.querySelector('[data-current-year]');
    if (yearLabel) {
        yearLabel.textContent = String(new Date().getFullYear());
    }
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
    } catch (error) {
        console.error('No se pudo cargar el footer:', error);
        placeholder.innerHTML = obtenerFooterFallback();
    }
}

function crearParrafosDesdeTexto(texto) {
    const fragmento = document.createDocumentFragment();
    const bloques = texto
        .split(/\n\s*\n/g)
        .map((bloque) => bloque.trim())
        .filter(Boolean);

    if (!bloques.length) {
        const vacio = document.createElement('p');
        vacio.textContent = 'Pronto compartiremos novedades.';
        fragmento.appendChild(vacio);
        return fragmento;
    }

    bloques.forEach((bloque) => {
        const parrafo = document.createElement('p');
        parrafo.textContent = bloque;
        fragmento.appendChild(parrafo);
    });

    return fragmento;
}

async function cargarTextoPersonalizado() {
    const contenido = document.getElementById('custom-text-content');
    if (!contenido) {
        return;
    }

    const textoCache = leerCacheSesion(CACHE_KEYS.customText);
    if (textoCache) {
        contenido.innerHTML = '';
        contenido.appendChild(crearParrafosDesdeTexto(textoCache));
        return;
    }

    try {
        const respuesta = await fetch('data/custom-text.txt', { cache: 'force-cache' });
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const texto = await respuesta.text();
        guardarCacheSesion(CACHE_KEYS.customText, texto);
        contenido.innerHTML = '';
        contenido.appendChild(crearParrafosDesdeTexto(texto));
    } catch (error) {
        console.error('No se pudo cargar el texto personalizado:', error);
        contenido.innerHTML = '';
        obtenerTextoPersonalizadoFallback().forEach((linea) => {
            const fallback = document.createElement('p');
            fallback.textContent = linea;
            contenido.appendChild(fallback);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    marcarNavegacionActiva();
    cargarFooter();
    cargarTextoPersonalizado();
});
