# SEO, indexación y medición

## Dominio y metadatos

`NEXT_PUBLIC_SITE_URL` define el origen canónico. En producción debe contener el dominio
final con HTTPS y sin una ruta adicional, por ejemplo `https://jaanviieer.com`.

La aplicación genera:

- `/robots.txt` con referencia al sitemap y bloqueo de rutas privadas;
- `/sitemap.xml` con páginas públicas, proyectos autorizados y productos publicados;
- canonicals, Open Graph, Twitter Card y JSON-LD por página;
- `/manifest.webmanifest`, favicon e imagen social;
- `noindex` en desarrollo, staging y áreas privadas.

Para permitir la indexación se necesitan las tres condiciones siguientes:

1. `NODE_ENV=production`;
2. `NEXT_PUBLIC_SITE_URL` con HTTPS y un host que no sea local;
3. `SEARCH_INDEXING_DISABLED=false`.

En staging usa `SEARCH_INDEXING_DISABLED=true`.

## Google Search Console

1. Crea una propiedad de dominio para `jaanviieer.com`.
2. Verifica la propiedad mediante el TXT que indique Google en el DNS autoritativo.
3. Opcionalmente configura `GOOGLE_SITE_VERIFICATION` si también quieres la etiqueta
   HTML de verificación.
4. Comprueba `https://jaanviieer.com/robots.txt` y
   `https://jaanviieer.com/sitemap.xml`.
5. Envía `https://jaanviieer.com/sitemap.xml` desde el informe de sitemaps.
6. Inspecciona la portada, `/estudio`, `/suministro/catalogo` y una ficha de producto.
7. Solicita indexación inicial únicamente después de abrir el tráfico público.

## Bing Webmaster Tools e IndexNow

`BING_SITE_VERIFICATION` añade la etiqueta de verificación de Bing. IndexNow necesita una
llave pública de 8 a 128 letras, números o guiones en `INDEXNOW_KEY`. La aplicación la
sirve en `/api/indexnow/key`; no es una contraseña.

Notifica una o varias URLs nuevas, actualizadas o eliminadas con:

```bash
npm run seo:indexnow -- --url /ruta-nueva --url /ruta-actualizada
```

El script sólo acepta URLs del origen configurado, envía `keyLocation` y no imprime la
llave. `INDEXNOW_ENDPOINT` permite cambiar el endpoint sin modificar código.

## Google Analytics 4 o Tag Manager

La medición propia de JANVIER funciona sin cookies publicitarias. La integración externa
es opcional y no se carga hasta que el visitante la acepta.

- Configura `NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID` para usar un contenedor GTM.
- Si no usas GTM, configura `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` con un identificador `G-`.
- Si ambos están presentes, GTM tiene prioridad para evitar medición duplicada.
- No envíes nombre, correo, teléfono, contenido de formularios ni identificadores de
  cliente en etiquetas.

La capa de datos prepara `page_view`, `service_view`, `project_view`,
`contact_form_submit`, `email_click`, `phone_click`, `whatsapp_click`, `download` y
`external_link_click`. El pie permite retirar o cambiar la preferencia.

## Datos coherentes para Google Business Profile

Usa únicamente datos comprobados. La web publica actualmente:

- marca: `JANVIER`;
- responsable: `Angel Janvier`;
- sitio: `https://jaanviieer.com`;
- teléfono: `+52 1 492 394 0983`;
- correo de privacidad: `janviersolutionsbusiness@gmail.com`;
- ubicación comunicada: `Zacatecas, México`;
- modalidad: atención directa y trabajo remoto;
- descripción breve: `Software, consultoría, infraestructura y suministro tecnológico.`

No publiques una dirección física, horarios, categorías, fotografías o área de servicio
más precisa hasta confirmarlos en operación.

## Comprobaciones después del despliegue

```bash
curl -I https://jaanviieer.com
curl -fsS https://jaanviieer.com/robots.txt
curl -fsS https://jaanviieer.com/sitemap.xml
curl -fsS https://jaanviieer.com/api/health
```

Comprueba además la imagen social con los depuradores de las plataformas elegidas y
valida los schemas con Rich Results Test o Schema Markup Validator. Estas validaciones
externas no pueden marcarse como concluidas antes de que el dominio apunte al despliegue.
