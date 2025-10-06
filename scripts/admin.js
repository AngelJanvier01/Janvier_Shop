let productos = [];
let productoSeleccionado = null;

const apiBaseMeta = document.querySelector('meta[name="api-base"]');
const apiBase = apiBaseMeta ? apiBaseMeta.content : '/api';
const sanitizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
const API_URL = `${sanitizedBase}/productos`;

function formatearMoneda(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        return valor || '—';
    }
    return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
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
        renderProductos('No se pudieron cargar los productos. Verifica el servidor.');
    }
}

function renderProductos(mensajeError) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';

    if (mensajeError) {
        const aviso = document.createElement('p');
        aviso.className = 'mensaje-error';
        aviso.textContent = mensajeError;
        productList.appendChild(aviso);
        return;
    }

    if (!productos.length) {
        const vacio = document.createElement('p');
        vacio.className = 'mensaje-vacio';
        vacio.textContent = 'Aún no hay productos registrados.';
        productList.appendChild(vacio);
        return;
    }

    productos.forEach((producto, index) => {
        const contenedor = document.createElement('div');
        contenedor.classList.add('producto');

        const imagenPrincipal = (producto.imagenes && producto.imagenes[0]) || producto.imagen || '';
        if (imagenPrincipal) {
            const img = document.createElement('img');
            img.src = imagenPrincipal;
            img.alt = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto sin nombre';
            contenedor.appendChild(img);
        }

        const nombre = document.createElement('p');
        nombre.className = 'producto-nombre';
        const titulo = [producto.marca, producto.modelo].filter(Boolean).join(' ');
        nombre.textContent = titulo || producto.descripcion || 'Producto sin nombre';
        contenedor.appendChild(nombre);

        const campos = [
            ['Código', producto.codigo],
            ['Departamento', producto.departamento],
            ['Clasificación', producto.clasificacion],
            ['Precio venta', formatearMoneda(producto.precioVenta)],
            ['Precio compra', formatearMoneda(producto.precioCompra)]
        ];

        campos.forEach(([etiqueta, valor]) => {
            const linea = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = `${etiqueta}: `;
            linea.appendChild(strong);
            linea.appendChild(document.createTextNode(valor || '—'));
            contenedor.appendChild(linea);
        });

        const acciones = document.createElement('div');
        acciones.className = 'acciones';

        const editarBtn = document.createElement('button');
        editarBtn.className = 'btn editar-btn';
        editarBtn.type = 'button';
        editarBtn.textContent = 'Editar';
        editarBtn.addEventListener('click', () => mostrarFormularioEditar(index));
        acciones.appendChild(editarBtn);

        const eliminarBtn = document.createElement('button');
        eliminarBtn.className = 'btn eliminar-btn';
        eliminarBtn.type = 'button';
        eliminarBtn.textContent = 'Eliminar';
        eliminarBtn.addEventListener('click', () => mostrarModalEliminar(index));
        acciones.appendChild(eliminarBtn);

        contenedor.appendChild(acciones);
        productList.appendChild(contenedor);
    });
}

async function crearProducto(producto) {
    const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto)
    });
    if (!respuesta.ok) {
        throw new Error('No fue posible crear el producto');
    }
}

async function actualizarProducto(id, producto) {
    const respuesta = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto)
    });
    if (!respuesta.ok) {
        throw new Error('No fue posible actualizar el producto');
    }
}

async function eliminarProducto(id) {
    const respuesta = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!respuesta.ok) {
        throw new Error('No fue posible eliminar el producto');
    }
}

const agregarBtn = document.getElementById('agregar-producto-btn');
const formulario = document.getElementById('product-form');

agregarBtn.addEventListener('click', () => mostrarFormularioAgregar());

function mostrarFormularioAgregar() {
    productoSeleccionado = null;
    formulario.reset();
    formulario.dataset.modo = 'crear';
    document.getElementById('modal-title').textContent = 'Agregar Producto';
    mostrarModal('modal-producto');
}

function mostrarFormularioEditar(index) {
    productoSeleccionado = index;
    formulario.dataset.modo = 'editar';
    const producto = productos[index];
    document.getElementById('modal-title').textContent = 'Editar Producto';

    formulario.marca.value = producto.marca || '';
    formulario.modelo.value = producto.modelo || '';
    formulario.codigo.value = producto.codigo || '';
    formulario.precioCompra.value = producto.precioCompra ?? '';
    formulario.precioVenta.value = producto.precioVenta ?? '';
    formulario.descripcion.value = producto.descripcion || '';
    formulario.clasificacion.value = producto.clasificacion || '';
    formulario.departamento.value = producto.departamento || '';
    const imagenes = producto.imagenes || (producto.imagen ? [producto.imagen] : []);
    formulario.imagen.value = imagenes.join(', ');

    mostrarModal('modal-producto');
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const imagenes = formulario.imagen.value
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

    const precioVentaValor = formulario.precioVenta.value.trim();
    const precioCompraValor = formulario.precioCompra.value.trim();

    const productoPayload = {
        marca: formulario.marca.value.trim(),
        modelo: formulario.modelo.value.trim(),
        codigo: formulario.codigo.value.trim(),
        precioCompra: precioCompraValor ? Number(precioCompraValor) : null,
        precioVenta: precioVentaValor ? Number(precioVentaValor) : null,
        descripcion: formulario.descripcion.value.trim(),
        clasificacion: formulario.clasificacion.value.trim(),
        departamento: formulario.departamento.value.trim(),
        imagenes
    };

    if (productoPayload.precioVenta === null || Number.isNaN(productoPayload.precioVenta)) {
        alert('Ingresa un precio de venta válido.');
        return;
    }

    if (Number.isNaN(productoPayload.precioCompra)) {
        productoPayload.precioCompra = null;
    }

    try {
        if (productoSeleccionado !== null) {
            const id = productos[productoSeleccionado].id;
            await actualizarProducto(id, productoPayload);
        } else {
            await crearProducto(productoPayload);
        }
        await cargarProductos();
        cerrarModal();
    } catch (error) {
        console.error(error);
        alert('Ocurrió un problema al guardar el producto.');
    }
});

function mostrarModalEliminar(index) {
    productoSeleccionado = index;
    mostrarModal('modal-eliminar');
}

document.getElementById('confirmar-eliminar').addEventListener('click', async () => {
    if (productoSeleccionado === null) return;
    const id = productos[productoSeleccionado].id;
    try {
        await eliminarProducto(id);
        await cargarProductos();
        cerrarModal();
    } catch (error) {
        console.error(error);
        alert('No se pudo eliminar el producto.');
    }
});

function mostrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModal() {
    document.querySelectorAll('.modal').forEach((modal) => {
        modal.style.display = 'none';
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

cargarProductos();
