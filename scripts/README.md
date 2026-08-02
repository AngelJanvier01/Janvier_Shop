# Scripts operativos de JANVIER V2

Estos scripts operan el entorno Docker local o de staging. La producción se
desplegará sin Docker, mediante el proceso Ubuntu documentado en el plan maestro.

## Windows / Docker Desktop

Desde PowerShell, en la raíz del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\windows\ejecutar.ps1
```

- `ejecutar.ps1`: crea `.env` si no existe, genera el secreto local, levanta
  PostgreSQL, aplica migraciones, ejecuta el backfill Markdown y arranca la V2.
- `actualizar.ps1`: reconstruye con `npm ci` según `package-lock.json`, actualiza
  la imagen de PostgreSQL, aplica migraciones y ejecuta el backfill Markdown. No ejecuta `npm update` de
  forma ciega.
- `finalizar.ps1`: detiene los servicios y conserva la base de datos.
- `finalizar.ps1 -RemoveData`: destruye también el volumen local de PostgreSQL.
  Usar sólo cuando se quieran borrar todos los datos de desarrollo.

## macOS y Linux

```bash
bash scripts/unix/ejecutar.sh
```

Equivalentes:

```bash
bash scripts/unix/actualizar.sh
bash scripts/unix/finalizar.sh
bash scripts/unix/finalizar.sh --remove-data
```

## Direcciones locales

- Sitio V2: `http://localhost:3001`
- PostgreSQL: `localhost:5432`

Los puertos se pueden cambiar en `.env` con `APP_PORT` y `POSTGRES_PORT` antes
de ejecutar los scripts.

Si `APP_PORT` ya pertenece a otro servidor local, los scripts se detienen antes
de arrancar para no mezclar aplicaciones. Por ejemplo, cambia `APP_PORT="3003"`
en `.env` si ya tienes un `npm run dev` usando el puerto 3001.

## Datos y seguridad

- `.env` no se sube al repositorio.
- El primer arranque genera un `AUTH_SECRET` local si sigue usando el marcador.
- La contraseña de PostgreSQL del ejemplo es únicamente para desarrollo local.
  Debe cambiarse antes de cualquier entorno compartido.
- El comando de finalizar normal no borra los datos. El borrado exige una opción
  explícita y no tiene recuperación automática.
- Docker service `migrate` runs `npm run db:bootstrap`, which runs
  `prisma migrate deploy` and then `npm run proposals:backfill-markdown` before
  the application starts. Inspect it without writing using `docker compose run
  --rm migrate npm run proposals:backfill-markdown -- --dry-run`.
