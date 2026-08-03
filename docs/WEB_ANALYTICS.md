# Analítica web first-party

JANVIER mide señales de uso útiles para operar el sitio sin usar un proveedor externo ni construir perfiles de visitantes.

## Qué se registra

- Vistas de rutas públicas.
- Clics sobre navegación y CTAs marcados explícitamente.
- Salidas a servicios externos marcadas, como WhatsApp.
- La fuente como **origen** (`https://ejemplo.com`), no la URL de referencia completa.
- Banda de viewport y tema visual como datos técnicos agregables.
- Una sesión aleatoria por pestaña, transformada con HMAC-SHA-256 antes de llegar a PostgreSQL.

## Qué no se registra

- Dirección IP, user-agent, geolocalización, correo, teléfono, formularios, texto escrito, query strings, cookies persistentes, grabaciones de sesión o mapas de calor.
- Rutas `/admin`, `/api` y `/propuesta/*`.
- Identidad de una persona concreta. El panel habla de **sesiones anónimas**, no de usuarios identificados.

## Panel

`/admin/analitica` muestra para los últimos siete días vistas, sesiones anónimas, clics útiles, diagnósticos y su tasa de conversión. También incluye rutas, CTAs y fuentes principales, más una actividad diaria de catorce días.

El tracker es best-effort: una visita o navegación nunca espera una inserción de analítica y el sitio funciona aunque el endpoint falle.

## Retención

La retención inicial es de 90 días. Ejecutar primero:

```powershell
npm run analytics:prune
```

Y aplicar la limpieza explícitamente desde una tarea programada del servidor:

```powershell
npm run analytics:prune -- --apply
```

La limpieza no ocurre durante una solicitud pública. Configurarla semanal o mensualmente en el servidor junto con el respaldo de PostgreSQL.

## Límites y siguiente decisión

Para analítica con cookies persistentes, campañas publicitarias, grabación de sesiones, correo automatizado o un CRM externo se necesita una decisión explícita sobre proveedor, contrato de tratamiento de datos y aviso de privacidad. No se activan por defecto en JANVIER.
