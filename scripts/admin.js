// Referencias a elementos HTML
const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');
const exportButton = document.getElementById('exportar-json');

// Variable global para almacenar productos
let productos = [];

// Cargar productos desde el archivo productos.json o localStorage
function cargarProductos() {
    const savedProductos = localStorage.getItem('productos');
    if (savedProductos) {
        productos = JSON.parse(savedProductos);
        renderProductos(); // Mostrar productos desde localStorage
    } else {
        fetch('productos.json')
            .then(response => response.json())
            .then(data => {
                productos = data.productos; // Accedemos a los productos dentro del JSON
                renderProductos(); // Mostrar productos
            })
            .catch(error => console.error('Error al cargar productos:', error));
    }
}

// Función para mostrar productos en la lista
function renderProductos() {
    productList.innerHTML = ''; // Limpiar lista antes de agregar productos

    productos.forEach((producto, index) => {
        const productoElemento = document.createElement('div');
        productoElemento.classList.add('producto');
        productoElemento.innerHTML = `
            <p><strong>Nombre:</strong> <input type="text" value="${producto.nombre}" onchange="editarProducto(${index}, 'nombre', this.value)" /></p>
            <p><strong>Marca:</strong> <input type="text" value="${producto.marca}" onchange="editarProducto(${index}, 'marca', this.value)" /></p>
            <p><strong>Precio:</strong> <input type="number" value="${producto.precioVenta}" onchange="editarProducto(${index}, 'precioVenta', this.value)" /></p>
            <p><strong>Clasificación:</strong> <input type="text" value="${producto.clasificacion}" onchange="editarProducto(${index}, 'clasificacion', this.value)" /></p>
            <p><strong>Departamento:</strong> <input type="text" value="${producto.departamento}" onchange="editarProducto(${index}, 'departamento', this.value)" /></p>
            <p><strong>Imagen URL:</strong> <input type="text" value="${producto.imagen}" onchange="editarProducto(${index}, 'imagen', this.value)" /></p>
            <img src="${producto.imagen}" alt="${producto.nombre}" style="width: 100px;">
            <button onclick="guardarProducto(${index})">Guardar Cambios</button>
            <button onclick="eliminarProducto(${index})">Eliminar</button>
        `;
        productList.appendChild(productoElemento);
    });
}

// Editar producto existente
function editarProducto(index, campo, valor) {
    productos[index][campo] = valor;
}

// Guardar producto editado en localStorage
function guardarProducto(index) {
    productos[index].guardado = true;  // Puedes marcar que el producto fue guardado (opcional)
    guardarProductos();
    alert('Producto guardado con éxito');
}

// Eliminar producto
function eliminarProducto(index) {
    productos.splice(index, 1);
    guardarProductos(); // Guardar cambios en localStorage
    renderProductos(); // Volver a mostrar los productos después de eliminar
}

// Añadir nuevo producto
productForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const marca = document.getElementById('marca').value;
    const precioVenta = document.getElementById('precio').value;
    const clasificacion = document.getElementById('clasificacion').value;
    const departamento = document.getElementById('departamento').value;
    const imagen = document.getElementById('imagen').value;

    const nuevoProducto = { nombre, marca, precioVenta, clasificacion, departamento, imagen };

    productos.push(nuevoProducto);
    guardarProductos(); // Guardar en localStorage
    renderProductos(); // Actualizar la lista de productos
    productForm.reset();
});

// Guardar productos en localStorage
function guardarProductos() {
    localStorage.setItem('productos', JSON.stringify(productos));
}

// Exportar JSON actualizado
exportButton.addEventListener('click', function () {
    const dataStr = JSON.stringify({ productos }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// Cargar productos al iniciar
cargarProductos();
