# Janvier Shop

Tienda web con catálogo y panel de administración, respaldada por API en Node.js + SQLite.

## Requisitos
- Node.js 18 o superior
- npm

## Instalación rápida
1. Entra al backend e instala dependencias:
   ```bash
   cd backend
   npm install
   ```
2. Migra los productos iniciales desde `data/productos.json`:
   ```bash
   npm run migrate
   ```
3. Inicia la aplicación:
   ```bash
   npm start
   ```

La app queda disponible en `http://localhost:3000`. El backend también sirve los archivos estáticos (`index.html`, `catalogo.html`, etc.).

## Estructura principal
- `index.html`: landing principal.
- `catalogo.html`: catálogo con filtros por departamento, marca y clasificación.
- `contacto.html`: canales de contacto.
- `admin.html`: gestión de productos (crear, editar, eliminar).

## API principal
- `GET /api/productos`: lista productos con arreglo de imágenes.
- `POST /api/productos`: crea producto con validación básica.
- `PUT /api/productos/:id`: actualiza producto por id.
- `DELETE /api/productos/:id`: elimina producto por id.
- `POST /api/productos/:id/images`: sube imágenes (`multipart/form-data`, campo `imagenes`).

## Notas
- Las imágenes subidas se guardan en `uploads/`.
- Si abres los HTML de forma local (`file://`), los scripts del frontend intentan conectarse automáticamente a `http://localhost:3000/api`.
