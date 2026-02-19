let productos = [];
let productoSeleccionadoId = null;

const productList = document.getElementById('product-list');
const agregarBtn = document.getElementById('agregar-producto-btn');
const formulario = document.getElementById('product-form');
const confirmarEliminarBtn = document.getElementById('confirmar-eliminar');
const modalProducto = document.getElementById('modal-producto');
const modalEliminar = document.getElementById('modal-eliminar');
const modalTitle = document.getElementById('modal-title');

function obtenerApiUrl() {
    const apiBaseMeta = document.querySelector('meta[name="api-base"]');
    const apiBase = apiBaseMeta ? apiBaseMeta.content : '/api';
    const sanitizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

    if (window.location.protocol === 'file:' && sanitizedBase.startsWith('/')) {
        return `http://localhost:3000${sanitizedBase}/productos`;
    }
    return `${sanitizedBase}/productos`;
}

const API_URL = obtenerApiUrl();

function formatearMoneda(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        return '—';
    }
    return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function mostrarAviso(texto, tipo = 'error') {
    if (!productList) {
        return;
    }
    productList.innerHTML = '';
    const aviso = document.createElement('p');
    aviso.className = tipo === 'error' ? 'mensaje-error' : 'mensaje-vacio';
    aviso.textContent = texto;
    productList.appendChild(aviso);
}

