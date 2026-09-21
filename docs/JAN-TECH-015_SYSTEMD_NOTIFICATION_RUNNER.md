# JAN-TECH-015 - Systemd notification runner requires Docker-equivalent privileges

**Estado:** retirada para el dispatch transaccional; el timer de reporte diario
queda como mecanismo opcional heredado.

## Contexto

El dispatch transaccional ahora corre como `email-worker` dentro de Compose y no
requiere una cuenta systemd con acceso al socket Docker. Las instalaciones
anteriores deben desactivar `janvier-email-dispatch.timer` y retirar el usuario
del grupo `docker` si ningún otro proceso lo necesita.

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

Si se conserva el timer opcional del reporte diario, mantiene esta consideración.
El criterio restante es mover también esa programación a un scheduler sin socket
Docker o ejecutarla desde una plataforma externa con permisos limitados.
