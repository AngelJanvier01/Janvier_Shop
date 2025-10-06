const body = document.body;
const themeButton = document.querySelector('.theme-toggle');

function aplicarTemaPreferido() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light-mode' || savedTheme === 'dark-mode') {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(savedTheme);
        if (themeButton) {
            const isLight = savedTheme === 'light-mode';
            themeButton.setAttribute('aria-pressed', String(isLight));
        }
    }
}

aplicarTemaPreferido();

if (themeButton) {
    const isLight = body.classList.contains('light-mode');
    themeButton.setAttribute('aria-pressed', String(isLight));
    themeButton.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        body.classList.toggle('dark-mode');
        const isLight = body.classList.contains('light-mode');
        themeButton.setAttribute('aria-pressed', String(isLight));
        localStorage.setItem('theme', isLight ? 'light-mode' : 'dark-mode');
    });
}

const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.getElementById('nav-links');

function cerrarMenu() {
    if (navLinks && mobileMenu) {
        navLinks.classList.remove('show');
        mobileMenu.setAttribute('aria-expanded', 'false');
    }
}

if (mobileMenu && navLinks) {
    mobileMenu.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('show');
        mobileMenu.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => cerrarMenu());
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!navLinks.contains(target) && !mobileMenu.contains(target)) {
            cerrarMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarMenu();
        }
    });
}

if (!body.classList.contains('light-mode') && !body.classList.contains('dark-mode')) {
    body.classList.add('dark-mode');
}
