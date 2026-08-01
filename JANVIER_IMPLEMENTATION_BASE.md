# JANVIER — Base de implementación V2

**Estado:** documento operativo para desarrollo  
**Versión:** 1.0  
**Proyecto:** JANVIER  
**Complementa:** JANVIER_MASTER_SPEC.md  
**Fecha:** 2026-07-31

---

## 1. Propósito y autoridad

Este documento convierte la visión de JANVIER en reglas concretas para implementar la V2. Debe consultarse antes de crear rutas, componentes, esquemas, APIs, migraciones o pantallas.

Jerarquía de decisiones:

1. Instrucciones explícitas de Ángel Janvier.
2. Esta base de implementación.
3. JANVIER_MASTER_SPEC.md para producto, marca y alcance.
4. Decisiones registradas al final de este documento.
5. Buenas prácticas vigentes del ecosistema.

Si hay conflicto entre documentos, no se improvisa: se registra y se resuelve antes de continuar. No se borran datos existentes, no se exponen secretos y no se implementa una función comercial sensible a medias.

### Resultado buscado

Construir una plataforma que:

- presente a JANVIER como firma de software, ingeniería y suministro;
- convierta visitas en diagnósticos, conversaciones y cotizaciones;
- muestre autoridad mediante proyectos y contenido;
- permita explorar productos sin exponer costos ni precios privados;
- administre contenido, productos, solicitudes y cotizaciones;
- crezca sin reescribir sus fundamentos.

### Fuera de la primera versión

- checkout automático;
- cobro con tarjeta;
- crédito empresarial;
- scraping de proveedores;
- catálogo publicado sin revisión;
- seis idiomas sin traducción humana;
- equipo, inventario o capacidades ficticias.

---

## 2. Marca y nuevos logos

### 2.1 Activos recibidos

Ángel proporcionó dos versiones del nuevo sistema visual:

1. **Símbolo JA:** composición caligráfica en negro con J, A, trazo orbital diagonal y estrella de cuatro puntas.
2. **Lockup Ángel Janvier:** firma gráfica apilada que integra el símbolo, ANGEL y JANVIER.

Los dos definen un carácter personal, artístico, preciso y dinámico. Son activos oficiales de referencia.

Los originales entregados actualmente en la raíz del repositorio son:

~~~text
angel_janvier_logo_black.svg
angel_janvier_logo_black_1600.png
angel_janvier_monogram_black.svg
angel_janvier_monogram_black_1600.png
~~~

Los SVG son la fuente canónica para web. Durante el PR 2 se copiarán sin modificación a public/brand; los originales de raíz se conservan como respaldo hasta que el flujo de activos quede documentado.

### 2.2 Jerarquía asumida

| Contexto | Identidad visible | Uso |
|---|---|---|
| Navegación y metadatos | JANVIER | Marca de la plataforma |
| Marca compacta | Símbolo JA | Favicon, loader, menú móvil, marcas de sección |
| Acerca de, footer y firma | Ángel Janvier | Fundador y autoría humana |
| Social/editorial autorizado | Lockup Ángel Janvier | Firma gráfica |

El nombre accesible de cualquier logo es: **JANVIER, fundada y dirigida por Ángel Janvier**.

Esta es una decisión de trabajo: si el lockup Ángel Janvier debe sustituir a JANVIER en navegación, se cambiará sólo esta sección y el componente Logo.

### 2.3 Entregables de marca antes de producción

Los PNG adjuntos son referencias aprobadas, no el recurso definitivo para navegación o impresión. Antes de publicar se requieren archivos originales, sin redibujar la geometría:

~~~text
public/brand/logo-mark.svg
public/brand/logo-lockup.svg
public/brand/logo-mark-light.svg
public/brand/logo-lockup-light.svg
public/brand/favicon.svg
public/brand/og-default.png
~~~

Reglas:

- No estirar, recortar, inclinar ni reconstruir letras con una fuente.
- No añadir glow, sombra, contorno, degradado o filtro que altere el carácter.
- Mantener margen de seguridad de al menos la altura de la estrella.
- Usar exportaciones claras para el tema night; no invertir un PNG por CSS.
- Animar opacidad, posición o revelado; jamás deformar la geometría.
- Si sólo existe raster temporal, mantener su proporción exacta y registrar la deuda de vectorización.

