let productos = [];
let productoSeleccionado = null;

// Cargar productos desde el archivo JSON
function cargarProductos() {
    fetch('data/productos.json')
        .then(response => response.json())
        .then(data => {
            productos = data.productos;
            renderProductos();
        })
        .catch(error => console.error('Error al cargar productos:', error));
}

// Mostrar productos en la lista
function renderProductos() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Limpiar lista

    productos.forEach((producto, index) => {
        const productoElemento = document.createElement('div');
        productoElemento.classList.add('producto');
        productoElemento.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <p><strong>${producto.nombre}</strong></p>
            <p><strong>Marca:</strong> ${producto.marca}</p>
            <p><strong>Precio:</strong> $${producto.precioVenta}</p>
            <button class="btn editar-btn" onclick="mostrarFormularioEditar(${index})">Editar</button>
            <button class="btn eliminar-btn" onclick="mostrarModalEliminar(${index})">Eliminar</button>
        `;
        productList.appendChild(productoElemento);
    });
}

// Guardar productos en el servidor (simulado)
function guardarProductosEnServidor() {
    fetch('data/productos.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Productos guardados:', data);
        })
        .catch(error => console.error('Error al guardar productos:', error));
}

// Mostrar formulario para agregar producto
document.getElementById('agregar-producto-btn').addEventListener('click', mostrarFormularioAgregar);

function mostrarFormularioAgregar() {
    productoSeleccionado = null;
    document.getElementById('modal-title').textContent = 'Agregar Producto';
    document.getElementById('product-form').reset();
    mostrarModal('modal-producto');
}

// Mostrar formulario para editar producto
function mostrarFormularioEditar(index) {
    productoSeleccionado = index;
    const producto = productos[index];
    document.getElementById('modal-title').textContent = 'Editar Producto';
    document.getElementById('nombre').value = producto.nombre;
    document.getElementById('marca').value = producto.marca;
    document.getElementById('precio').value = producto.precioVenta;
    document.getElementById('clasificacion').value = producto.clasificacion;
    document.getElementById('departamento').value = producto.departamento;
    document.getElementById('imagen').value = producto.imagen;
    mostrarModal('modal-producto');
}

// Guardar nuevo producto o editar existente
document.getElementById('product-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const nombre = document.getElementById('nombre').value;
    const marca = document.getElementById('marca').value;
    const precioVenta = document.getElementById('precio').value;
    const clasificacion = document.getElementById('clasificacion').value;
    const departamento = document.getElementById('departamento').value;
    const imagen = document.getElementById('imagen').value;

    const nuevoProducto = { nombre, marca, precioVenta, clasificacion, departamento, imagen };

    if (productoSeleccionado !== null) {
        productos[productoSeleccionado] = nuevoProducto; // Editar producto existente
    } else {
        productos.push(nuevoProducto); // Agregar nuevo producto
    }

    renderProductos();
    guardarProductosEnServidor();
    cerrarModal();
});

// Eliminar producto
function mostrarModalEliminar(index) {
    productoSeleccionado = index;
    mostrarModal('modal-eliminar');
}

document.getElementById('confirmar-eliminar').addEventListener('click', function () {
    productos.splice(productoSeleccionado, 1); // Eliminar producto
    renderProductos();
    guardarProductosEnServidor();
    cerrarModal();
});

// Mostrar y cerrar modales
function mostrarModal(id) {
    document.getElementById(id).style.display = 'block';
}

function cerrarModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
}

// Cargar productos al inicio
cargarProductos();
