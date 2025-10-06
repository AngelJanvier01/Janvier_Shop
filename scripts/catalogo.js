const catalogoContainer = document.getElementById('catalogo-container');
const mensajeCatalogo = document.getElementById('catalogo-mensaje');
let productos = [];

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

async function cargarCatalogo() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}`);
        }
        const data = await respuesta.json();
        productos = Array.isArray(data.productos) ? data.productos : [];
        generarOpcionesFiltros(productos);
        mostrarProductos(productos);
    } catch (error) {
        console.error('Error al cargar el catálogo:', error);
        productos = [];
        mostrarProductos(productos, 'No pudimos conectar con la base de productos. Intenta más tarde.');
    }
}

function mostrarProductos(lista, mensaje) {
    catalogoContainer.innerHTML = '';

    if (mensajeCatalogo) {
        mensajeCatalogo.textContent = mensaje || '';
        mensajeCatalogo.hidden = !mensaje;
    }

    if (!lista.length) {
        if (mensaje && mensajeCatalogo) {
            mensajeCatalogo.hidden = false;
        } else {
            const aviso = document.createElement('p');
            aviso.className = 'mensaje-vacio';
            aviso.textContent = 'No encontramos productos que coincidan con tu búsqueda.';
            catalogoContainer.appendChild(aviso);
        }
        return;
    }

    lista.forEach((producto) => {
        const card = document.createElement('article');
        card.classList.add('producto');

        const imagenPrincipal = (producto.imagenes && producto.imagenes[0]) || producto.imagen || '';
        if (imagenPrincipal) {
            const imagen = document.createElement('img');
            imagen.className = 'producto-imagen';
            imagen.src = imagenPrincipal;
            imagen.alt = [producto.marca, producto.modelo].filter(Boolean).join(' ') || 'Producto';
            card.appendChild(imagen);
        }

        const titulo = document.createElement('h3');
        titulo.textContent = [producto.marca, producto.modelo].filter(Boolean).join(' ') || producto.descripcion || 'Producto';
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

        const detalles = document.createElement('p');
        detalles.className = 'etiquetas';
        const etiquetas = [];
        if (producto.clasificacion) etiquetas.push(`Clasificación: ${producto.clasificacion}`);
        if (producto.departamento) etiquetas.push(`Departamento: ${producto.departamento}`);
        detalles.textContent = etiquetas.join(' · ');
        card.appendChild(detalles);

        catalogoContainer.appendChild(card);
    });
}

// Función para generar las opciones de los filtros
function generarOpcionesFiltros(productos) {
    const filtroMarca = document.getElementById('filtro-marca');
    const filtroClasificacion = document.getElementById('filtro-clasificacion');
    const filtroDepartamento = document.getElementById('filtro-departamento');

    // Generar las opciones de departamentos
    const departamentos = [...new Set(productos.map(producto => producto.departamento))];
    departamentos.forEach(departamento => {
        const option = document.createElement('option');
        option.value = departamento;
        option.textContent = departamento;
        filtroDepartamento.appendChild(option);
    });

    // Generar las opciones de clasificaciones
    const clasificaciones = [...new Set(productos.map(producto => producto.clasificacion))];
    clasificaciones.forEach(clasificacion => {
        const option = document.createElement('option');
        option.value = clasificacion;
        option.textContent = clasificacion;
        filtroClasificacion.appendChild(option);
    });

    // Generar las opciones de marcas
    const marcas = [...new Set(productos.map(producto => producto.marca))];
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });

    // Aplicar los filtros automáticamente cuando se selecciona una opción
    filtroMarca.addEventListener('change', filtrarProductos);
    filtroClasificacion.addEventListener('change', () => {
        actualizarDepartamentosYMarcas(); // Actualiza las opciones de "Departamento" y "Marca" basadas en la clasificación seleccionada
        filtrarProductos();
    });
    filtroDepartamento.addEventListener('change', () => {
        actualizarMarcasYClasificaciones(); // Actualiza las opciones de "Marca" y "Clasificación" basadas en el departamento seleccionado
        filtrarProductos();
    });
}

// Actualizar las opciones de "Marca" y "Clasificación" basadas en el departamento seleccionado
function actualizarMarcasYClasificaciones() {
    const departamentoSeleccionado = document.getElementById('filtro-departamento').value;

    // Filtrar productos basados en el departamento seleccionado
    const productosFiltradosPorDepartamento = departamentoSeleccionado
        ? productos.filter(producto => producto.departamento === departamentoSeleccionado)
        : productos;

    const marcas = [...new Set(productosFiltradosPorDepartamento.map(producto => producto.marca))];
    const clasificaciones = [...new Set(productosFiltradosPorDepartamento.map(producto => producto.clasificacion))];

    const filtroMarca = document.getElementById('filtro-marca');
    const filtroClasificacion = document.getElementById('filtro-clasificacion');

    // Limpiar y actualizar las opciones de marcas
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });

    // Limpiar y actualizar las opciones de clasificaciones
    filtroClasificacion.innerHTML = '<option value="">Todas las clasificaciones</option>';
    clasificaciones.forEach(clasificacion => {
        const option = document.createElement('option');
        option.value = clasificacion;
        option.textContent = clasificacion;
        filtroClasificacion.appendChild(option);
    });
}

// Actualizar las opciones de "Departamento" y "Marca" basadas en la clasificación seleccionada
function actualizarDepartamentosYMarcas() {
    const clasificacionSeleccionada = document.getElementById('filtro-clasificacion').value;

    // Filtrar productos basados en la clasificación seleccionada
    const productosFiltradosPorClasificacion = clasificacionSeleccionada
        ? productos.filter(producto => producto.clasificacion === clasificacionSeleccionada)
        : productos;

    const departamentos = [...new Set(productosFiltradosPorClasificacion.map(producto => producto.departamento))];
    const marcas = [...new Set(productosFiltradosPorClasificacion.map(producto => producto.marca))];

    const filtroDepartamento = document.getElementById('filtro-departamento');
    const filtroMarca = document.getElementById('filtro-marca');

    // Limpiar y actualizar las opciones de departamentos
    filtroDepartamento.innerHTML = '<option value="">Todos los departamentos</option>';
    departamentos.forEach(departamento => {
        const option = document.createElement('option');
        option.value = departamento;
        option.textContent = departamento;
        filtroDepartamento.appendChild(option);
    });

    // Limpiar y actualizar las opciones de marcas
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });
}

// Función para aplicar los filtros
function filtrarProductos() {
    const departamentoFiltro = document.getElementById('filtro-departamento').value;
    const marcaFiltro = document.getElementById('filtro-marca').value;
    const clasificacionFiltro = document.getElementById('filtro-clasificacion').value;

    let productosFiltrados = productos.filter(producto => {
        return (
            (!departamentoFiltro || producto.departamento === departamentoFiltro) &&  // Filtro de departamento
            (!marcaFiltro || producto.marca === marcaFiltro) &&  // Filtro de marca
            (!clasificacionFiltro || producto.clasificacion === clasificacionFiltro)  // Filtro de clasificación
        );
    });

    mostrarProductos(productosFiltrados);
}

// Función para restablecer los filtros
function restablecerFiltros() {
    document.getElementById('filtro-marca').value = '';
    document.getElementById('filtro-clasificacion').value = '';
    document.getElementById('filtro-departamento').value = '';

    actualizarMarcasYClasificaciones(); // Actualizar las opciones al restablecer
    mostrarProductos(productos); // Volver a mostrar todos los productos
}

cargarCatalogo();
