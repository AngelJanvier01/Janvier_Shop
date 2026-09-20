# Removedor local de fondos de producto

## Estado

El pipeline está implementado como un servicio interno. Conserva siempre la URL
original como fuente de trabajo, genera un PNG maestro con alfa y derivados
WebP/AVIF. La tienda pública **nunca usa esa URL de proveedor como respaldo**:
publica solamente un derivado local aprobado. Así el proveedor no participa en
la experiencia del cliente ni puede romper la galería si cambia su sitio.

El modelo elegido es `ZhengPeng7/BiRefNet_lite`, fijado en la revisión
`7838f1c3472f827cd8ce13ab5ccc2ce48077360f`. Tanto el modelo como la
implementación de BiRefNet declaran licencia MIT. El contenedor descarga el
modelo en su primer arranque y lo conserva en el volumen
`janvier_background_models`; las imágenes no se envían a una API externa.

## Flujo

```text
URL original SICODD
        ↓
ProductImageDerivative (PENDING / RETRY)
        ↓  FOR UPDATE SKIP LOCKED
image-worker valida host, tamaño, redirecciones y contenido
        ↓
background-removal (BiRefNet Lite, CPU)
        ↓
PNG + WebP + AVIF en janvier_product_images
        ↓
validación de formato, tamaño y transparencia
        ↓
APPROVED automático | READY para revisión | REJECTED
        ↓
catálogo usa únicamente WebP/AVIF local aprobado
```

La cola recupera trabajos abandonados a los 15 minutos, limita los intentos a
tres y aplica esperas de 1, 5 y 30 minutos. El worker procesa una imagen a la
vez para mantener acotado el consumo de CPU y memoria. Reprocesar incrementa la
versión de la ruta y limpia el derivado anterior después de escribir el nuevo.

Antes de invocar el modelo, el worker valida la firma binaria del archivo. Todo
PNG opaco pasa por BiRefNet igual que JPEG/WebP para retirar su lienzo de fondo;
no se confía en la extensión de la URL. Un PNG que ya contiene transparencia real
conserva su alfa para evitar volver opacas sus zonas transparentes. Al terminar,
JANVIER inspecciona el PNG local: exige formato PNG, alfa real, dimensiones de al
menos 72 px y contenido visible. Sólo ese resultado pasa a `APPROVED` de forma
automática. Una salida opaca, diminuta, incompleta o ambigua queda en `READY`
con el motivo `QUALITY_REVIEW` para revisión humana.

BiRefNet está configurado exclusivamente para CPU: la imagen instala las ruedas
CPU-only de PyTorch, carga el modelo con `.to("cpu")` y no declara dispositivos
GPU en Compose. `BACKGROUND_MODEL_THREADS` controla los hilos (dos por defecto).

Desde `janvier-hybrid-v4`, la entrada mantiene su relación de aspecto mediante
letterbox en vez de estirarse a un cuadrado. En fondos claros uniformes, una
guarda conservadora identifica únicamente el fondo conectado al borde y recupera
la silueta completa conectada a la máscara de BiRefNet. Así se conservan marcos,
pantallas, soportes, textos internos y piezas oscuras que un modelo de saliencia
podría confundir con el fondo. La misma protección reconoce fondos uniformes de
cualquier color. Si el fondo es complejo y la máscara conserva una porción
anormalmente pequeña, el pipeline mantiene la imagen original completa en vez de
entregar un recorte incompleto.

### Transparencia original confiable

No se usa la extensión de la URL para decidir el tratamiento. Algunas fuentes de
SICODD terminan en `.jpg` pero son realmente WebP con alfa. Si Sharp detecta alfa
real y contenido visible, JANVIER conserva esa silueta, la normaliza localmente a
PNG/WebP/AVIF y registra `SOURCE_IMAGE_WITH_ALPHA` en la ficha del derivado. De
esa forma no se vuelve a segmentar con IA un recorte que ya es preciso (y no se
introducen bordes escalonados). Las fuentes opacas o sin alfa significativo siguen
pasando por BiRefNet.

Durante un reprocesado, una imagen previamente aprobada se mantiene disponible
para el catálogo mientras se genera la siguiente versión. La nueva ruta se
publica sólo al aprobarse; los primeros resultados sin revisión no se exponen al
público.

## Configuración

Las variables están documentadas en `.env.example` y
`.env.production.example`:

