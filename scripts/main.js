const body = document.body;
const themeButton = document.querySelector('.theme-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.getElementById('nav-links');
const THEMES = ['light-mode', 'dark-mode'];

function aplicarTema(theme) {
    body.classList.remove(...THEMES);
    body.classList.add(theme);
    if (themeButton) {
        const esModoMasOscuro = theme === 'light-mode';
        themeButton.setAttribute('aria-pressed', String(esModoMasOscuro));
        const sr = themeButton.querySelector('.sr-only');
        if (sr) {
            sr.textContent = esModoMasOscuro ? 'Cambiar a modo oscuro' : 'Cambiar a modo más oscuro';
        }
    }
}

function obtenerTemaInicial() {
    const savedTheme = localStorage.getItem('theme');
    if (THEMES.includes(savedTheme)) {
        return savedTheme;
    }
    return body.classList.contains('light-mode') ? 'light-mode' : 'dark-mode';
}

function inicializarTema() {
    aplicarTema(obtenerTemaInicial());

    if (!themeButton) {
        return;
    }

    themeButton.addEventListener('click', () => {
        const nuevoTema = body.classList.contains('light-mode') ? 'dark-mode' : 'light-mode';
        aplicarTema(nuevoTema);
        localStorage.setItem('theme', nuevoTema);
    });
}

function cerrarMenu() {
    if (!navLinks || !mobileMenu) {
        return;
    }
    navLinks.classList.remove('show');
    actualizarEstadoMenu(false);
}

function actualizarEstadoMenu(isOpen) {
    if (!mobileMenu) {
        return;
    }
    mobileMenu.setAttribute('aria-expanded', String(isOpen));
    const sr = mobileMenu.querySelector('.sr-only');
    if (sr) {
        sr.textContent = isOpen ? 'Cerrar menú' : 'Abrir menú';
    }
}

function registrarCierreEnViewportGrande() {
    if (!window.matchMedia) {
        let resizeRafId = null;
        const raf = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 16));
        window.addEventListener('resize', () => {
            if (resizeRafId !== null) {
                return;
            }
            resizeRafId = raf(() => {
                resizeRafId = null;
                if (window.innerWidth > 768) {
                    cerrarMenu();
                }
            });
        });
        return;
    }

    const desktopQuery = window.matchMedia('(min-width: 769px)');
    const handleChange = (event) => {
        if (event.matches) {
            cerrarMenu();
        }
    };

    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', handleChange);
    } else if (typeof desktopQuery.addListener === 'function') {
        desktopQuery.addListener(handleChange);
    }
}

function inicializarMenuMovil() {
    if (!mobileMenu || !navLinks) {
        return;
    }

    actualizarEstadoMenu(false);

    mobileMenu.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('show');
        actualizarEstadoMenu(isOpen);
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', cerrarMenu);
    });

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Node)) {
            return;
        }
        if (!navLinks.contains(event.target) && !mobileMenu.contains(event.target)) {
            cerrarMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarMenu();
        }
    });
    registrarCierreEnViewportGrande();
}

inicializarTema();
inicializarMenuMovil();
