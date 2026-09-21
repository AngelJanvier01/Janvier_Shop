# Validación posterior al despliegue

No marques una casilla por inferencia. Registra evidencia del dominio real y conserva los
resultados del smoke test, Playwright, compra de prueba y restauración.

## Registro

- Fecha UTC:
- Operador:
- Revisión Git:
- Snapshot previo:
- Resultado del smoke test:
- Resultado E2E público:

## P0 — Servicio y red

- [ ] `https://jaanviieer.com` responde HTTP 200.
- [ ] `http://jaanviieer.com` redirige permanentemente a HTTPS.
- [ ] `https://www.jaanviieer.com/ruta?x=1` redirige a la misma ruta y query del dominio
      canónico.
- [ ] El certificado HTTPS es válido, coincide con el hostname y no está próximo a vencer.
- [ ] HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y
      protección contra framing están presentes.
- [ ] Sólo `127.0.0.1:3001` está publicado por Compose.
- [ ] PostgreSQL 5432, background-removal 8080 y los workers no están expuestos.
- [ ] `cloudflared`, Docker y todos los servicios permanentes reinician correctamente.
- [ ] `/api/health` responde `status=ok` y confirma acceso a la base de datos.
- [ ] Una ruta inexistente responde 404 con la página diseñada.

## P0 — Sitio público

- [ ] La página principal carga sin errores de consola o red.
- [ ] `/estudio`, `/soluciones`, `/proyectos`, `/acerca`, `/contacto`, `/diagnostico`,
      `/laboratorio`, `/aplicacion`, `/privacidad` y `/terminos` responden correctamente.
- [ ] `/suministro` y `/suministro/catalogo` cargan con productos reales.
- [ ] Navegación, menú móvil, footer, WhatsApp, correo y teléfono funcionan.
- [ ] No hay imágenes rotas; Open Graph, favicon, logotipo y varias imágenes de producto
      responden 200 con MIME de imagen.
- [ ] Las imágenes tienen proporción estable y no causan CLS visible.
- [ ] Formularios muestran labels, validación, estado de envío, error y éxito.
- [ ] El formulario de contacto genera una solicitud real y no permite doble envío.
- [ ] Rate limiting y honeypot bloquean abuso sin impedir un envío normal.
- [ ] Login administrativo funciona y una contraseña incorrecta no revela información.
- [ ] Login/registro de cliente y recuperación operativa se comportan según configuración.
- [ ] Permisos OWNER, MANAGER y EDITOR impiden acciones no autorizadas.
- [ ] No es posible descargar documentos, comprobantes o propuestas ajenas.

## P0 — Correo

- [ ] `npm run notifications:test` entrega un correo real.
- [ ] Remitente, reply-to y destinatarios son correctos.
- [ ] No aparecen contraseñas, tokens ni datos personales completos en logs.
- [ ] Un fallo SMTP queda en cola/reintento y es visible para operación.
- [ ] Correo de formulario, documento y pedido llega cuando corresponde.

## P0 — Mercado Pago y webhooks

- [ ] Las credenciales de prueba pertenecen a la aplicación correcta.
- [ ] El checkout de prueba inicia sin exponer el access token.
- [ ] Una compra controlada concluye con el importe esperado.
- [ ] Mercado Pago entrega el webhook a
      `https://jaanviieer.com/api/webhooks/mercado-pago`.
- [ ] La firma del webhook se valida y un webhook inválido se rechaza.
- [ ] La repetición del mismo webhook es idempotente.
- [ ] El pedido y el pago quedan visibles en Admin con estado correcto.
- [ ] Reembolso y pago parcial se reflejan según el flujo soportado.

## P0 — Scrapeo, imágenes y datos

- [ ] La conexión SICODD funciona con una cuenta dedicada de lectura.
- [ ] El análisis importa familias y subcategorías reales.
- [ ] La muestra de 35 artículos termina sin errores no explicados.
- [ ] Existencias por sucursal y fecha de actualización aparecen en Admin.
- [ ] El catálogo público muestra únicamente el acumulado.
- [ ] Imágenes PNG aprobadas no se reprocesan innecesariamente.
- [ ] El worker de imágenes procesa sin GPU y respeta sus límites de CPU/RAM.
- [ ] Productos e imágenes quedan como borrador hasta la revisión prevista.
- [ ] El barrido completo termina y su reporte coincide con los registros creados.