function crearLineaDetalle(etiqueta, valor) {
    const linea = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${etiqueta}: `;
    linea.appendChild(strong);
    linea.appendChild(document.createTextNode(valor || '—'));
    return linea;
}

function renderProductos() {
    if (!productList) {
        return;
    }

    productList.innerHTML = '';

    if (!productos.length) {
        mostrarAviso('Aún no hay productos registrados.', 'vacio');
        return;
    }

    const fragment = document.createDocumentFragment();

    productos.forEach((producto) => {
        const card = document.createElement('article');
        card.className = 'producto';

        const imagenPrincipal = (producto.imagenes && producto.imagenes[0]) || producto.imagen || '';
        if (imagenPrincipal) {
            const img = document.createElement('img');
            img.src = imagenPrincipal;
            img.alt = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto';
            img.loading = 'lazy';
            card.appendChild(img);
        }

        const nombre = document.createElement('p');
        nombre.className = 'producto-nombre';
        nombre.textContent = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto sin nombre';
        card.appendChild(nombre);

        card.appendChild(crearLineaDetalle('Código', producto.codigo));
        card.appendChild(crearLineaDetalle('Departamento', producto.departamento));
        card.appendChild(crearLineaDetalle('Clasificación', producto.clasificacion));
        card.appendChild(crearLineaDetalle('Precio venta', formatearMoneda(producto.precioVenta)));
        card.appendChild(crearLineaDetalle('Precio compra', formatearMoneda(producto.precioCompra)));

        const acciones = document.createElement('div');
        acciones.className = 'acciones';

        const editarBtn = document.createElement('button');
        editarBtn.className = 'btn editar-btn';
        editarBtn.type = 'button';
        editarBtn.textContent = 'Editar';
        editarBtn.addEventListener('click', () => abrirFormulario('editar', producto.id));
        acciones.appendChild(editarBtn);

        const eliminarBtn = document.createElement('button');
        eliminarBtn.className = 'btn eliminar-btn';
        eliminarBtn.type = 'button';
        eliminarBtn.textContent = 'Eliminar';
        eliminarBtn.addEventListener('click', () => abrirModalEliminar(producto.id));
        acciones.appendChild(eliminarBtn);

        card.appendChild(acciones);
        fragment.appendChild(card);
    });

    productList.appendChild(fragment);
}

async function cargarProductos() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const data = await respuesta.json();
        productos = Array.isArray(data.productos) ? data.productos : [];
        renderProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        productos = [];
        mostrarAviso('No se pudieron cargar los productos. Verifica que el backend esté en ejecución.');
    }
}

function abrirModal(modal) {
    if (!modal) {
        return;
    }
    modal.style.display = 'flex';
}

function cerrarModal() {
    [modalProducto, modalEliminar].forEach((modal) => {
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

function obtenerProductoPorId(id) {
    return productos.find((item) => item.id === id) || null;
}

function limpiarFormulario() {
    if (!formulario || !modalTitle) {
        return;
    }
    formulario.reset();
    formulario.dataset.modo = 'crear';
    modalTitle.textContent = 'Agregar Producto';
}

function abrirFormulario(modo, id = null) {
    if (modo === 'crear') {
        productoSeleccionadoId = null;
        limpiarFormulario();
        abrirModal(modalProducto);
        return;
    }

    const producto = obtenerProductoPorId(id);
    if (!producto) {
        alert('No encontramos el producto que deseas editar.');
        return;
    }

    productoSeleccionadoId = id;
    if (!formulario || !modalTitle) {
        return;
    }

    formulario.dataset.modo = 'editar';
    modalTitle.textContent = 'Editar Producto';

    formulario.marca.value = producto.marca || '';
    formulario.modelo.value = producto.modelo || '';
    formulario.codigo.value = producto.codigo || '';
    formulario.precioCompra.value = producto.precioCompra ?? '';
    formulario.precioVenta.value = producto.precioVenta ?? '';
    formulario.descripcion.value = producto.descripcion || '';
    formulario.clasificacion.value = producto.clasificacion || '';
    formulario.departamento.value = producto.departamento || '';
    const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
    formulario.imagen.value = imagenes.join(', ');

    abrirModal(modalProducto);
}

function abrirModalEliminar(id) {
    productoSeleccionadoId = id;
    abrirModal(modalEliminar);
}

function extraerImagenes(raw) {
    return raw
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
}

function parsearNumero(valor) {
    if (valor === '') {
        return null;
    }
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : Number.NaN;
}

function construirPayload() {
    if (!formulario) {
        return null;
    }

    const precioVenta = parsearNumero(formulario.precioVenta.value.trim());
    const precioCompra = parsearNumero(formulario.precioCompra.value.trim());

    return {
        marca: formulario.marca.value.trim(),
        modelo: formulario.modelo.value.trim(),
        codigo: formulario.codigo.value.trim(),
        precioCompra,
        precioVenta,
        descripcion: formulario.descripcion.value.trim(),
        clasificacion: formulario.clasificacion.value.trim(),
        departamento: formulario.departamento.value.trim(),
        imagenes: extraerImagenes(formulario.imagen.value)
    };
}

function validarPayload(payload) {
    if (!payload.marca || !payload.modelo || !payload.clasificacion || !payload.departamento) {
        return 'Completa marca, modelo, clasificación y departamento.';
    }
    if (payload.precioVenta === null || Number.isNaN(payload.precioVenta) || payload.precioVenta < 0) {
        return 'Ingresa un precio de venta válido.';
    }
    if (Number.isNaN(payload.precioCompra) || payload.precioCompra < 0) {
        return 'El precio de compra debe ser un número válido.';
    }
    return '';
}

async function crearProducto(producto) {
    const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto)
    });

    if (!respuesta.ok) {
        throw await construirErrorApi(respuesta, 'No fue posible crear el producto');
    }
}

async function actualizarProducto(id, producto) {
    const respuesta = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto)
    });

    if (!respuesta.ok) {
        throw await construirErrorApi(respuesta, 'No fue posible actualizar el producto');
    }
}

async function eliminarProducto(id) {
    const respuesta = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!respuesta.ok) {
        throw await construirErrorApi(respuesta, 'No fue posible eliminar el producto');
    }
}

async function construirErrorApi(respuesta, mensajeBase) {
    try {
        const data = await respuesta.json();
        const detalle = data.error ? `${mensajeBase}: ${data.error}` : `${mensajeBase}.`;
        return new Error(detalle);
    } catch (err) {
        return new Error(`${mensajeBase} (status ${respuesta.status}).`);
    }
}

if (agregarBtn) {
    agregarBtn.addEventListener('click', () => abrirFormulario('crear'));
}

if (formulario) {
    formulario.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = construirPayload();
        if (!payload) {
            alert('No fue posible leer el formulario.');
            return;
        }

        const error = validarPayload(payload);
        if (error) {
            alert(error);
            return;
        }

        try {
            if (productoSeleccionadoId) {
                await actualizarProducto(productoSeleccionadoId, payload);
            } else {
                await crearProducto(payload);
            }
            cerrarModal();
            await cargarProductos();
        } catch (err) {
            console.error(err);
            alert(err.message || 'Ocurrió un problema al guardar el producto.');
        }
    });
}

if (confirmarEliminarBtn) {
    confirmarEliminarBtn.addEventListener('click', async () => {
        if (!productoSeleccionadoId) {
            return;
        }
        try {
            await eliminarProducto(productoSeleccionadoId);
            cerrarModal();
            await cargarProductos();
        } catch (err) {
            console.error(err);
            alert(err.message || 'No se pudo eliminar el producto.');
        }
    });
}

document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            cerrarModal();
        }
    });
});

document.querySelectorAll('[data-close-modal]').forEach((boton) => {
    boton.addEventListener('click', () => cerrarModal());
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        cerrarModal();
    }
});

cargarProductos();
