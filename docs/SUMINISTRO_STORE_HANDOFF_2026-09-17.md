# Suministro JANVIER — estado de trabajo y siguiente sesión

https://chatgpt.com/s/cx_6aab9c4be3508191a8c82322981f2c4d

Fecha de corte: 17 de septiembre de 2026. Este documento deja un punto de
continuidad para la tienda de `jaanviieer.com/suministro`; no contiene
credenciales ni valores de `.env`.

## Objetivo del módulo

Convertir Suministro en una tienda B2B formal: catálogo técnico, precios y
existencias sincronizados desde SICODD, clientes aprobados con condiciones
comerciales propias, solicitudes de cotización y pedidos. El carrito ya debe
existir como preparación, pero el cobro sigue intencionalmente desactivado.

## Lo realizado

### Catálogo, experiencia y datos de producto

- Catálogo público responsive con buscador técnico, filtros por categoría,
  marca, disponibilidad y orden, paginación de 25 productos y conservación de
  filtros/posición durante la navegación.
- Los filtros se aplican siempre de forma acumulativa: búsqueda, categoría,
  marca, disponibilidad y orden pueden usarse a la vez. Se retiró el modo
  experimental “combinar filtros”, que hacía ambiguo el comportamiento, y los
  enlaces ya no conservan el parámetro heredado `combine`.
- Se corrigió el selector de precio: al elegir “menor a mayor” o “mayor a
  menor” el valor se toma antes de actualizar el estado de React, evitando la
  pantalla de error que ocurría al leer un evento ya liberado. Se validaron los
  dos órdenes, aplicar, limpiar y la conservación de criterios activos.
- Búsqueda tolerante a variantes del español (singular/plural) y campos de
  proveedor: SKU/UPC, número de parte, marca, familia, subfamilia, garantía,
  especificaciones, precios con IVA, inventario por ubicación y galerías.
- Ficha individual con galería, especificaciones, garantía, referencias y
  preparación para cotizar/agregar al carrito.
- Carrusel automático y aleatorio de imágenes cada tres segundos, respetando
  `prefers-reduced-motion`, visibilidad de la pestaña y presencia en pantalla.
  Puede pausarse manualmente y se detiene durante la interacción.
- El modo oscuro conserva el área de producto clara para que PNG y fotografías
  con transparencia no pierdan legibilidad.
- Los nombres de tarjeta ahora se dividen en dos niveles: un titular grande de
  identidad y una continuación de datos. Ejemplo: `MOUSE INALAMBRICO STYLOS`
  seguido de `CMOU2, 1200 DPI, ...`; ya no se duplica la descripción completa.

### SICODD y administración

- Cliente de SICODD con autenticación tomada únicamente de variables de
  entorno, extracción de listados/fichas, imágenes, especificaciones,
  existencias y precios.
- Ajustes administrativos para muestras, inclusión de imágenes, bodegas
  externas y control del estado de importación. Las ejecuciones quedan
  registradas como corridas de sincronización y candidatos importados.
- Importador de muestra diversa ampliado: `--limit` acepta hasta 200 y ahora
  significa productos **nuevos** reales; los SKU existentes se omiten y la
  búsqueda continúa hasta alcanzar la meta, si el proveedor ofrece suficientes
  enlaces.
- Cada importación calcula colores de superficie de la galería en el servidor;
  no hay análisis de píxeles en el navegador de los visitantes.

### Cuentas, carrito y operación comercial

- Flujo de solicitud de cuenta de cliente, verificación de correo y revisión
  administrativa antes de habilitar el acceso y las condiciones comerciales.
- Carrito y flujo de solicitud de cotización preparados; el pago directo sigue
  desactivado deliberadamente.
- Estructura administrativa para márgenes, precios por cliente, analítica y
  control del catálogo, lista para seguir refinando antes de activar cobros.

## Correcciones de auditoría aplicadas

- Docker ya excluye todos los archivos `.env*` reales del contexto de imagen y
  conserva únicamente los ejemplos versionados. Compose pasa en tiempo de
  ejecución las credenciales de SICODD y del webhook de correo sin hornearlas en
  la imagen.
