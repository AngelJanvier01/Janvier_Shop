# JANVIER V2 — Auditoría y preservación de Fase 0

**Fecha:** 2026-07-31  
**Rama auditada:** NewV_2.0  
**Baseline local creado:** legacy/v1-before-rebuild  
**Alcance:** sólo lectura, inventario y preservación. No se modificó el comportamiento de la versión anterior.

---

## 1. Resultado ejecutivo

El repositorio actual es una aplicación de catálogo pequeña compuesta por HTML estático, JavaScript de navegador y un backend Express con SQLite. Es útil como referencia, fuente de datos inicial y preservación histórica, pero no cumple los requisitos de arquitectura, seguridad, operación ni crecimiento definidos para JANVIER V2.

La reconstrucción puede vivir en la raíz de este repositorio sin borrar los archivos actuales. La V2 incorporará su propia estructura de aplicación; el sitio legado y el backend actual permanecerán intactos hasta una migración validada.

---

## 2. Preservación realizada

- Se creó la etiqueta Git local legacy/v1-before-rebuild en el commit previo a la reconstrucción.
- No se movió, borró ni reescribió ningún archivo del sitio anterior.
- No se alteró la base SQLite existente.
- No se modificaron sesiones, usuarios, productos ni configuraciones.
- Se conservaron como archivos de trabajo no rastreados el documento maestro, la base de implementación y los logos aportados por Ángel.

La etiqueta se debe publicar junto con la primera entrega remota cuando se decida subir los cambios.

---

## 3. Inventario actual

### 3.1 Frontend legado

```text
index.html
catalogo.html
contacto.html
admin.html
admin-panel.html
footer.html
styles/
scripts/
images/
```

Características detectadas:

- Páginas HTML independientes.
- JavaScript global por página.
- Dos temas visuales básicos.
- Catálogo y carrusel.
- Panel administrativo simple.
- Sin TypeScript, App Router, i18n, pruebas ni estructura de componentes reutilizables.

### 3.2 Backend legado

```text
backend/app.js
backend/db.js
backend/migrate.js
backend/package.json
backend/database.sqlite
```

Tecnologías:

```text
Node.js
Express 4
SQLite
Multer
```

### 3.3 Datos locales encontrados

| Entidad SQLite | Registros observados |
| -------------- | -------------------: |
| products       |                    0 |
| product_images |                    0 |
| admin_users    |                    1 |
| admin_sessions |                    1 |
| site_settings  |                   16 |

El archivo de semilla data/productos.json contiene cinco productos de ejemplo. No hay archivos cargados en uploads. El directorio images contiene diez recursos del sitio legado.

### 3.4 Nuevos activos de marca recibidos

```text
angel_janvier_logo_black.svg
angel_janvier_logo_black_1600.png
angel_janvier_monogram_black.svg
angel_janvier_monogram_black_1600.png
```

Los dos SVG son los originales canónicos para la integración web. La política de uso está definida en JANVIER_IMPLEMENTATION_BASE.md.

---

## 4. Deuda técnica y diferencias frente a V2

| Área       | Estado actual                          | Dirección V2                                                   |
| ---------- | -------------------------------------- | -------------------------------------------------------------- |
| Aplicación | HTML estático y scripts globales       | Next.js con TypeScript y componentes por dominio               |
| Datos      | SQLite sin esquema de negocio completo | PostgreSQL, Prisma y migraciones                               |
| Catálogo   | Producto plano y sin variantes/ofertas | Producto, categorías, atributos, medios y ofertas de proveedor |
| Sesión     | Administración individual              | Sesiones seguras, roles, permisos y 2FA                        |
| Contenido  | Ajustes globales básicos               | Proyectos, servicios, páginas, SEO e idiomas administrables    |
| Comercio   | Precio fijo                            | Precio privado, reglas de margen, cotización y snapshots       |
| Calidad    | Sin pruebas ni lint de V2              | Tipos, lint, Vitest y Playwright                               |
| Operación  | Servidor manual                        | Health check, staging, backups, servicio web y worker          |

---

## 5. Riesgos de seguridad prioritarios en el legado

Estos riesgos justifican que la V2 no copie el backend existente:

1. El backend contiene un usuario y contraseña administrativa de respaldo conocidos cuando no se declaran variables de entorno.
2. La respuesta pública de productos incluye el precio de compra junto con el precio de venta.
3. El frontend guarda y envía un token Bearer de administración desde localStorage como compatibilidad.
4. La aplicación admite flujos administrativos desde file:// y permite el origen CORS null.
5. La subida de archivos limita tamaño, pero no valida de forma suficiente MIME, contenido, extensión ni nombre aleatorio.
6. Los archivos cargados se sirven como estáticos sin un modelo de documentos privados.
7. La limitación de inicio de sesión es sólo en memoria y por IP; no es una defensa suficiente para producción.
8. Faltan CSP, CSRF consistente, HSTS de producción, auditoría y permisos granulares.
9. SQLite usa REAL para importes, inadecuado para cálculos monetarios comerciales.

No se intentó acceder con credenciales ni se modificó la sesión existente durante la auditoría.

---

## 6. Datos que podrían migrarse

### Candidatos

- Cinco productos de ejemplo de data/productos.json, previa validación individual.
- Imágenes legadas que sean propias, vigentes y coherentes con la nueva marca.
- Textos útiles de presentación, reescritos según la nueva voz.
- Ideas del loader existente, no su implementación literal.
- Historial Git y la base SQLite como respaldo.

### No migrar directamente

- Credenciales, sesiones o tokens.
- Código HTML, CSS y JavaScript legado.
- Modelo SQLite y endpoints Express.
- Precios de compra, precios de venta antiguos y márgenes sin validación.
- Logos e imágenes viejos que contradigan la nueva identidad.
- Valores de configuración sin revisión editorial.

---

## 7. Decisiones de reconstrucción

- La V2 se instalará en la raíz del repositorio y coexistirá temporalmente con el legado.
- El legado no se borra en los PR iniciales.
- PostgreSQL sustituye SQLite como fuente operativa.
- La raíz pública será español; el sistema interno puede usar locale.
- El catálogo inicial será de lectura pública sin precios.
- La primera conversión comercial será diagnóstico o solicitud, no checkout.
- El sistema de marca nuevo se integra desde SVG.
- Las rutas administrativas, precios y archivos privados se diseñan server-side desde el inicio.

---

## 8. Bloqueos técnicos detectados

No existe un bloqueo para iniciar la fundación V2.

Observaciones:

- Node.js 22 y npm 10 están disponibles.
- Docker está disponible, pero no se usará como requisito de producción.
- El cliente psql no está instalado localmente; la conexión real a PostgreSQL se validará cuando se configure el entorno de base de datos.
- No se detectó AGENTS.md ni otra guía adicional del repositorio.

---

## 9. Siguiente paso autorizado

Proceder con PR 1: fundación V2.

Incluye crear Next.js, TypeScript, configuración de calidad, Prisma, variables de entorno de ejemplo, layout raíz, health check y estructura de rutas. No incluye migrar datos, pagos, scraping ni modificar la operación del sitio legado.