### 2.4 Firma visual

La estrella y el trazo diagonal pueden inspirar divisores, loaders y transiciones. Nunca sustituyen navegación, controles, texto, información legal ni elementos críticos.

---

## 3. Alcance V2

### 3.1 Primera versión pública

Se publica una experiencia completa y pulida en español para:

~~~text
/
/estudio
/estudio/software
/estudio/consultoria
/estudio/desarrollo-web
/estudio/soporte
/soluciones
/proyectos
/acerca
/contacto
/diagnostico
/suministro
/suministro/catalogo
/suministro/producto/[slug]
~~~

Incluye navegación accesible, temas neutral/night, contenido de marca, formularios persistentes, proyectos administrables, catálogo público de lectura sin precios y administración protegida.

### 3.2 Diferido con intención

Las siguientes áreas sólo pueden aparecer como Próximamente si existe una alternativa de contacto real:

~~~text
/suministro/credito-empresarial
/cuenta/*
/laboratorio/*
/ideas/*
~~~

No existen pantallas vacías, botones sin destino ni formularios que prometan funciones inexistentes.

### 3.3 Orden de prioridad

1. Software, consultoría y oportunidades.
2. Claridad de marca y rutas de intención.
3. Casos verificables y contenido.
4. Suministro y cotización manual.
5. Automatización comercial.
6. Herramientas, idiomas y expansión.

---

## 4. Arquitectura

### 4.1 Stack

~~~text
Web y servidor: Next.js + TypeScript
Base de datos: PostgreSQL
ORM y migraciones: Prisma
Validación: Zod
Formularios: React Hook Form + Zod
Estilos: CSS Modules + tokens CSS globales
Pruebas unitarias/integración: Vitest
Pruebas de flujos: Playwright
Procesos asíncronos: worker Node independiente, cuando exista una tarea real
~~~

Las versiones se instalan estables y se fijan en el lockfile al iniciar cada PR. No se añade una dependencia por moda.

### 4.2 Principios de código

- Server Components por defecto; Client Components sólo para interacción real.
- Todo dato sensible se calcula y autoriza en servidor.
- Rutas públicas no importan módulos administrativos ni secretos.
- Cada mutación valida sesión, permiso, origen y esquema Zod.
- No usar any ni ocultar errores de tipos.
- No duplicar precio, permisos, rutas o traducciones entre cliente y servidor.
- Toda mutación relevante deja auditoría.
- No usar Docker sin decisión explícita posterior.

### 4.3 Estructura

~~~text
app/
  [locale]/
    (marketing)/
    (commerce)/
    (account)/
    (admin)/
    layout.tsx
    not-found.tsx
  api/
    health/
    webhooks/
components/
  brand/ layout/ ui/ marketing/ projects/ commerce/ forms/ admin/ ascii/
lib/
  auth/ db/ validation/ pricing/ quotes/ permissions/ i18n/ security/ seo/
  analytics/ files/
messages/
prisma/
  schema.prisma
  migrations/
public/
  brand/ images/ fonts/
styles/
  tokens.css
  globals.css
  utilities.css
workers/
scripts/
tests/
  unit/ integration/ e2e/
docs/
  decisions/ deployment/
~~~

### 4.4 Límites de capa

| Capa | Responsabilidad | Nunca hace |
|---|---|---|
| app | rutas, composición, metadata, acceso | SQL directo o cálculo de precios |
| components | interfaz y accesibilidad | consultar base de datos |
| lib/validation | esquemas de entrada y salida | renderizar UI |
| lib/db | Prisma y repositorios | lógica de presentación |
| lib/pricing | precio visible y snapshots | depender de componentes |
| lib/permissions | roles, permisos y políticas | autorizar en cliente |
| workers | correo, importaciones, tareas largas | responder peticiones web |

---

## 5. Rutas, idioma y navegación

### 5.1 URL canónica

Español se publica en raíz:

~~~text
/              español canónico
/en/...        inglés
/ja/...        japonés
/fr/...        francés
/de/...        alemán
/ru/...        ruso
~~~

La arquitectura interna puede usar locale. No habrá copias indexables simultáneas bajo raíz y bajo /es.

### 5.2 Política de idioma

- Español completo y canónico primero.
- Inglés sólo tras revisión editorial.
- Los otros idiomas se publican gradualmente y con fallback explícito a español.
- Nunca redirigir automáticamente según país.
- La elección manual del visitante siempre prevalece.

### 5.3 Navegación principal

~~~text
Símbolo JA + JANVIER

ESTUDIO
SOLUCIONES
PROYECTOS
SUMINISTRO
LABORATORIO
ACERCA

Buscar · Cuenta · Contacto
~~~

En móvil, el menú se abre con botón etiquetado, encierra correctamente el foco, se cierra con Escape y devuelve el foco al disparador. WhatsApp y el CTA de proyecto están disponibles sin invadir la pantalla.

---

## 6. Sistema visual

### 6.1 Dirección

~~~text
industrial sci-fi
+ editorial técnico
+ web experimental noventero
+ precisión contemporánea
+ presencia humana
~~~

No debe parecer sitio gamer, hacker de película, terminal verde ni e-commerce genérico.

### 6.2 Tokens

No se añaden valores hexadecimales en componentes. Los colores se definen y consumen mediante tokens semánticos.

~~~css
/* Neutral */
--bg: #e8e6e0;
--bg-subtle: #dedcd5;
--surface: #f2f0ea;
--surface-raised: #faf8f3;
--text: #171816;
--text-muted: #656660;
--text-soft: #85867f;
--border: #c8c6bf;
--border-strong: #9f9f98;

