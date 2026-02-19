(function initSiteLoader() {
    const loader = document.getElementById('site-loader');
    if (!loader) {
        return;
    }

    const body = document.body;
    let isHidden = false;
    let autoHideTimer = null;
    let fallbackHideTimer = null;
    let cleanupTimer = null;

    function clearAutoTimer() {
        if (autoHideTimer !== null) {
            window.clearTimeout(autoHideTimer);
            autoHideTimer = null;
        }
    }

    function clearCleanupTimer() {
        if (cleanupTimer !== null) {
            window.clearTimeout(cleanupTimer);
            cleanupTimer = null;
        }
    }

    function clearFallbackTimer() {
        if (fallbackHideTimer !== null) {
            window.clearTimeout(fallbackHideTimer);
            fallbackHideTimer = null;
        }
    }

    function removeListeners() {
        window.removeEventListener('pointerdown', hideLoader, true);
        window.removeEventListener('wheel', hideLoader, true);
        window.removeEventListener('touchstart', hideLoader, true);
        window.removeEventListener('keydown', hideLoader, true);
        window.removeEventListener('scroll', hideLoader, true);
    }

    function destroyLoader() {
        clearCleanupTimer();
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    }

    function hideLoader() {
        if (isHidden) {
            return;
        }
        isHidden = true;
        clearAutoTimer();
        clearFallbackTimer();
        clearCleanupTimer();
        removeListeners();

        loader.classList.add('is-hidden');
        loader.setAttribute('aria-hidden', 'true');
        body.classList.remove('loader-active');

        loader.addEventListener('transitionend', (event) => {
            if (event.target === loader) {
                destroyLoader();
            }
        }, { once: true });
        cleanupTimer = window.setTimeout(destroyLoader, 550);
    }

    window.addEventListener('pointerdown', hideLoader, true);
    window.addEventListener('wheel', hideLoader, { passive: true, capture: true });
    window.addEventListener('touchstart', hideLoader, { passive: true, capture: true });
    window.addEventListener('keydown', hideLoader, true);
    window.addEventListener('scroll', hideLoader, { passive: true, capture: true });

    window.addEventListener('load', () => {
        autoHideTimer = window.setTimeout(hideLoader, 4000);
    }, { once: true });

    // Fallback de seguridad por si el evento load no llega.
    fallbackHideTimer = window.setTimeout(hideLoader, 12000);
})();
