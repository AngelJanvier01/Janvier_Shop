let currentSlide = 0;
let autoplayId = null;
let carouselRef = null;
let controlsBound = false;
let lifecycleBound = false;
let hoverBoundContainer = null;

const reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

function cacheCarouselRefs() {
    if (carouselRef) {
        return carouselRef;
    }
    const container = document.querySelector('.carousel');
    const inner = container ? container.querySelector('.carousel-inner') : null;
    const slides = inner ? Array.from(inner.querySelectorAll('.carousel-item')) : [];
    carouselRef = { container, inner, slides };
    return carouselRef;
}

function resetCarouselRefs() {
    carouselRef = null;
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
    const { container, slides } = cacheCarouselRefs();
    const reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;
    return Boolean(container && !container.hidden && slides.length > 1 && !reducedMotion && !document.hidden);
}

function startAutoplay() {
    if (!shouldAutoplay()) {
        stopAutoplay();
        return;
    }

    stopAutoplay();
    autoplayId = window.setInterval(() => {
        moveSlide(1);
    }, 6000);
}

function bindControls() {
    if (!controlsBound) {
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const button = target.closest('[data-carousel-direction]');
            if (!button) {
                return;
            }

            const direction = Number(button.dataset.carouselDirection || 0);
            if (!direction) {
                return;
            }

            moveSlide(direction);
            startAutoplay();
        });

        controlsBound = true;
    }

    const { container } = cacheCarouselRefs();
    if (!container || hoverBoundContainer === container) {
        return;
    }

    if (hoverBoundContainer) {
        hoverBoundContainer.removeEventListener('mouseenter', stopAutoplay);
        hoverBoundContainer.removeEventListener('mouseleave', startAutoplay);
        hoverBoundContainer.removeEventListener('focusin', stopAutoplay);
        hoverBoundContainer.removeEventListener('focusout', handleFocusOut);
    }

    container.addEventListener('mouseenter', stopAutoplay);
    container.addEventListener('mouseleave', startAutoplay);
    container.addEventListener('focusin', stopAutoplay);
    container.addEventListener('focusout', handleFocusOut);

    hoverBoundContainer = container;
}

function handleFocusOut(event) {
    const { container } = cacheCarouselRefs();
    if (!container) {
        return;
    }
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
        return;
    }
    startAutoplay();
}

function bindPageLifecycle() {
    if (lifecycleBound) {
        return;
    }

    lifecycleBound = true;

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

function initCarousel() {
    resetCarouselRefs();
    stopAutoplay();

    const { slides } = cacheCarouselRefs();
    if (!slides.length) {
        return;
    }

    currentSlide = 0;
    showSlide(currentSlide);
    bindControls();
    bindPageLifecycle();
    startAutoplay();
}

document.addEventListener('DOMContentLoaded', initCarousel);
document.addEventListener('janvier:carousel-updated', initCarousel);
