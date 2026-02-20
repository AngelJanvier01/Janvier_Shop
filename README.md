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
3. (Opcional) define credenciales seguras para admin:
   ```bash
   export ADMIN_USER="tu_usuario_admin"
   export ADMIN_PASSWORD="TuPasswordSuperSegura#2026"
   ```
4. Inicia la aplicación:
   ```bash
   npm start
   ```

La app queda disponible en `http://localhost:3000`. El backend también sirve los archivos estáticos (`index.html`, `catalogo.html`, etc.).

## Estructura principal
- `index.html`: landing principal.
- `catalogo.html`: catálogo con filtros por departamento, marca y clasificación.
- `contacto.html`: canales de contacto.
- `admin.html`: gestión de productos (crear, editar, eliminar).
- `admin.html`: login seguro + gestión de catálogo + ajustes globales (logo, favicon, textos y carrusel).

## API principal
- `GET /api/productos`: lista productos con arreglo de imágenes.
- `POST /api/productos`: crea producto con validación básica.
- `PUT /api/productos/:id`: actualiza producto por id.
- `DELETE /api/productos/:id`: elimina producto por id.
- `POST /api/productos/:id/images`: sube imágenes (`multipart/form-data`, campo `imagenes`).
- `GET /api/settings`: devuelve ajustes públicos del sitio (branding/textos/carrusel).
- `POST /api/admin/login`: inicia sesión admin.
- `POST /api/admin/logout`: cierra sesión admin.
- `GET /api/admin/session`: consulta si hay sesión activa.
- `GET /api/admin/settings`: obtiene ajustes (requiere sesión).
- `PUT /api/admin/settings`: actualiza ajustes (requiere sesión).
- `POST /api/admin/change-password`: cambia contraseña admin (requiere sesión).

## Notas
- Las imágenes subidas se guardan en `uploads/`.
- Si no defines `ADMIN_USER`/`ADMIN_PASSWORD`, el primer arranque crea un admin por defecto:
  - Usuario: `admin`
  - Contraseña: `JanvierShop!2026`
- El login admin usa cookie segura por defecto y también token `Bearer` como respaldo para entornos locales (por ejemplo `file://`).
- Si abres los HTML de forma local (`file://`), los scripts del frontend intentan conectarse automáticamente a `http://localhost:3000/api`.
