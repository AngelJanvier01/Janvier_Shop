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
    const marcas = [...new Set(productos.map(producto => producto.marca))];
    const clasificaciones = [...new Set(productos.map(producto => producto.clasificacion))];
    const departamentos = [...new Set(productos.map(producto => producto.departamento))];

    const filtroMarca = document.getElementById('filtro-marca');
    const filtroClasificacion = document.getElementById('filtro-clasificacion');
    const filtroDepartamento = document.getElementById('filtro-departamento');

    // Generar las opciones de departamentos
    departamentos.forEach(departamento => {
        const option = document.createElement('option');
        option.value = departamento;
        option.textContent = departamento;
        filtroDepartamento.appendChild(option);
    });

    // Generar las opciones de marcas
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });

    // Generar las opciones de clasificaciones
    clasificaciones.forEach(clasificacion => {
        const option = document.createElement('option');
        option.value = clasificacion;
        option.textContent = clasificacion;
        filtroClasificacion.appendChild(option);
    });
}

// Función para aplicar los filtros y ordenar los productos
function filtrarProductos() {
    const departamentoFiltro = document.getElementById('filtro-departamento').value;
    const marcaFiltro = document.getElementById('filtro-marca').value;
    const clasificacionFiltro = document.getElementById('filtro-clasificacion').value;
    const ordenPrecio = document.getElementById('orden-precio').value;

    let productosFiltrados = productos.filter(producto => {
        return (
            (!departamentoFiltro || departamentoFiltro === "" || producto.departamento === departamentoFiltro) &&  // Filtro de departamento
            (!marcaFiltro || marcaFiltro === "" || producto.marca === marcaFiltro) &&  // Filtro de marca
            (!clasificacionFiltro || clasificacionFiltro === "" || producto.clasificacion === clasificacionFiltro)  // Filtro de clasificación
        );
    });

    // Ordenar los productos por precio
    if (ordenPrecio === 'asc') {
        productosFiltrados.sort((a, b) => parseFloat(a.precioVenta.replace(/[$,]/g, '')) - parseFloat(b.precioVenta.replace(/[$,]/g, '')));
    } else if (ordenPrecio === 'desc') {
        productosFiltrados.sort((a, b) => parseFloat(b.precioVenta.replace(/[$,]/g, '')) - parseFloat(a.precioVenta.replace(/[$,]/g, '')));
    }

    mostrarProductos(productosFiltrados);
}

// Función para restablecer los filtros a sus valores predeterminados
function restablecerFiltros() {
    document.getElementById('filtro-marca').value = '';
    document.getElementById('filtro-clasificacion').value = '';
    document.getElementById('filtro-departamento').value = '';
    document.getElementById('orden-precio').value = 'default';

    // Volver a mostrar todos los productos
    mostrarProductos(productos);
}

// Actualización de los filtros de precio y llamada inicial a mostrar los productos
mostrarProductos(productos);
