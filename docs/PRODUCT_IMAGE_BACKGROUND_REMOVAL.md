# Removedor local de fondos de producto

## Estado

El pipeline está implementado como un servicio interno. Conserva siempre la URL
original, genera un PNG maestro con alfa y derivados WebP/AVIF, y sólo publica
un resultado cuando una persona lo aprueba desde **Admin > Catálogo**.

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
READY → revisión humana → APPROVED o REJECTED
        ↓
catálogo usa WebP aprobado; en cualquier otro estado usa el original
```

La cola recupera trabajos abandonados a los 15 minutos, limita los intentos a
tres y aplica esperas de 1, 5 y 30 minutos. El worker procesa una imagen a la
vez para mantener acotado el consumo de CPU y memoria. Reprocesar incrementa la
versión de la ruta y limpia el derivado anterior después de escribir el nuevo.

Antes de invocar el modelo, el worker valida la firma binaria del archivo. Un
PNG válido conserva intacto su maestro, sólo genera WebP/AVIF y pasa directamente
a `APPROVED`; no se confía en la extensión de la URL ni se ejecuta BiRefNet.

BiRefNet está configurado exclusivamente para CPU: la imagen instala las ruedas
CPU-only de PyTorch, carga el modelo con `.to("cpu")` y no declara dispositivos
GPU en Compose. `BACKGROUND_MODEL_THREADS` controla los hilos (dos por defecto).

Desde `janvier-hybrid-v3`, la entrada mantiene su relación de aspecto mediante
letterbox en vez de estirarse a un cuadrado. En fondos claros uniformes, una
guarda conservadora identifica únicamente el fondo conectado al borde y recupera
la silueta completa conectada a la máscara de BiRefNet. Así se conservan marcos,
pantallas, soportes, textos internos y piezas oscuras que un modelo de saliencia
podría confundir con el fondo. La misma protección reconoce fondos uniformes de
cualquier color. Si el fondo es complejo y la máscara conserva una porción
anormalmente pequeña, el pipeline mantiene la imagen original completa en vez de
entregar un recorte incompleto.

## Configuración

Las variables están documentadas en `.env.example` y
`.env.production.example`:

- `PRODUCT_IMAGE_SOURCE_HOSTS`: allowlist CSV de hosts HTTPS descargables.
- `PRODUCT_IMAGE_MAX_SOURCE_BYTES`: límite de descarga, 20 MiB por defecto.
- `PRODUCT_IMAGE_STORAGE_PATH`: raíz persistente de derivados.
- `BACKGROUND_MODEL_ID` y `BACKGROUND_MODEL_REVISION`: modelo fijado.
- `BACKGROUND_MODEL_INPUT_SIZE`: lado de la entrada letterbox, 1024 por defecto.
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
rechazar. Hasta aprobarlas, el sitio público conserva la imagen original.

## Respaldo y actualización

Respaldar juntos PostgreSQL y el volumen `janvier_product_images`. El volumen
del modelo es una caché reconstruible. Para cambiar de modelo o revisión:

1. probar la nueva revisión en un entorno no productivo;
2. actualizar las variables y reconstruir el servicio;
3. reprocesar una muestra y aprobarla visualmente;
4. sólo entonces reprocesar el catálogo completo.

No sobrescribir originales ni aprobar automáticamente lotes completos.

## Licencias y referencias

- Modelo: <https://huggingface.co/ZhengPeng7/BiRefNet_lite>
- Implementación: <https://github.com/ZhengPeng7/BiRefNet>
- Avisos: `services/background-removal/THIRD_PARTY_NOTICES.md`