## P0 — SEO técnico e identidad web

- [ ] `robots.txt` permite rutas públicas, bloquea rutas privadas y enlaza el sitemap.
- [ ] `sitemap.xml` contiene las rutas públicas, proyectos y productos publicados.
- [ ] Sitemap no contiene Admin, cuentas, propuestas, errores ni staging.
- [ ] Cada ruta pública tiene title, description y canonical únicos y correctos.
- [ ] Open Graph y Twitter Card usan URLs absolutas e imágenes válidas.
- [ ] `/manifest.webmanifest` responde 200 y declara JANVIER/es-MX.
- [ ] Favicon y Apple Touch Icon cargan correctamente.
- [ ] JSON-LD es JSON válido y representa Person/Organization/servicios/breadcrumbs sin
      datos inventados.

## P0 — Analítica propia y privacidad

- [ ] La analítica interna registra señales sin nombre, correo, teléfono ni texto libre.
- [ ] `contact_form_submit`, clics de contacto, vistas y descargas aparecen una sola vez.
- [ ] Privacidad describe correctamente las herramientas realmente activas.

## P0 — Responsive, accesibilidad y rendimiento

- [ ] 320×568, 390×844, tablet, laptop, 1080p y pantalla grande no tienen overflow.
- [ ] Teclado, foco visible, menú, labels, landmarks, alt y reduced motion funcionan.
- [ ] Zoom al 200 % no pierde contenido ni acciones.
- [ ] No hay errores JavaScript, respuestas 5xx o 404 inesperados en consola/red.

## P0 — Backup, restauración y rollback

- [ ] El backup manual produce dump, propuestas, documentos, imágenes y checksums.
- [ ] El backup cifrado llega al repositorio privado sin archivos en claro.
- [ ] La clave privada `age` existe fuera del servidor y puede descifrar el snapshot.
- [ ] `janvier-backup.timer` está habilitado y la última ejecución terminó correctamente.
- [ ] Se preparó un Ubuntu limpio y se restauró desde cero siguiendo
      `PRODUCTION_DEPLOYMENT.md`.
- [ ] PostgreSQL, productos, usuarios, pedidos, propuestas, documentos e imágenes
      restaurados coinciden con el snapshot.
- [ ] Smoke test y E2E público pasan sobre el sistema restaurado.
- [ ] Se registraron duración, revisión y fecha de la restauración.
- [ ] Se ejecutó o ensayó el rollback a la revisión/snapshot anterior.

## Seguimiento posterior ya contemplado en P1/P2

- [ ] Google Search Console tiene la propiedad verificada y acepta `/sitemap.xml`. (P1)
- [ ] Las URLs principales se inspeccionaron sin bloqueo accidental. (P1)
- [ ] IndexNow acepta una notificación de una URL publicada o actualizada. (P1)
- [ ] GA4/GTM no carga antes del consentimiento cuando está configurado. (P1)
- [ ] Aceptar habilita la medición y retirar preferencias la detiene. (P1)
- [ ] Firefox actual pasa navegación, formulario, catálogo y checkout. (P2)
- [ ] Edge actual pasa navegación, formulario, catálogo y checkout. (P2)
- [ ] Safari actual en macOS/iPhone pasa navegación, formulario, catálogo y checkout. (P2)
- [ ] Core Web Vitals se midieron en el dominio real y se archivó la evidencia de LCP,
      INP y CLS. (P2)

## Comandos de evidencia

```bash
cd /srv/janvier/Janvier_Shop
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm --no-deps e2e \
  node scripts/smoke/production-smoke.mjs
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm e2e
sudo ss -lntup
sudo systemctl status cloudflared janvier-backup.timer --no-pager
sudo journalctl -u janvier-backup.service -n 100 --no-pager
```
