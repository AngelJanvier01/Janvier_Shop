const catalogoContainer = document.getElementById('catalogo-container');
const mensajeCatalogo = document.getElementById('catalogo-mensaje');
const filtroDepartamento = document.getElementById('filtro-departamento');
const filtroMarca = document.getElementById('filtro-marca');
const filtroClasificacion = document.getElementById('filtro-clasificacion');
const botonRestablecer = document.getElementById('restablecer-filtros-btn');

let productos = [];
const PRODUCTOS_FALLBACK = [
    {
        marca: 'Apple',
        modelo: 'MacBook Pro M3 de 16.3',
        codigo: 'MBP16-M3',
        precioCompra: 60000,
        precioVenta: 74999,
        descripcion: 'Chip M3 Max con alto rendimiento para trabajo creativo y profesional.',
        clasificacion: 'Laptops',
        departamento: 'Electrónica',
        imagen: 'images/producto1.png'
    },
    {
        marca: 'Microsoft',
        modelo: 'Surface Laptop 4',
        codigo: 'SL4-256',
        precioCompra: 32000,
        precioVenta: 42000,
        descripcion: 'Laptop ligera con Intel i7, 16GB RAM y 512GB SSD.',
        clasificacion: 'Laptops',
        departamento: 'Electrónica',
        imagen: 'images/producto2.png'
    },
    {
        marca: 'Ninja',
        modelo: 'Ninja Master',
        codigo: '4922660224',
        precioCompra: 1500,
        precioVenta: 3999,
        descripcion: 'Licuadora potente para uso diario.',
        clasificacion: 'Licuadoras',
        departamento: 'Línea Blanca',
        imagen: 'images/producto7.png'
    }
];

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
        return 'Precio no disponible';
    }
    return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function mostrarMensaje(mensaje) {
    if (!mensajeCatalogo) {
        return;
    }
    mensajeCatalogo.textContent = mensaje || '';
    mensajeCatalogo.hidden = !mensaje;
}

function normalizarProductos(data) {
    return Array.isArray(data && data.productos) ? data.productos : [];
}

function crearOpciones(select, valores, etiquetaTodos) {
    if (!select) {
        return;
    }
    select.innerHTML = '';

    const opcionTodos = document.createElement('option');
    opcionTodos.value = '';
    opcionTodos.textContent = etiquetaTodos;
    select.appendChild(opcionTodos);

    valores.forEach((valor) => {
        if (!valor) {
            return;
        }
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = valor;
        select.appendChild(option);
    });
}

function ordenarValoresUnicos(lista, campo) {
    return [...new Set(lista.map((item) => item[campo]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function generarOpcionesFiltros() {
    crearOpciones(filtroDepartamento, ordenarValoresUnicos(productos, 'departamento'), 'Todos los departamentos');
    crearOpciones(filtroMarca, ordenarValoresUnicos(productos, 'marca'), 'Todas las marcas');
    crearOpciones(filtroClasificacion, ordenarValoresUnicos(productos, 'clasificacion'), 'Todas las clasificaciones');
}

function crearTarjetaProducto(producto) {
    const card = document.createElement('article');
    card.className = 'producto';

    const imagenPrincipal = (producto.imagenes && producto.imagenes[0]) || producto.imagen || '';
    if (imagenPrincipal) {
        const imagen = document.createElement('img');
        imagen.className = 'producto-imagen';
        imagen.src = imagenPrincipal;
        imagen.alt = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Imagen de producto';
        imagen.loading = 'lazy';
        card.appendChild(imagen);
    }

    const titulo = document.createElement('h3');
    titulo.textContent = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto';
    card.appendChild(titulo);

    if (producto.descripcion) {
        const descripcion = document.createElement('p');
        descripcion.className = 'descripcion';
        descripcion.textContent = producto.descripcion;
        card.appendChild(descripcion);
    }

    const precio = document.createElement('p');
    precio.className = 'precio';
    precio.textContent = formatearMoneda(producto.precioVenta);
    card.appendChild(precio);

    const etiquetas = document.createElement('p');
    etiquetas.className = 'etiquetas';
    const metadatos = [];
    if (producto.clasificacion) metadatos.push(`Clasificación: ${producto.clasificacion}`);
    if (producto.departamento) metadatos.push(`Departamento: ${producto.departamento}`);
    etiquetas.textContent = metadatos.join(' · ');
    card.appendChild(etiquetas);

    return card;
}

function mostrarProductos(lista, mensaje = '') {
    if (!catalogoContainer) {
        return;
    }

    catalogoContainer.innerHTML = '';
    mostrarMensaje(mensaje);

    if (!lista.length) {
        const aviso = document.createElement('p');
        aviso.className = 'mensaje-vacio';
        aviso.textContent = mensaje || 'No encontramos productos que coincidan con tus filtros.';
        catalogoContainer.appendChild(aviso);
        return;
    }

    const fragment = document.createDocumentFragment();
    lista.forEach((producto) => {
        fragment.appendChild(crearTarjetaProducto(producto));
    });
    catalogoContainer.appendChild(fragment);
}

function obtenerFiltrosActivos() {
    return {
        departamento: filtroDepartamento ? filtroDepartamento.value : '',
        marca: filtroMarca ? filtroMarca.value : '',
        clasificacion: filtroClasificacion ? filtroClasificacion.value : ''
    };
}

function aplicarFiltros() {
    const filtros = obtenerFiltrosActivos();

    const productosFiltrados = productos.filter((producto) => {
        const coincideDepartamento = !filtros.departamento || producto.departamento === filtros.departamento;
        const coincideMarca = !filtros.marca || producto.marca === filtros.marca;
        const coincideClasificacion = !filtros.clasificacion || producto.clasificacion === filtros.clasificacion;
        return coincideDepartamento && coincideMarca && coincideClasificacion;
    });

    mostrarProductos(productosFiltrados);
}

function restablecerFiltros() {
    if (filtroDepartamento) filtroDepartamento.value = '';
    if (filtroMarca) filtroMarca.value = '';
    if (filtroClasificacion) filtroClasificacion.value = '';
    mostrarProductos(productos);
}

function enlazarEventosFiltros() {
    [filtroDepartamento, filtroMarca, filtroClasificacion].forEach((select) => {
        if (select) {
            select.addEventListener('change', aplicarFiltros);
        }
    });

    if (botonRestablecer) {
        botonRestablecer.addEventListener('click', restablecerFiltros);
    }
}

async function cargarCatalogo() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const data = await respuesta.json();
        productos = normalizarProductos(data);
        generarOpcionesFiltros();
        mostrarProductos(productos);
    } catch (error) {
        console.error('Error al cargar el catálogo:', error);
        await cargarCatalogoAlternativo();
    }
}

async function cargarCatalogoAlternativo() {
    try {
        const respuesta = await fetch('data/productos.json');
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const data = await respuesta.json();
        productos = normalizarProductos(data);
        if (!productos.length) {
            throw new Error('Sin productos en archivo local');
        }
        generarOpcionesFiltros();
        mostrarProductos(productos, 'Mostrando catálogo local temporal.');
    } catch (error) {
        console.error('Error al cargar productos locales:', error);
        productos = [...PRODUCTOS_FALLBACK];
        generarOpcionesFiltros();
        mostrarProductos(productos, 'Mostrando catálogo base sin conexión al servidor.');
    }
}

enlazarEventosFiltros();
cargarCatalogo();