/* Night */
--bg-night: #0d0f0c;
--bg-subtle-night: #11140f;
--surface-night: #151913;
--surface-raised-night: #1b2019;
--text-night: #eeeae1;
--text-muted-night: #aaa99f;
--text-soft-night: #7f837b;
--border-night: #30352e;
--border-strong-night: #525a50;

/* Semánticos */
--signal: #d64d38;
--signal-soft: #ef8b77;
--tech: #789183;
--warning: #b47720;
--success: #39755c;
--focus: #789183;
~~~

El tema se aplica en html con el atributo data-theme. Se resuelve antes de pintar para evitar flash de tema incorrecto. Preferencia del sistema da el valor inicial; la elección explícita del visitante manda.

### 6.2.1 Night: sistema activo

Night conserva la estructura, tipografía y jerarquía de neutral. Su diferenciación proviene de la alternancia de las cuatro superficies, señales y datos técnicos discretos; no de invertir todo a negro.

- Alternar `bg`, `bg-subtle`, `surface` y `surface-raised` entre secciones contiguas; no dejar la página como un bloque negro continuo.
- HUMAN_RESPONSIBILITY conserva marfil cálido para representar la responsabilidad humana dentro del sistema.
- Hero: cuadrícula más legible pero discreta, iluminación radial tenue detrás del monograma, línea `signal` y datos técnicos de apoyo. El SVG no recibe filtro ni se deforma.
- `phosphor` se reserva para estado, indicador, metadato activo y foco técnico; nunca como decoración general.
- La animación de entrada sólo usa opacidad y transform y no supera 1.3 segundos. Con `prefers-reduced-motion` no hay movimiento no esencial.
- Prohibidos glow fuerte, azul neón, morado, gradientes saturados, sombras exteriores de texto y filtros sobre el logotipo.
- Todos los pares de texto, controles y foco deben cumplir WCAG 2.2 AA. El inventario y comprobación vigente está en `docs/NIGHT_THEME_DECISION.md`.

### 6.3 Tipografía

~~~text
IBM Plex Sans Condensed: títulos, navegación, declaraciones.
IBM Plex Sans: cuerpo, formularios, descripciones y legal.
IBM Plex Mono: etiquetas, folios, estados, metadatos, precios y ASCII.
Fallback japonés compatible: sólo al renderizar japonés.
~~~

La columna de lectura mide 680–760 px. Administración y tablas pueden ser densas, no ilegibles.

### 6.4 Grid

