let currentSlide = 0;
let autoplayId = null;

function obtenerCarousel() {
    const contenedor = document.querySelector('.carousel');
    const inner = document.querySelector('.carousel-inner');
    const slides = document.querySelectorAll('.carousel-item');
    return { contenedor, inner, slides };
}

function showSlide(index) {
    const { inner, slides } = obtenerCarousel();
    if (!inner || slides.length === 0) {
        return;
    }

    if (index >= slides.length) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide = slides.length - 1;
    } else {
        currentSlide = index;
    }

    const offset = -currentSlide * 100;
    inner.style.transform = `translateX(${offset}%)`;
}

function moveSlide(direction) {
    showSlide(currentSlide + direction);
}

function detenerAutoplay() {
    if (autoplayId !== null) {
        window.clearInterval(autoplayId);
        autoplayId = null;
    }
}

function iniciarAutoplay() {
    const { slides } = obtenerCarousel();
    if (slides.length <= 1) {
        return;
    }
    detenerAutoplay();
    autoplayId = window.setInterval(() => {
        moveSlide(1);
    }, 6000);
}

function enlazarControles() {
    const { contenedor } = obtenerCarousel();
    if (!contenedor) {
        return;
    }

    document.querySelectorAll('[data-carousel-direction]').forEach((boton) => {
        boton.addEventListener('click', () => {
            const direction = Number(boton.dataset.carouselDirection || 0);
            if (!direction) {
                return;
            }
            moveSlide(direction);
            iniciarAutoplay();
        });
    });

    contenedor.addEventListener('mouseenter', detenerAutoplay);
    contenedor.addEventListener('mouseleave', iniciarAutoplay);

    contenedor.addEventListener('focusin', detenerAutoplay);
    contenedor.addEventListener('focusout', iniciarAutoplay);
}

document.addEventListener('DOMContentLoaded', () => {
    const { slides } = obtenerCarousel();
    if (!slides.length) {
        return;
    }
    showSlide(currentSlide);
    enlazarControles();
    iniciarAutoplay();
});
