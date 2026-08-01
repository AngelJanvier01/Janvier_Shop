# Desarrollo de JANVIER V2

## Requisitos

- Node.js 22.12 o superior.
- npm 10 o superior.
- PostgreSQL para migraciones, generación de cliente y datos reales.

## Inicio local

1. Copia .env.example como .env y completa DATABASE_URL con una conexión local o de staging.
2. Ejecuta npm install.
3. Ejecuta npm run prisma:generate cuando exista la conexión configurada.
4. Ejecuta npm run dev.
5. Abre http://localhost:3001.

El legado conserva el puerto 3000. La V2 usa 3001 en desarrollo para permitir ejecutar ambas aplicaciones.

## Calidad

```text
npm run typecheck
npm run lint
npm run format
npm run test
npm run check
```

Los cambios de base de datos requieren migración y un plan de rollback documentado. Consultar JANVIER_IMPLEMENTATION_BASE.md antes de crear módulos de negocio.