~~~text
Máximo editorial: 1440 px
Grid escritorio: 12 columnas
Breakpoints: 640, 768, 1024, 1280 y 1440 px
Escala: 4, 8, 12, 16, 24, 32, 48, 64, 96 y 128 px
~~~

### 6.5 Componentes base

Antes de las páginas se implementan:

~~~text
Button, IconButton, TextLink, Tag, StatusBadge, SectionLabel,
TechnicalMeta, Card, MediaFrame, Field, TextArea, Select, Checkbox,
Dialog, Disclosure, EmptyState, LoadingState, ErrorState, Pagination,
DataTable, ThemeToggle, LocaleSwitcher y Logo.
~~~

Cada control tiene estados default, hover, focus-visible, active, disabled y loading, con contraste AA.

### 6.6 Movimiento y ASCII

| Tipo | Duración | Uso |
|---|---:|---|
| Micro | 120–240 ms | foco, botones, validación |
| Sección | 300–700 ms | medios, filtros, entrada |
| Firma | máximo 1.5 s | logo, hero, loader |

Sólo se anima transform y opacidad. Reduced motion elimina lo no esencial. El ASCII es decorativo y queda oculto a lectores de pantalla; nunca aparece en pagos, legal, navegación esencial, errores críticos ni tablas.

---

## 7. Experiencia pública

### 7.1 Inicio

El visitante debe entender qué es JANVIER, qué puede resolver, que existe una persona responsable y dónde empezar en menos de diez segundos.

Orden:

~~~text
Hero de marca
Puertas de intención
Capacidades
Proceso y confianza humana
Proyectos destacados
Suministro especializado
Laboratorio
CTA final
Footer
~~~

La portada no comienza con una cuadrícula de productos.

### 7.2 Puertas de intención

~~~text
01 Desarrollar — software, automatización o plataforma.
02 Resolver — diagnóstico, consultoría o estrategia.
03 Equipar — productos, infraestructura o compra por volumen.
04 Mantener — soporte, seguimiento o mejora continua.
~~~

Cada puerta termina en contenido y CTA reales, medibles.

### 7.3 Servicios

Cada servicio incluye problema, entregables, proceso, capacidades, casos, preguntas frecuentes y CTA. Se vende una disciplina de producto y resultado, no una lista de buzzwords.

### 7.4 Acerca de

Orden:

~~~text
Retrato
Declaración personal
Qué es JANVIER
Experiencia y disciplinas
Filosofía y proceso
Capacidades
Redes personal y de marca
CTA a diagnóstico
~~~

No se finge un equipo. Las fotos temporales se etiquetan como tales.

### 7.5 Proyectos

Un proyecto se administra y se publica por slug. Visibilidad:

~~~text
ANONIMO
PARCIAL
AUTORIZADO
PERSONALIZADO
~~~

No se publica nombre, logo, métrica o enlace de cliente sin autorización registrada.

### 7.6 Suministro

Suministro es la sección; catálogo es su función. Los visitantes buscan, filtran, comparan y solicitan; no ven precio hasta ser autorizados.

---

## 8. Datos

### 8.1 Reglas

- PostgreSQL es la fuente operativa de V2.
- Prisma aplica migraciones versionadas; nunca se altera producción manualmente.
- Las entidades comerciales se archivan o cambian de estado; no se borran sin regla.
- Timestamps en UTC.
- Todo monto usa Decimal. Nunca float ni aritmética monetaria JavaScript.
- Todo recurso público tiene slug único y validado.

### 8.2 Identidad

~~~text
User
UserProfile
Company
CompanyMember
Role
Permission
RoleAssignment
Session
VerificationToken
Address
ContactMethod
ConsentRecord
~~~

La relación usuario-rol es explícita. La autorización vive en servidor y por permiso.

### 8.3 Comercio

~~~text
Department
Category
Product
ProductTranslation
ProductAttributeDefinition
ProductAttributeValue
ProductMedia
Supplier
SupplierOffer
PriceTier
PriceRule
CustomerPriceOverride
Wishlist
Quote
QuoteItem
QuoteRevision
Order
OrderItem
Payment
PaymentEvidence
Shipment
ReturnRequest
WarrantyCase
CreditApplication
~~~

Invariantes:

