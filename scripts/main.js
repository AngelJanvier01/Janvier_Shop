// Alternar entre modo claro y oscuro para el contenido de la página
const themeButton = document.querySelector('.theme-toggle');
const body = document.body;

// Cargar preferencia de modo desde localStorage (si existe)
const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
    body.classList.remove("dark-mode", "light-mode");
    body.classList.add(savedTheme);
}

// Alternar el modo y guardar la preferencia en localStorage
themeButton.addEventListener("click", () => {
    body.classList.toggle("light-mode");
    body.classList.toggle("dark-mode");

    if (body.classList.contains("light-mode")) {
        localStorage.setItem("theme", "light-mode");
    } else {
        localStorage.setItem("theme", "dark-mode");
    }
});

// Alternar el menú hamburguesa en dispositivos móviles
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

// Alternar el menú al hacer clic en el botón hamburguesa
mobileMenu.addEventListener('click', () => {
    navLinks.classList.toggle('show');
});

// Cerrar el menú cuando se haga clic fuera del mismo
window.addEventListener('click', function (e) {
    if (!mobileMenu.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('show');
    }
});
