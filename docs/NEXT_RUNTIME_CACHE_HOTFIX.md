# Hotfix: caché runtime de Next.js en producción

## Síntoma y causa

El servicio web de producción mantiene el filesystem raíz como sólo lectura.
Antes de este hotfix sólo `/tmp` era `tmpfs`. Al procesar una solicitud real de
Image Optimization, Next.js intenta crear `/app/.next/cache`; como no había un
mount escribible en esa ruta, registraba `ENOENT`, un fallo de escritura de
caché y un `unhandledRejection`.

El healthcheck consulta `/api/health`, que no usa el optimizador de imágenes,
por lo que el contenedor podía estar `healthy` aun con el defecto. La imagen de
rollback también lo reprodujo porque comparte el mismo montaje runtime.

La imagen declara el usuario `janvier`, pero la inspección aislada observó
`uid=1001` y `gid=65533` (`nogroup`). El Dockerfile crea el grupo `janvier`
con GID `1001` y copia los archivos de aplicación como `1001:1001`, pero
`adduser` no deja al usuario con ese grupo como primario. Los archivos
verificados `/app/server.js`, `.next` y `.next/static` pertenecen a
`1001:1001`.

## Solución y propiedades de seguridad

El servicio `web` conserva `read_only: true` y añade exclusivamente este
`tmpfs` efímero:

```text
/app/.next/cache:rw,nosuid,nodev,noexec,size=64m,mode=0700,uid=1001,gid=1001
```

Además, sólo `web` declara `user: "1001:1001"`. El override alinea el UID y
el GID efectivos con la propiedad de la aplicación y del tmpfs sin ejecutar
como root. `database` y `migrate` no reciben este override.

- La imagen ejecuta como `janvier` (UID/GID `1001`), que es el propietario del
  mount con modo `0700`.
- El límite es 64 MiB. La caché no persiste, no se incluye en backups y se
  vacía al recrear `web`.
- No se monta `/app`, `/app/.next`, `.next/static`, ningún directorio del host
  ni activos privados. El volumen de activos privados y el volumen PostgreSQL
  no cambian.
- `nosuid`, `nodev` y `noexec` reducen la superficie del mount temporal.
- Los metadatos del volumen real de activos se comprobaron sin listar ni
  modificar archivos: su directorio pertenece a `1001:1001` y tiene escritura
  de propietario. Una prueba posterior usa un volumen temporal independiente
  para confirmar escritura con la nueva identidad.

## Validación antes de desplegar

1. Ejecutar `docker compose --env-file .env.production -f
compose.production.yaml config -q`.
2. Ejecutar la prueba unitaria `production-compose-runtime-cache.test.ts`.
3. Usar la imagen ya construida `janvier-v2-web:v2.0.2-3232d4d` en un
   contenedor aislado, con rootfs de sólo lectura y los dos tmpfs. Confirmar
   UID/GID `1001`, modo `700`, escritura dentro de `/app/.next/cache` y fallo
   de una escritura arbitraria en `/app`.
4. Comprobar mediante `df` que el tmpfs es aproximadamente 64 MiB y escribir
   como máximo 1 MiB para la prueba.

## Despliegue y rollback

Este cambio de Compose no reconstruye ni modifica la imagen v2.0.2. Tras una
autorización separada, recrear exclusivamente `web` con `--no-deps --no-build`
y verificar el mount y sus permisos desde el contenedor. Hacer una solicitud
real a `/_next/image` y revisar que no existan `ENOENT` ni
`unhandledRejection` posteriores.

Si el despliegue falla, volver a etiquetar la imagen de rollback ya verificada
y recrear únicamente `web`; no restaurar PostgreSQL ni revertir migraciones. Un
fallo de montaje debe investigarse con `docker inspect` y `df` dentro de un
contenedor aislado, no haciendo escribible `/app` completo ni desactivando
`read_only`.

En una reconstrucción futura, el Dockerfile debería crear `janvier` con el
grupo `janvier` como grupo primario, o declarar `USER 1001:1001`, para que la
imagen no necesite el override de Compose. Ese ajuste no forma parte de este
hotfix y no requiere reconstruir la imagen actual.