- Product es ficha comercial; SupplierOffer son alternativas de proveedor.
- Costos sólo viven en entidades internas y jamás cruzan a DTOs públicos.
- QuoteItem y OrderItem guardan snapshots inmutables de nombre, SKU, impuesto, precio, costo autorizado y condiciones.
- Precio, moneda, vigencia, disponibilidad, envío e impuestos quedan contextualizados al emitir cotización.
- Medios e información de proveedor sólo se publican cuando su uso está autorizado.

### 8.4 Servicios, portafolio y contenido

~~~text
Service, ServiceTranslation, Inquiry, DiagnosticRequest, Proposal,
SupportTicket, AppointmentRequest,

Project, ProjectTranslation, ProjectMedia, ProjectMetric,
ProjectTechnology, ProjectService, ProjectProduct, ClientDisclosure,
Testimonial,

Article, ArticleTranslation, Tool, ToolTranslation, Page,
PageTranslation, NavigationItem, SiteSetting, MediaAsset, Redirect,
SeoMetadata,

AuditLog, Notification, EmailLog, JobRun, FeatureFlag, ChangeRequest.
~~~

AuditLog registra actor, acción, entidad, identificador, valores anterior/nuevo filtrados de secretos, IP, resultado y fecha.

---

## 9. Seguridad

### 9.1 Reglas no negociables

- No existe usuario, contraseña ni token administrativo predeterminado.
- No se soporta administración desde file://.
- No se guarda una sesión en localStorage.
- Cookies de sesión: HttpOnly, Secure, SameSite apropiado y revocables.
- Propietario y administradores usan 2FA antes de producción.
- Contraseñas se almacenan con hash de contraseñas aprobado y parámetros actuales.
- Secretos viven en variables de entorno o gestor de secretos, nunca en Git, JSON público, logs o navegador.
- No se expone precio de compra, margen, notas internas, documentos o datos fiscales.
- Cada ruta sensible aplica rate limit, validación, autorización y auditoría.

### 9.2 Roles

~~~text
Públicos:
GUEST, CUSTOMER, BUSINESS_CUSTOMER, WHOLESALE, DISTRIBUTOR, SPECIAL

Internos:
OWNER, ADMIN, CONTENT_EDITOR, SALES, SUPPORT, TECHNICIAN, VIEWER
~~~

El primer propietario se crea con un procedimiento de bootstrap de un solo uso, documentado y sin valores por defecto.

### 9.3 Formularios y archivos

- Validar cliente y servidor con los mismos esquemas cuando sea posible.
- Aplicar CSRF y verificar origen en mutaciones con cookie.
- Limitar longitud, cantidad y tamaño.
- Validar MIME real, extensión, contenido y tamaño.
- Generar nombres aleatorios; no usar el nombre del usuario como ruta pública.
- Documentos privados se sirven mediante URL autorizada con expiración, no desde directorio estático.

### 9.4 Defensa de plataforma

Configurar CSP, HSTS en producción, anti-clickjacking, nosniff, política de referencias, rate limits y logs estructurados sin datos sensibles.

---

## 10. Precio, solicitudes y cotizaciones

### 10.1 Visibilidad

| Perfil | Explora | Solicita | Ve precio |
|---|---|---|---|
| Visitante | Sí | Sí | No |
| Cliente aprobado | Sí | Sí | Según nivel |
| Empresa/mayoreo/distribuidor | Sí | Sí | Según regla |
| Interno autorizado | Sí | Sí | Según permiso |

Una API pública nunca contiene costos, márgenes, reglas ni precios privados, aunque la interfaz no los enseñe.

### 10.2 Motor de precio

El cálculo existe sólo en el servidor:

~~~text
costo de oferta
→ margen del nivel
→ regla de categoría o producto
→ regla de proyecto
→ excepción individual
→ redondeo
→ impuestos
→ envío, instalación o maniobras
→ vigencia y aprobación
~~~

Precedencia:

~~~text
precio individual
> regla de proyecto
> regla de producto/categoría
> nivel comercial
> margen predeterminado
~~~

### 10.3 Estados