- `PRODUCT_IMAGE_SOURCE_HOSTS`: allowlist CSV de hosts HTTPS descargables.
- `PRODUCT_IMAGE_MAX_SOURCE_BYTES`: límite de descarga, 20 MiB por defecto.
- `PRODUCT_IMAGE_STORAGE_PATH`: raíz persistente de derivados.
- `BACKGROUND_MODEL_ID` y `BACKGROUND_MODEL_REVISION`: modelo fijado.
- `BACKGROUND_MODEL_INPUT_SIZE`: lado de la entrada letterbox, 1536 por defecto.
- `BACKGROUND_MODEL_THREADS`: hilos de CPU del servicio.
- `BACKGROUND_MASK_GUARD_ENABLED`: activa la protección conservadora.
- `BACKGROUND_MASK_GUARD_SIZE`: resolución máxima del análisis estructural.
- `BACKGROUND_MASK_GUARD_SEED_ALPHA`: confianza mínima de BiRefNet para anclar
  una pieza del producto.
- `BACKGROUND_MASK_GUARD_MIN_LIGHT_BORDER`: proporción mínima de borde claro para
  reconocer una fotografía de estudio.
- `BACKGROUND_MASK_GUARD_COLOR_TOLERANCE`: tolerancia máxima del fondo uniforme.
- `BACKGROUND_MASK_GUARD_MIN_DOMINANT_BORDER`: presencia mínima de un color
  dominante en el borde para proteger productos sobre fondos no blancos.
- `BACKGROUND_MASK_COMPLEX_MIN_VISIBLE_RATIO`: cobertura mínima que debe conservar
  la IA sobre un fondo complejo; por debajo se usa el original completo.

`compose.production.yaml` mantiene el sistema web y el procesador con raíz de
sólo lectura. Sólo el worker puede escribir en `janvier_product_images`; la web
lo monta como sólo lectura. El servicio de inferencia no publica puertos al
host.

## Puesta en marcha

```powershell
# Arrancar primero la base
docker compose -f compose.production.yaml up -d database

# Aplicar migraciones/semilla con el perfil de mantenimiento
docker compose -f compose.production.yaml --profile maintenance run --rm migrate

# Construir y arrancar web, procesador y worker
docker compose -f compose.production.yaml up -d --build

# Encolar el catálogo existente una sola vez
docker compose -f compose.production.yaml run --rm image-worker npm run images:enqueue

# Consultar el estado
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs -f background-removal image-worker
```

El primer arranque tarda más porque descarga el modelo (aproximadamente 178
MB). Después, abrir **Admin > Catálogo**, revisar las vistas `READY` y aprobar o
rechazar. Mientras tanto, el sitio público muestra su estado de validación; no
filtra una imagen externa.

### Normalización de un lote ya procesado

Para instalaciones que ya tenían derivados `READY`, probar primero contra el
volumen real del worker y sólo después aplicar. Ejecutarlo en el contenedor es
importante: el host no monta `janvier_product_images`.

```bash
docker compose -f compose.production.yaml exec image-worker npm run images:approve-ready
docker compose -f compose.production.yaml exec image-worker npm run images:approve-ready -- --apply
```

El comando es idempotente. No descarga imágenes, no toca las fuentes y no
aprueba resultados que no superen la inspección. El worker también aplica la
misma regla a cada imagen nueva.

Después de mejorar el modelo o su resolución, reencolar primero las fichas
públicas para sustituir sus derivados sin mezclar la prioridad del catálogo con
borradores internos:

```bash
npm run images:reprocess-quality
npm run images:reprocess-quality -- --apply
```

Usar `--all --apply` únicamente después de validar el lote público; incluye los
derivados aprobados de productos que todavía no se publican.

## Respaldo y actualización

Respaldar juntos PostgreSQL y el volumen `janvier_product_images`. El volumen
del modelo es una caché reconstruible. Para cambiar de modelo o revisión:

1. probar la nueva revisión en un entorno no productivo;
2. actualizar las variables y reconstruir el servicio;
3. reprocesar una muestra y aprobarla visualmente;
4. sólo entonces reprocesar el catálogo completo.

No sobrescribir originales ni forzar la aprobación de resultados opacos o
ambiguos. La aprobación automática se limita a los derivados que superan la
validación objetiva anterior.

## Licencias y referencias

- Modelo: <https://huggingface.co/ZhengPeng7/BiRefNet_lite>
- Implementación: <https://github.com/ZhengPeng7/BiRefNet>
- Avisos: `services/background-removal/THIRD_PARTY_NOTICES.md`
