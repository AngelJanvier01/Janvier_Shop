const catalogoContainer = document.getElementById('catalogo-container');
let productos = [];

// Cargar los productos desde el JSON
fetch('data/productos.json')
    .then(response => response.json())
    .then(data => {
        productos = data.productos; // Guardar los productos en una variable global
        mostrarProductos(productos); // Mostrar todos los productos al cargar la página
        generarOpcionesFiltros(productos); // Generar las opciones para los filtros
    })
    .catch(error => console.error('Error al cargar el archivo JSON:', error));

// Función para mostrar los productos
function mostrarProductos(productos) {
    catalogoContainer.innerHTML = ''; // Limpiar contenedor antes de agregar nuevos productos
    productos.forEach(producto => {
        const divProducto = document.createElement('div');
        divProducto.classList.add('producto');
        divProducto.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.modelo}" class="producto-imagen">
            <h3>${producto.marca} ${producto.modelo}</h3>
            <p>${producto.descripcion}</p>
            <p class="precio">$${producto.precioVenta.toLocaleString()}</p>
            <p>Clasificación: ${producto.clasificacion}</p>
            <p>Departamento: ${producto.departamento}</p>
        `;
        catalogoContainer.appendChild(divProducto);
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
