# Normalización de identidad V2

## Aplicado en V2

- El nombre público y accesible es `Angel Janvier`, sin acento.
- La ubicación pública es `ZACATECAS_MX / REMOTE_WORLDWIDE`.
- El panel técnico de Inicio utiliza las coordenadas de Zacatecas, no las de
  Monterrey.
- El footer público expone `ADMIN_ACCESS` hacia `/admin/acceso`; la seguridad
  sigue dependiendo de la autenticación administrativa.

## Referencias conservadas deliberadamente

Las apariciones de nombre anterior que siguen en estos archivos no participan
en la aplicación V2 ni se publican mediante Next.js:

- `index.html`, `contacto.html`, `catalogo.html` y `data/custom-text.txt`:
  sitio estático legado preservado como referencia.
- `backend/`: aplicación Express/SQLite legada y excluida de la imagen V2.
- `docs/PHASE_0_AUDIT.md`: auditoría histórica que debe conservar el contexto
  original.

No se modificaron rutas, hashes, migraciones ni nombres de activos
`angel_janvier_*`; esos identificadores ya son compatibles y pueden ser
referenciados por material existente.