~~~text
BORRADOR
SOLICITADA
EN_REVISION
ESPERANDO_PROVEEDOR
AJUSTE_REQUERIDO
APROBADA
ACEPTADA
ESPERANDO_PAGO
PAGO_EN_REVISION
PAGADA
ORDENADA
ENVIADA
ENTREGADA
CERRADA
CANCELADA
~~~

Las transiciones viven en una sola política de dominio. Ningún endpoint puede modificar el estado libremente.

### 10.4 Pagos

Tarjetas no entran en V1. Transferencias futuras requieren comprobante, revisión manual y confirmación. Cuando haya proveedor de pago, se implementa detrás de una interfaz con createPayment, getStatus, processWebhook, refund y reconcile. Webhooks verifican firma, idempotencia y monto.

---

## 11. Administración

El panel vive bajo /admin, no se indexa, exige sesión, permiso y 2FA cuando corresponda. No se incluye en el bundle público.

### Etapa administrativa inicial

- Dashboard de solicitudes y actividad.
- Proyectos y visibilidad.
- Servicios, páginas y SEO.
- Medios.
- Productos de lectura.
- Usuarios internos mínimos.
- Auditoría.

### Etapa comercial

- Proveedores y ofertas.
- Niveles comerciales.
- Clientes y empresas.
- Cotizaciones y revisiones.
- Pedidos, pagos y documentos.

Toda acción destructiva solicita confirmación contextual. Tablas grandes se paginan en servidor. La administración no reutiliza ASCII decorativo que reduzca legibilidad.

---

## 12. Calidad pública

### SEO

Cada ruta publicada requiere título, descripción, canonical, Open Graph, imagen social cuando aplique, datos estructurados válidos, sitemap, robots y redirección documentada al cambiar slug.

No se indexan filtros vacíos, páginas privadas, resultados internos, duplicados de idioma ni productos sin valor editorial.

### Accesibilidad

Objetivo: WCAG 2.2 AA.

- Contraste AA en ambos temas.
- Teclado completo y foco visible.
- HTML semántico antes que ARIA.
- Campos con etiqueta, ayuda, error asociado y resumen.
- Texto alternativo útil; decoración oculta.
- No depender de color, hover, sonido o movimiento.
- Tamaños táctiles correctos.
- Idioma correcto por página.
- Reduced motion respetado.

### Rendimiento

- Contenido principal visible sin esperar loader o animación.
- Imágenes optimizadas, responsivas y con dimensiones.
- Fuentes con fallbacks y carga adecuada.
- JavaScript sólo donde hay interacción.
- Catálogo paginado por cursor.
- Filtros y búsqueda en servidor e indexados.
- No consultas N+1 en rutas frecuentes.
- Tareas pesadas en worker.

La búsqueda empieza con PostgreSQL full-text e índices trigram. Un motor separado sólo se evalúa con evidencia de necesidad.

### Analítica

Eventos iniciales:

~~~text
service_view
diagnostic_start
diagnostic_submit
catalog_search
product_view
quote_add_item
quote_submit
price_access_request
whatsapp_click
tool_complete
project_view
contact_submit
~~~

Nunca enviar texto libre, contraseñas, RFC, documentos o información privada a analítica.

---

## 13. Migración desde Janvier Shop

### Conservar para auditar

~~~text
data/productos.json       inventario semilla
images/                   imágenes a evaluar
scripts/loader.js         ideas de loader
backend/                  referencia de flujos
historial Git             reversibilidad
~~~

El JSON actual contiene cinco productos de ejemplo. Cada uno requiere revisión de disponibilidad, datos, imagen autorizada, ficha, categoría y condición comercial antes de migrar.

### No migrar tal cual

- HTML, CSS y JavaScript antiguos.
- SQLite como base operativa.
- Tokens Bearer en el navegador.
- Compatibilidad administrativa con file://.
- Credenciales iniciales.
- Endpoints que devuelven precioCompra.
- Subidas sin validación real de tipo.
- Precios estáticos sin perfil, vigencia ni revisión.

### Procedimiento

1. Etiquetar la versión previa.
2. Respaldar SQLite, JSON, imágenes y configuración sin secretos.
3. Definir Prisma y migraciones PostgreSQL.
4. Crear importador idempotente con reporte.
5. Importar en staging y revisar.
6. Publicar sólo productos aprobados.
7. Mantener rollback documentado antes de migrar producción.