- El webhook de clientes tiene límite de 10 segundos, un reintento para fallos
  temporales y plantillas para verificación, aprobación, rechazo y suspensión.
- La verificación de correo reclama el token con una actualización condicional;
  dos solicitudes concurrentes ya no pueden reutilizarlo.
- Las existencias por sucursal se conservan como un snapshot privado con fecha
  propia. El catálogo público recibe solamente `stockTotal`; los nombres y
  cantidades por ubicación permanecen en administración.
- Ajustes incluye un directorio de sucursales SICODD para asignar apodos y notas
  sin alterar el nombre exacto utilizado al sincronizar.
- PostgreSQL garantiza una sola lista `ACTIVE` por cuenta. Al solicitar una
  cotización se congela nombre, SKU, marca, descuento, precio unitario,
  existencia y fecha, de modo que el historial no cambia al editar el catálogo.
- Se agregaron índices trigram para la búsqueda técnica y compuestos para los
  filtros y ordenamientos principales.
- La paginación usa la página ya acotada antes de consultar productos; una URL
  fuera de rango muestra la última página real.
- Las especificaciones manuales antiguas y las nuevas usan un formato común.
- Los carruseles se detienen fuera de pantalla, con la pestaña oculta, al pasar
  el cursor o enfocar controles; además respetan movimiento reducido y ofrecen
  pausa manual.
- Se actualizaron Next.js, Prisma, Sharp, Nodemailer y Vitest, y se fijaron
  versiones transitivas corregidas. `npm audit` reporta cero vulnerabilidades.

## Estado histórico del catálogo local

Después de la carga ejecutada el 17 de septiembre de 2026 (fotografía histórica;
no sustituye una consulta actual a la base):

| Métrica                           | Estado |
| --------------------------------- | -----: |
| Productos totales                 |    150 |
| Publicados                        |    150 |
| Borradores pendientes de revisión |      0 |
| Productos con imagen principal    |    150 |
| Imágenes de galería registradas   |    495 |
| Familias representadas            |     10 |

La distribución quedó pareja: 15 productos en cada una de estas familias:

- Almacenamiento
- Gabinetes
- Memorias
- Monitores
- Mouses
- Procesadores
- Redes
- Tarjetas de video
- Teclados
- Videovigilancia

La segunda carga creó exactamente 100 productos, sin fallos, a partir de 195
fichas candidatas. Se detectaron marcas como Acteck, Adata, AMD, Asus, Dahua,
Gigabyte, HiLook, Kingston, Logitech, MSI, Samsung, Stylos, TP-Link y Xzeal,
entre otras.

> Los 100 nuevos se importaron inicialmente como `DRAFT` y se publicaron al
> cierre de esta sesión. Para futuras cargas, revisar el estado de importación
> configurado en Admin antes de ejecutar el lote.

## Sistema actual de fondos de imagen

El sistema actual **no elimina fondos**. Es un mecanismo temporal de color de
superficie para que el área alrededor de una imagen no se vea cortada.

La versión actual analiza una imagen reducida a 96 × 96 píxeles y busca, en
este orden, superficies conectadas con cobertura amplia, mates neutrales de
fondo y colores dominantes con área suficiente. Evalúa continuidad, extensión
en los cuatro lados y profundidad hacia el centro. Por ello, una línea de color
delgada ya no puede ganar por sí sola. No hay listas de SKU, marcas ni reglas
por producto.

Se reanalizaron los productos locales tras el cambio. Esta solución sólo ayuda
al marco visual; no sustituye un recorte real con transparencia.

## Implementado: removedor de fondo nativo

El pipeline local ya produce derivados con alfa real usando BiRefNet Lite,
almacenamiento persistente, cola con reintentos y aprobación humana. La guía
operativa completa está en `docs/PRODUCT_IMAGE_BACKGROUND_REMOVAL.md`.

### Arquitectura implementada

