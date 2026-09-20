# Sincronización incremental de SICODD

El panel `/admin/sincronizacion` es el centro operativo del catálogo del proveedor.
No guarda contraseñas: el acceso al proveedor se toma exclusivamente de `SICODD_USERNAME`,
`SICODD_ADMIN_PASSWORD` y `SICODD_BASE_URL` del entorno.

## Operación

- **Probar conexión** valida el login sin alterar productos.
- **Analizar subcategorías** guarda familias y subfamilias reales de SICODD.
- **Ejecutar muestra limitada** procesa hasta el límite configurado y termina dentro de la
  solicitud administrativa. Sirve para comprobar mapeos y el alcance elegido.
- **Enviar barrido completo a la cola** crea una corrida auditable; nunca intenta recorrer
  miles de productos desde una solicitud HTTP.
- El **programador** puede activar una corrida diaria, con hora/minuto de Ciudad de México
  y un límite opcional. Vacío significa todas las subcategorías detectadas.

Cada corrida tiene número secuencial, actor (o `PROGRAMADOR DEL SISTEMA`), alcance,
estado, diagnósticos y una fila por producto. El enlace `VER REPORTE DETALLADO` permite
ver productos nuevos, actualizados, sin cambios y fallidos; variaciones de precio, agotados
y URLs de imagen detectadas, en cola u omitidas.

## Trabajador de producción

`compose.production.yaml` incorpora `sicodd-sync-worker`. Debe estar activo junto con
`web`, `database` e `image-worker`:

```sh
docker compose -f compose.production.yaml up -d --build sicodd-sync-worker image-worker web
```

El trabajador revisa la cola y el programador cada 30 segundos. Para diagnosticar una
sola vuelta dentro del contenedor de operaciones:

```sh
npm run sicodd:worker:once
```

No expongas este worker a Internet y no pongas credenciales de SICODD en el panel ni en el
repositorio.

## Incrementalidad y datos guardados

Para cada producto se persisten identificador de fuente, URL de ficha, payload de proveedor,
fecha de última lectura y tres hashes SHA-256:

- ficha comercial;
- especificaciones;
- manifiesto de URLs de imagen.

Cuando SICODD expone `ETag`, también se conserva para solicitar la ficha con
`If-None-Match` en la siguiente corrida. Una respuesta `304 Not Modified` evita transferir y
parsear de nuevo la ficha técnica; precio, costo y existencias siguen comparándose contra el
listado. Si el proveedor no ofrece ese encabezado, el sistema conserva el mecanismo de hashes
para no reescribir ni reprocesar datos ya iguales.

Los selectores del panel determinan cuáles campos se escriben: precios/mayoreo, costos,
existencias, ficha, especificaciones, galería y taxonomía. Las URLs de imagen existentes no
se vuelven a encolar. El worker calcula además el hash binario de cada imagen: si el proveedor
repite un archivo bajo otra URL para la misma ficha, omite la segmentación y el almacenamiento
duplicados.

Al eliminar una imagen desde `/admin/catalogo`, se retira de la galería pública, se borra su
derivado local y se guarda una exclusión con hash de URL y, si existe, hash de contenido. Las
siguientes corridas filtran esa imagen antes de encolarla. `REPROCESAR` es la anulación manual
intencional de esa exclusión.

No es posible conocer que una URL nueva contiene exactamente los mismos bytes sin leerla al
menos una vez; por eso el sistema evita su procesamiento y almacenamiento posteriores, pero
la verificación de contenido requiere esa única descarga.

## Despliegue

La migración `20260919060000_sicodd_incremental_sync` debe aplicarse antes de actualizar los
contenedores:

```sh
npm run prisma:deploy
npm run build
```

Después comprueba `/admin/sincronizacion`, ejecuta primero una muestra pequeña y revisa su
reporte antes de habilitar el programador diario o encolar el catálogo completo.
