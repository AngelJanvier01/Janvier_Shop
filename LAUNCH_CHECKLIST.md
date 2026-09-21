# Checklist de lanzamiento de JANVIER

Marca una tarea sólo después de comprobarla en el entorno indicado. Las tareas externas
no se consideran terminadas desde el repositorio.

## Verificación local — 21 de septiembre de 2026

- [x] `npm run check`: TypeScript, ESLint, Prettier y 171 pruebas unitarias.
- [x] `npm run build`: compilación de producción completada con 45 rutas.
- [x] Playwright sobre la compilación de producción: 40 pruebas aprobadas y 15
  omitidas por requerir credenciales o datos administrativos reales.
- [x] Recorrido público adicional: metadata, H1, enlaces internos, recursos, consola,
  robots, sitemap, manifest e imágenes sociales sin errores.
- [x] Matriz responsive en Chromium desde 320 × 568 hasta 1920 × 1080.
- [x] `npm audit --omit=dev`: cero vulnerabilidades conocidas.
- [x] `docker compose --env-file .env -f compose.production.yaml config -q`.

Esta verificación usa una URL local y datos de prueba. No sustituye las comprobaciones
marcadas abajo que deben repetirse con dominio, credenciales y datos de producción.

## P0 — Obligatorio antes de publicar

- [x] El código pasa TypeScript, ESLint, formato y pruebas unitarias.
- [x] Las dependencias de producción no reportan vulnerabilidades conocidas en
  `npm audit --omit=dev`.
- [x] `.env` y `.env.production` están ignorados por Git y Docker.
- [x] Las áreas administrativas, propuestas y cuentas privadas declaran `noindex` y
  `no-store`.
- [x] El sitio genera canonical, metadata social, robots, sitemap, manifest y JSON-LD.
- [x] Desarrollo y staging quedan con `noindex` cuando
  `SEARCH_INDEXING_DISABLED=true`.
- [x] Los formularios públicos tienen validación de servidor, honeypot y límites de
  solicitudes.
- [x] Las cabeceras de seguridad y las cookies de sesión están configuradas en código.
- [ ] Copiar `.env.production.example` a `.env.production`, usar permisos `600` y
  sustituir todos los valores de ejemplo.
- [ ] Confirmar `NEXT_PUBLIC_SITE_URL`, `APP_URL`, dominio, DNS y HTTPS reales.
- [ ] Configurar credenciales de prueba de Mercado Pago y registrar el webhook
  `/api/webhooks/mercado-pago`.
- [ ] Ejecutar una compra de prueba, validar el webhook y revisar el pedido en admin antes
  de usar credenciales reales.
- [ ] Configurar Gmail mediante contraseña de aplicación o Google OAuth y ejecutar
  `npm run notifications:test`.
- [ ] Ejecutar el scrapeo/sincronización inicial, revisar categorías, existencias e
  imágenes y publicar sólo productos verificados.
- [ ] Ejecutar `npm run check`, `npm run build` y `npm run test:e2e:production` con la
  configuración que se desplegará.
- [ ] Crear un respaldo previo y completar una restauración de prueba de base de datos,
  activos privados, documentos e imágenes.
- [ ] Desplegar en Ubuntu y comprobar `/api/health`, portada, contacto, catálogo, acceso
  administrativo, cuenta cliente, pago de prueba y una propuesta privada.
- [ ] Revisar consola y red en producción: sin errores inesperados, 404, imágenes rotas
  ni respuestas 5xx.

## P1 — Primera semana

- [ ] Verificar la propiedad de dominio en Google Search Console.
- [ ] Enviar `/sitemap.xml`, inspeccionar las rutas principales y solicitar la indexación
  inicial.
- [ ] Registrar Bing Webmaster Tools y configurar `BING_SITE_VERIFICATION` si se usa
  verificación HTML.
- [ ] Generar `INDEXNOW_KEY` y notificar las primeras URLs publicadas.
- [ ] Crear Google Business Profile con datos reales y completar la verificación.
- [ ] Configurar GA4 o GTM sólo si se necesita medición externa; confirmar que no carga
  antes del consentimiento.
- [ ] Configurar SPF, DKIM y DMARC para el dominio que envíe correo.
- [ ] Activar monitoreo de uptime para `/api/health`, vencimiento TLS, espacio en disco,
  cola de correo y ejecución de respaldos.
- [ ] Revisar logs saneados, eventos de pago y errores JavaScript durante tráfico real.

## P2 — Mejoras posteriores

- [ ] Medir Core Web Vitals con datos de campo y una traza de Chrome DevTools en el
  dominio público.
- [ ] Probar Safari, Firefox y Edge reales además de Chromium.
- [ ] Repetir restauraciones de respaldo de forma programada y registrar duración/RPO.
- [ ] Evaluar un servicio de error tracking con filtrado de datos personales.
- [ ] Revisar trimestralmente dependencias, políticas legales, schemas y contenido
  desactualizado.

## Acciones externas pendientes

- Google Search Console: verificación DNS, envío del sitemap e inspección de URLs.
- Bing Webmaster Tools: registro de propiedad y validación de IndexNow.
- Google Business Profile: creación, datos operativos y verificación.
- Analítica: creación del ID de GA4 o contenedor GTM, si se decide usarlo.
- Correo: contraseña de aplicación u OAuth, remitente real y SPF/DKIM/DMARC.
- Mercado Pago: credenciales, webhook público y prueba controlada.
- Infraestructura: dominio, DNS, Cloudflare Tunnel/TLS, alertas y restauración probada.
