# Respaldo cifrado de producción a GitHub

`scripts/unix/production-backup-to-git.sh` respalda el estado irremplazable de
JANVIER V2: PostgreSQL, activos privados y `.env.production`. El código se
recupera desde el repositorio principal. Cada archivo de estado se cifra con
`age` antes de entrar al repositorio de respaldos.

## Preparación única en Ubuntu

1. Crea `AngelJanvier01/Janvier_Shop_Backups` como repositorio **privado** e
   inicialízalo con un README para que exista la rama `main`.
2. Instala dependencias:

   ```bash
   sudo apt update
   sudo apt install -y age git
   ```

3. Genera la clave de cifrado fuera del servidor y conserva su clave privada
   en un gestor de contraseñas o dispositivo offline. Copia sólo la clave
   pública (`age1...`) al servidor.
4. Crea una clave SSH exclusiva para este respaldo y agrégala en GitHub como
   Deploy key con permiso de escritura **sólo** al repositorio de respaldos.
   Guarda la clave privada en `/etc/janvier-backup/id_ed25519` con modo `600`.
   La variable `GIT_SSH_COMMAND` del archivo de configuración de ejemplo usa
   esa clave y evita que Git utilice alguna otra identidad del servidor.
5. Copia `scripts/unix/janvier-backup.env.example` a
   `/etc/janvier-backup.env`, ajusta sus valores y ejecuta:

   ```bash
   sudo chmod 600 /etc/janvier-backup.env
   sudo install -m 644 scripts/systemd/janvier-backup.service /etc/systemd/system/
   sudo install -m 644 scripts/systemd/janvier-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now janvier-backup.timer
   sudo systemctl start janvier-backup.service
   ```

6. Comprueba el resultado con `sudo journalctl -u janvier-backup.service -n 100`.

Los dumps sin cifrar y el clon del repositorio se crean en una carpeta temporal
y se eliminan al acabar, incluso si hay un error. El servidor conserva la base
activa porque la aplicación no puede funcionar sin ella; lo que no persiste
localmente son las copias de respaldo.

## Restauración

La clave privada de `age` es indispensable. Descifra un snapshot en una máquina
segura, valida `manifest.sha256`, restaura el dump con `pg_restore` y devuelve
los activos privados al volumen correspondiente. Prueba este proceso antes de
depender del respaldo ante un incidente real.

## Capacidad

GitHub rechaza archivos individuales mayores a 100 MB y no está diseñado para
historial ilimitado de binarios. Este mecanismo es una segunda copia cifrada.
Si los dumps o activos crecen, añade almacenamiento de objetos o una copia
externa semanal; no desactives el cifrado ni subas datos en claro.
