(function initSiteSettings() {
    const FALLBACK_SETTINGS = {
        siteName: 'Janvier Shop',
        logoPath: 'images/logo.gif',
        faviconPath: 'images/favicon.gif',
        carouselEnabled: true,
        carouselSlides: []
    };

    let cachedSettings = null;

    function normalizarBaseApi() {
        const meta = document.querySelector('meta[name="api-base"]');
        const apiBase = meta ? meta.content : '/api';
        const sanitizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

        if (window.location.protocol === 'file:' && sanitizedBase.startsWith('/')) {
            return `http://localhost:3000${sanitizedBase}`;
        }

        return sanitizedBase;
    }

    function obtenerAjustesApiUrl() {
        return `${normalizarBaseApi()}/settings`;
    }

    function aplicarFavicon(path) {
        if (!path) {
            return;
        }

        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        favicon.href = path;
    }

    function aplicarLogo(path, siteName) {
        if (!path) {
            return;
        }

        document.querySelectorAll('[data-site-logo]').forEach((img) => {
            if (!(img instanceof HTMLImageElement)) {
                return;
            }
            img.src = path;
            img.alt = siteName || img.alt;
        });
    }

    function aplicarTextosPlanos(settings) {
        document.querySelectorAll('[data-setting-text]').forEach((element) => {
            const key = element.dataset.settingText;
            if (!key || !Object.prototype.hasOwnProperty.call(settings, key)) {
                return;
            }
            const value = settings[key];
            if (typeof value !== 'string') {
                return;
            }
            element.textContent = value;
        });

        document.querySelectorAll('[data-setting-href]').forEach((element) => {
            const key = element.dataset.settingHref;
            if (!key || !Object.prototype.hasOwnProperty.call(settings, key)) {
                return;
            }
            const value = settings[key];
            if (typeof value !== 'string' || !value.trim()) {
                return;
            }
            element.setAttribute('href', value);
        });

        document.querySelectorAll('[data-site-name]').forEach((element) => {
            element.textContent = settings.siteName || FALLBACK_SETTINGS.siteName;
        });
    }

    function aplicarTitulo(siteName) {
        const title = document.querySelector('title');
        if (!title || !siteName) {
            return;
        }
        title.textContent = title.textContent.replace(/Janvier Shop/g, siteName);
    }

    function aplicarTextoPersonalizado(customText) {
        const container = document.getElementById('custom-text-content');
        if (!container || typeof customText !== 'string' || !customText.trim()) {
            return;
        }

        const bloques = customText
            .split(/\n\s*\n/g)
            .map((bloque) => bloque.trim())
            .filter(Boolean);

        if (!bloques.length) {
            return;
        }

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        bloques.forEach((bloque) => {
            const p = document.createElement('p');
            p.textContent = bloque;
            fragment.appendChild(p);
        });
        container.appendChild(fragment);
    }

    function renderizarCarrusel(slides) {
        const carousel = document.querySelector('.carousel');
        const inner = document.querySelector('.carousel-inner');
        if (!carousel || !inner || !Array.isArray(slides)) {
            return;
        }

        if (!slides.length) {
            return;
        }

        inner.innerHTML = '';
        const fragment = document.createDocumentFragment();

        slides.forEach((slide, index) => {
            if (!slide || typeof slide !== 'object' || !slide.image) {
                return;
            }

            const item = document.createElement('div');
            item.className = 'carousel-item';
            if (index === 0) {
                item.classList.add('active');
            }

            const img = document.createElement('img');
            img.src = slide.image;
            img.alt = slide.alt || 'Promoción Janvier Shop';
            img.loading = index === 0 ? 'eager' : 'lazy';

            item.appendChild(img);
            fragment.appendChild(item);
        });

        if (!fragment.childNodes.length) {
            return;
        }

        inner.appendChild(fragment);
        carousel.hidden = false;
        document.dispatchEvent(new CustomEvent('janvier:carousel-updated'));
    }

    function aplicarCarrusel(settings) {
        const carousel = document.querySelector('.carousel');
        if (!carousel) {
            return;
        }

        if (settings.carouselEnabled === false) {
            carousel.hidden = true;
            return;
        }

        carousel.hidden = false;
        renderizarCarrusel(settings.carouselSlides || []);
    }

    async function cargarAjustes() {
        try {
            const response = await fetch(obtenerAjustesApiUrl(), { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            const data = await response.json();
            const settings = data && data.settings && typeof data.settings === 'object'
                ? data.settings
                : {};

            cachedSettings = {
                ...FALLBACK_SETTINGS,
                ...settings
            };
            return cachedSettings;
        } catch (error) {
            return null;
        }
    }

    function aplicarAjustesEnDom(settings) {
        aplicarFavicon(settings.faviconPath);
        aplicarLogo(settings.logoPath, settings.siteName);
        aplicarTextosPlanos(settings);
        aplicarTitulo(settings.siteName);
        aplicarTextoPersonalizado(settings.customText);
        aplicarCarrusel(settings);
    }

    async function aplicarAjustesSitio(forceReload = true) {
        let settings = cachedSettings;
        if (forceReload || !settings) {
            settings = await cargarAjustes();
        }
        if (!settings) {
            return null;
        }

        aplicarAjustesEnDom(settings);
        return settings;
    }

    window.JanvierSiteSettings = {
        load: (forceReload = true) => aplicarAjustesSitio(forceReload),
        applyCached: () => aplicarAjustesSitio(false),
        get: () => cachedSettings
    };

    document.addEventListener('janvier:layout-updated', () => {
        if (cachedSettings) {
            aplicarAjustesEnDom(cachedSettings);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            aplicarAjustesSitio();
        });
    } else {
        aplicarAjustesSitio();
    }
})();
