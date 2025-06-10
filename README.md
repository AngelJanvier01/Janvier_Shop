# Janvier Shop

Este proyecto contiene una pequeña tienda web. Ahora incluye un backend en Node.js con SQLite para almacenar los productos y permitir varias imágenes por cada uno.

## Requisitos
- Node.js 18 o superior
- npm
- SQLite3

## Instalación
1. Situarse en la carpeta `backend` e instalar las dependencias:
   ```bash
   cd backend
   npm install
   ```
2. Ejecutar la migración de los datos existentes desde `data/productos.json`:
   ```bash
   npm run migrate
   ```
3. Iniciar el servidor:
   ```bash
   npm start
   ```
   El servidor quedará disponible en `http://localhost:3000`.

Los archivos subidos se guardan en la carpeta `uploads/`.

## Uso en el Frontend
Los scripts `admin.js` y `catalogo.js` consumen la API en `http://localhost:3000/api/productos` para listar, crear, actualizar y eliminar productos. En el formulario de administración se pueden proporcionar varias URLs de imagen separadas por coma.

## Endpoints principales
- `GET /api/productos` – Lista de productos con sus imágenes.
- `POST /api/productos` – Crear producto.
- `PUT /api/productos/:id` – Actualizar producto.
- `DELETE /api/productos/:id` – Eliminar producto.
- `POST /api/productos/:id/images` – Subir imágenes (multipart/form-data, campo `imagenes`).

