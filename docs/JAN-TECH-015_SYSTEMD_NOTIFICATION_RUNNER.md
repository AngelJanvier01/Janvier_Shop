# JAN-TECH-015 - Systemd notification runner requires Docker-equivalent privileges

**Estado:** aceptada temporalmente para una sola instancia de produccion.

## Contexto

Los timers de correo ejecutan `docker compose run` para usar la imagen de
operaciones de JANVIER. Por eso el usuario de sistema `janvier` pertenece al
grupo `docker`. Ese grupo concede privilegios administrativos indirectos sobre el
host mediante el socket Docker.

## Limites obligatorios

- Aplica solo al servidor de la unica instancia de JANVIER.
- `janvier` es una cuenta de servicio sin contrasena interactiva; no se reutiliza
  para SSH humano ni para administracion diaria.
- No recibe claves SSH, tokens OAuth, credenciales adicionales ni acceso a otros
  secretos fuera de `.env.production` con permisos de grupo restringidos.
- `/var/run/docker.sock` nunca se monta ni se expone dentro de la aplicacion web.
- Las unidades usan `flock`, `NoNewPrivileges=true`, `UMask=0077`, timeout y
  rutas absolutas; esas medidas reducen superficie, pero no eliminan el poder del
  grupo Docker.

## Criterio de retiro

Migrar dispatch y scheduler a servicios dedicados de Compose que ejecuten la
imagen de JANVIER sin montar ni requerir `/var/run/docker.sock`. Al completar esa
migracion, retirar `janvier` del grupo `docker`, eliminar estas unidades systemd
y cerrar esta deuda.
