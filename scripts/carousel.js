let currentSlide = 0;
let autoplayId = null;
let carouselRef = null;
const reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

function cacheCarouselRefs() {
    if (carouselRef) {
        return carouselRef;
    }
    const container = document.querySelector('.carousel');
    const inner = document.querySelector('.carousel-inner');
    const slides = Array.from(document.querySelectorAll('.carousel-item'));
    carouselRef = { container, inner, slides };
    return carouselRef;
}

function showSlide(index) {
    const { inner, slides } = cacheCarouselRefs();
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
    inner.style.transform = `translate3d(${offset}%, 0, 0)`;
}

function moveSlide(direction) {
    showSlide(currentSlide + direction);
}

function stopAutoplay() {
    if (autoplayId !== null) {
        window.clearInterval(autoplayId);
        autoplayId = null;
    }
}

function shouldAutoplay() {
    const reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;
    return !reducedMotion && !document.hidden;
}

function startAutoplay() {
    const { slides } = cacheCarouselRefs();
    if (slides.length <= 1 || !shouldAutoplay()) {
        stopAutoplay();
        return;
    }
    stopAutoplay();
    autoplayId = window.setInterval(() => {
        moveSlide(1);
    }, 6000);
}

function bindControls() {
    const { container } = cacheCarouselRefs();
    if (!container) {
        return;
    }

    document.querySelectorAll('[data-carousel-direction]').forEach((button) => {
        button.addEventListener('click', () => {
            const direction = Number(button.dataset.carouselDirection || 0);
            if (!direction) {
                return;
            }
            moveSlide(direction);
            startAutoplay();
        });
    });

    container.addEventListener('mouseenter', stopAutoplay);
    container.addEventListener('mouseleave', startAutoplay);
    container.addEventListener('focusin', stopAutoplay);
    container.addEventListener('focusout', (event) => {
        if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
            return;
        }
        startAutoplay();
    });
}

function bindPageLifecycle() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoplay();
        } else {
            startAutoplay();
        }
    });

    if (reducedMotionQuery) {
        const handleMotionChange = () => startAutoplay();
        if (typeof reducedMotionQuery.addEventListener === 'function') {
            reducedMotionQuery.addEventListener('change', handleMotionChange);
        } else if (typeof reducedMotionQuery.addListener === 'function') {
            reducedMotionQuery.addListener(handleMotionChange);
        }
    }

    window.addEventListener('pagehide', stopAutoplay, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    const { slides } = cacheCarouselRefs();
    if (!slides.length) {
        return;
    }
    showSlide(currentSlide);
    bindControls();
    bindPageLifecycle();
    startAutoplay();
});