```text
URL original SICODD
        ↓
cola de procesamiento en servidor
        ↓
servicio local BiRefNet Lite de segmentación
        ↓
PNG maestro con transparencia
        ↓
WebP/AVIF derivados + almacenamiento persistente
        ↓
catálogo usa el derivado validado; original queda como respaldo
```

### Salvaguardas implementadas

1. Servidor con Docker/Compose y volumen persistente para modelos y derivados.
2. Almacenamiento persistente u objeto compatible con S3 para imágenes; no se
   deben guardar derivados solamente dentro de `public/` de una instancia
   efímera.
3. Servicio local de segmentación con BiRefNet Lite/PyTorch y licencia revisada para uso
   comercial. No usar una API pública ni enviar imágenes del proveedor a un
   tercero sin aprobación.
4. Campos de persistencia para URL original, URL PNG, derivados optimizados,
   hash, estado de procesamiento, error, fecha y versión de modelo.
5. Cola con concurrencia limitada, reintentos, recuperación de trabajos,
   vista previa, aprobación/rechazo y restauración del original desde Admin.
6. Las importaciones nuevas se encolan automáticamente; el catálogo histórico
   se prepara como lote controlado mediante `npm run images:enqueue`.

### Decisiones de producto

- Conservar siempre el original del proveedor: nunca sobrescribirlo.
- PNG será el maestro para conservar transparencia; WebP/AVIF se usarán para
  entregar rápido el catálogo.
- Si el modelo falla o la revisión lo rechaza, mostrar el original y marcar el
  caso para revisión, nunca ocultar el producto.
- El fondo claro de las tarjetas seguirá siendo el respaldo visual mientras no
  exista una imagen procesada aprobada.

## Pendientes generales, en orden recomendado

1. Desplegar la migración, encolar el catálogo histórico y aprobar visualmente
   los primeros derivados en producción.
2. Definir reglas de margen por familia, marca y cliente para los 150 productos
   ya publicados.
3. Configurar sincronización diaria incremental de precios, existencias,
   productos nuevos e imágenes; incluir monitoreo, alertas y límite de carga.
4. Definir la comunicación comercial de “bajo pedido” y revisar periódicamente
   los apodos internos de nuevas sucursales detectadas por SICODD.
5. Completar reglas de precio por cliente, aprobación administrativa y
   documentos de cotización/pedido.
6. Preparar la pasarela de pago sólo después de validar impuestos, condiciones
   de entrega, inventario reservado, cancelaciones y facturación.
7. Migrar la base y los secretos al servidor, con respaldos y tareas
   programadas de mantenimiento.

## Comandos operativos útiles

```powershell
# Desarrollo local
npm run dev

# Cargar una muestra diversa de productos nuevos
npm run sicodd:load-diverse -- --limit 100

# Recalcular los colores de superficie existentes
npm run sicodd:backfill-image-frames -- --all

# Validación
npm run test
npm run typecheck
npm run lint
npm run build
```

## Seguridad y despliegue

- Mantener credenciales de SICODD exclusivamente en `.env`; nunca incluirlas
  en documentación, código, capturas ni commits.
- Rotar la contraseña temporal del proveedor antes de producción, como ya se
  planeó.
- Aplicar migraciones con el proceso de despliegue, respaldar PostgreSQL y usar
  un volumen persistente para futuros modelos/imágenes procesadas.
- La sincronización debe usar límites, tiempo de espera, registros y reintentos
  para no sobrecargar al proveedor ni la tienda.

## Verificación de esta sesión

- Importación SICODD de 100 productos: completada, sin fallos.
- Revisión de integridad de galerías y colores: 150 productos con imagen,
  495 imágenes registradas.
- Pruebas automatizadas actuales: 135 pruebas aprobadas en 35 archivos.
- Typecheck, lint y compilación de producción: aprobados.
- Imágenes Docker del procesador y worker: construidas; inferencia real de humo
  validada con salida PNG RGBA y máscara alfa de 0 a 255.
- Revisión visual realizada en móvil y ultraancho; catálogo sin desbordamiento
  horizontal y fichas accesibles desde la tarjeta. La revisión final confirmó
  también el panel de filtros a 390 px y 3840 px, sin desbordamiento.
