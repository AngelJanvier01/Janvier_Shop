const catalogoContainer = document.getElementById('catalogo-container');
let productos = [];

// Cargar el archivo CSV y procesarlo
fetch('../data/productos.csv')
    .then(response => response.text())
    .then(data => {
        const filas = data.split('\n').slice(1); // Omitir encabezados
        productos = filas.map(fila => {
            const [marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento] = fila.split(',');
            return { marca, modelo, codigo, precioVenta, descripcion, clasificacion, departamento };
        });
        generarOpcionesFiltros(productos);  // Generar opciones para los filtros
        mostrarProductos(productos);  // Mostrar todos los productos al cargar la página
    });

// Mostrar productos en la página
function mostrarProductos(productos) {
    catalogoContainer.innerHTML = ''; // Limpiar contenedor
    productos.forEach(producto => {
        const divProducto = document.createElement('div');
        divProducto.classList.add('producto');
        divProducto.innerHTML = `
            <h3>${producto.marca} ${producto.modelo}</h3>
            <p>${producto.descripcion}</p>
            <p class="precio">Precio: ${producto.precioVenta}</p>
            <p>Clasificación: ${producto.clasificacion}</p>
            <p>Departamento: ${producto.departamento}</p>
        `;
        catalogoContainer.appendChild(divProducto);
    });
}

// Función para generar opciones de los filtros
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

// Actualizar el valor del rango de precio
document.getElementById('precio-min').addEventListener('input', actualizarRangoPrecio);
document.getElementById('precio-max').addEventListener('input', actualizarRangoPrecio);

function actualizarRangoPrecio() {
    const precioMin = document.getElementById('precio-min').value;
    const precioMax = document.getElementById('precio-max').value;
    document.getElementById('precio-actual').textContent = `De: $${precioMin} a $${precioMax}`;
}