---

## 14. Pruebas

### Unitarias

- Validadores Zod.
- Precios y precedencia.
- Estados de cotización.
- Permisos.
- DTO público versus privado.
- Slugs, SEO e idioma/fallback.

### Integración

- Repositorios Prisma con PostgreSQL de prueba.
- Acciones autenticadas.
- Ausencia de filtración de costos.
- Solicitudes.
- Proyectos y privacidad.
- Medios autorizados.

### End-to-end

1. Visitante explora servicios, proyecto y catálogo sin precios.
2. Visitante manda diagnóstico y obtiene confirmación accesible.
3. Propietario inicia sesión y administra proyecto.
4. No autorizado no accede a panel o datos privados.
5. Tema persiste y funciona por teclado.
6. Menú, formulario y 404 funcionan en móvil.

---

## 15. Convención de entregas

Cada PR tiene un objetivo, alcance, pruebas y migración/rollback si modifica datos. No se mezclan refactors masivos, funcionalidades no relacionadas y decisiones sensibles.

Plantilla:

~~~md
## Objetivo

## Alcance

## Fuera de alcance

## Decisiones aplicadas

## Seguridad y privacidad

## Pruebas ejecutadas

## Migración / rollback

## Evidencia visual o funcional
~~~

### Definition of Done

Una tarea termina sólo si:

- cumple su criterio funcional;
- funciona en móvil y escritorio;
- es usable por teclado;
- pasa tipos, lint y pruebas aplicables;
- tiene carga, vacío y error;
- no expone datos sensibles;
- tiene contenido revisado en español;
- cubre SEO y accesibilidad que correspondan;
- actualiza la documentación si cambió una regla.

---

## 16. Secuencia de implementación

### PR 0 — Preservación

- Etiqueta y respaldo de versión anterior.
- Inventario de archivos, datos, imágenes y riesgos.
- Ejecución local documentada.
- Sin cambiar comportamiento público.

### PR 1 — Fundación

- Next.js, TypeScript, lint, formato, Vitest y Playwright.
- PostgreSQL local y Prisma.
- Variables de entorno de ejemplo sin secretos.
- Health check, layout, 404 y error boundary.

### PR 2 — Marca y sistema

- Tokens, fuentes y temas.
- Logo component y espacio para SVG final.
- UI base con teclado.
- Selector de tema sin flash.

### PR 3 — Shell e inicio

- Header, menú móvil, footer y CTA.
- Inicio en español.
- Intención, capacidades, confianza y cierre.
- SEO y analítica no sensible.

### PR 4 — Servicios y contacto

- Estudio, soluciones, contacto y diagnóstico.
- Formularios persistentes.
- Estados accesibles y notificación operativa.

### PR 5 — Administración mínima

- Bootstrap seguro de propietario.
- Sesión, permisos y auditoría.
- Proyectos, slugs y privacidad.

### PR 6 — Catálogo de lectura

- Categoría, producto y medios.
- Importación idempotente de inventario aprobado.
- Búsqueda, filtros y fichas sin precio/costo.
- Solicitud de producto.

### PR 7 — Cotizaciones

- Empresas, niveles, reglas y snapshots.
- Solicitud, revisión, versiones y aceptación.
- PDF y documentos sólo con protección y auditoría.

### PR 8 — Staging

- Accesibilidad, CSP, rate limits y seguridad.
- Backups y restauración probada.
- Rendimiento en móvil.
- Checklist de lanzamiento.

### Después del lanzamiento

- Adaptador de proveedor autorizado.
- Pago desacoplado.
- Laboratorio.
- Idiomas revisados.
- Crédito empresarial con controles legales y operativos definidos.

---

## 17. Despliegue

Entorno previsto:

~~~text
Ubuntu
Nginx
Next.js como servidor Node
PostgreSQL
janvier-web.service
janvier-worker.service
Cloudflare Tunnel
Backups externos cifrados
~~~

El flujo de despliegue es:

~~~text
validar estado limpio
→ respaldo
→ dependencias bloqueadas
→ pruebas
→ build
→ migraciones
→ reiniciar servicios
→ health check
→ verificación funcional
→ registrar resultado
~~~

