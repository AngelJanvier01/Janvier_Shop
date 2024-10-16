const catalogoContainer = document.getElementById('catalogo-container');
let productos = [];

// Cargar datos desde el archivo JSON
fetch('data/productos.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar el archivo JSON');
        }
        return response.json();
    })
    .then(data => {
        productos = data.productos;
        generarOpcionesFiltros(productos);  // Generar las opciones del filtro dinámicamente
        mostrarProductos(productos);        // Mostrar todos los productos al cargar la página
    })
    .catch(error => console.error('Error al cargar el archivo JSON:', error));

// Función para mostrar los productos en la página
function mostrarProductos(productos) {
    catalogoContainer.innerHTML = '';  // Limpiar el contenedor
    productos.forEach(producto => {
        const divProducto = document.createElement('div');
        divProducto.classList.add('producto');
        divProducto.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.modelo}" class="producto-imagen">
            <h3>${producto.marca} ${producto.modelo}</h3>
            <p>${producto.descripcion}</p>
            <p class="precio">$${producto.precioVenta.toLocaleString()}</p>
            <button class="agregar-carrito">Añadir al carrito</button>
        `;
        catalogoContainer.appendChild(divProducto);
    });
}

// Función para generar las opciones de los filtros
function generarOpcionesFiltros(productos) {
    const marcas = [...new Set(productos.map(producto => producto.marca))];
    const clasificaciones = [...new Set(productos.map(producto => producto.clasificacion))];
    const departamentos = [...new Set(productos.map(producto => producto.departamento))];

    const filtroMarca = document.getElementById('filtro-marca');
    const filtroClasificacion = document.getElementById('filtro-clasificacion');
    const filtroDepartamento = document.getElementById('filtro-departamento');

    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });

    clasificaciones.forEach(clasificacion => {
        const option = document.createElement('option');
        option.value = clasificacion;
        option.textContent = clasificacion;
        filtroClasificacion.appendChild(option);
    });

    departamentos.forEach(departamento => {
        const option = document.createElement('option');
        option.value = departamento;
        option.textContent = departamento;
        filtroDepartamento.appendChild(option);
    });
}

// Función para filtrar productos
function filtrarProductos() {
    const marcaFiltro = document.getElementById('filtro-marca').value.toLowerCase();
    const clasificacionFiltro = document.getElementById('filtro-clasificacion').value.toLowerCase();
    const departamentoFiltro = document.getElementById('filtro-departamento').value.toLowerCase();
    const precioMin = parseFloat(document.getElementById('precio-min').value) || 0;
    const precioMax = parseFloat(document.getElementById('precio-max').value) || 100000;

    const productosFiltrados = productos.filter(producto => {
        const precioVenta = parseFloat(producto.precioVenta.replace(/[$,]/g, '')); // Quitar símbolos de precio
        return (
            (!marcaFiltro || producto.marca.toLowerCase().includes(marcaFiltro)) &&
            (!clasificacionFiltro || producto.clasificacion.toLowerCase().includes(clasificacionFiltro)) &&
            (!departamentoFiltro || producto.departamento.toLowerCase().includes(departamentoFiltro)) &&
            (precioVenta >= precioMin && precioVenta <= precioMax)
        );
    });

    mostrarProductos(productosFiltrados);
}