Un código cero no basta: el health check y rutas críticas deben responder. Hay dump diario de PostgreSQL, respaldo de medios, copia externa cifrada, retención y pruebas periódicas de restauración.

---

## 18. Voz

La voz es directa, clara, competente y personal.

Se prefiere:

~~~text
Cuéntame el problema.
Validamos disponibilidad antes de cobrar.
Puedo acompañarte desde el diagnóstico hasta la implementación.
Los precios dependen de tu perfil comercial.
No encuentras el producto: solicítalo.
~~~

Se evita:

~~~text
Soluciones 360.
Innovación disruptiva.
Somos líderes mundiales.
Tu mejor opción.
Calidad y servicio.
~~~

No se publica texto de relleno.

---

## 19. Checklists

### Página pública

- [ ] Tiene objetivo y CTA.
- [ ] Explica la propuesta en el primer viewport.
- [ ] Funciona en 320 px y escritorio ancho.
- [ ] Tiene title, descripción, canonical y Open Graph.
- [ ] No genera duplicados indexables.
- [ ] Controles por teclado y foco visible.
- [ ] Contraste AA y textos alternativos correctos.
- [ ] Tema night sin colores hardcodeados.
- [ ] Movimiento compatible con reduced motion.
- [ ] Sin datos internos, secretos o scripts innecesarios.
- [ ] Texto revisado en español.

### API o acción de servidor

- [ ] Autenticación según el caso.
- [ ] Autorización por permiso.
- [ ] Validación Zod.
- [ ] Límite y paginación en colecciones.
- [ ] DTO público sin campos internos.
- [ ] Rate limit cuando aplica.
- [ ] Errores seguros.
- [ ] Auditoría para mutaciones.
- [ ] Idempotencia en pagos, webhooks o importaciones.
- [ ] Pruebas razonables.
- [ ] Rollback si modifica datos.

---

## 20. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Marca pública | JANVIER es la marca; Ángel Janvier es fundador y firma humana. |
| Logos | Símbolo JA y lockup Ángel Janvier son activos oficiales de referencia. |
| Español | La raíz es canónica; no hay copia indexable bajo /es. |
| Arquitectura | Next.js, TypeScript, PostgreSQL y Prisma. |
| Catálogo inicial | Público de lectura, sin precios ni costos. |
| Comercio inicial | Solicitud y revisión manual; sin pago automático. |
| Dinero | Decimal, snapshots inmutables y cálculo en servidor. |
| Sesiones | Seguras, sin localStorage ni credenciales por defecto. |
| Idiomas | Español primero; otros sólo revisados. |
| UI | CSS Modules y tokens, sin framework visual genérico. |
| Movimiento | Funcional, no bloqueante y reducido cuando se solicita. |
| Despliegue | Preparado para Ubuntu, Nginx, systemd y Cloudflare Tunnel. |

---

## 21. Decisiones pendientes de Ángel

No bloquean PR 0–3, pero sí su funcionalidad correspondiente:

1. Entregar versiones vectoriales finales y confirmar si el lockup sustituye JANVIER en algún contexto.
2. Validar paleta final junto con logo y fotografía profesional.
3. Confirmar dominio canónico y dominios defensivos.
4. Elegir correo transaccional y canal que recibirá formularios.
5. Revisar privacidad, términos, garantías, devoluciones y condiciones comerciales.
6. Entregar primeros proyectos autorizados, métricas y nivel de confidencialidad.
7. Seleccionar productos reales que sobrevivirán la migración.
8. Confirmar proveedores autorizados, API o feed permitido.
9. Elegir pagos y facturación cuando esa fase comience.
10. Elegir la primera herramienta de laboratorio y validar fórmulas.

---

## 22. Declaración final

JANVIER V2 no se construye como template de tienda ni como portafolio aislado. Cada decisión debe reforzar:

~~~text
entender el problema
→ diagnosticar
→ diseñar
→ desarrollar o suministrar
→ implementar
→ acompañar
~~~

La tecnología debe verse precisa y sentirse humana. La marca puede ser experimental; seguridad, accesibilidad, operación y confianza nunca lo serán.
