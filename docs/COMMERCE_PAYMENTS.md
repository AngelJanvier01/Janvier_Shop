# Cobros profesionales: Mercado Pago y SPEI

Este módulo hace que el pedido confirmado sea la fuente comercial de verdad. El
catálogo, el navegador y el formulario de tarjeta **no** pueden fijar un importe,
confirmar un pago ni modificar una cotización ya emitida.

## Lo que ya está listo

- Checkout de tarjeta embebido con el `CardPayment` Brick oficial de Mercado Pago.
- Creación y lectura de órdenes Mercado Pago exclusivamente desde servidor, con
  referencia propia e `X-Idempotency-Key` por intento.
- Webhook autenticado: valida la firma, deduplica entregas y consulta la orden a
  Mercado Pago antes de cambiar el estado local.
- Bitácora inmutable de intentos, cambios de estado, orden del proveedor y eventos
  de webhook. Nunca se guardan PAN, CVV ni el token temporal de tarjeta.
- Transferencia SPEI: descuento configurable, banco/cuenta/CLABE administrable,
  documento PDF con versión financiera congelada, SHA-256, comprobante privado y
  conciliación manual por administración.
- Expiración automática de cotizaciones SPEI; el trabajador corre cada minuto y
  cada transición queda registrada.
- Cliente: `/suministro/pagos/<referencia>`.
- Administración: `/admin/pagos` y `/admin/ajustes/pagos`.

## Variables seguras

Añade las siguientes variables **solamente al entorno del servicio web**. Nunca
las coloques en `NEXT_PUBLIC_*`, repositorio, logs, capturas ni en un formulario
del administrador:

```dotenv
MP_CREDENTIALS_ENVIRONMENT="sandbox"
MP_SANDBOX_PUBLIC_KEY=""
MP_SANDBOX_ACCESS_TOKEN=""
MP_SANDBOX_WEBHOOK_SECRET=""
MP_PRODUCTION_PUBLIC_KEY=""
MP_PRODUCTION_ACCESS_TOKEN=""
MP_PRODUCTION_WEBHOOK_SECRET=""
```

Completa exclusivamente el juego que corresponda a
`MP_CREDENTIALS_ENVIRONMENT`. La clave pública seleccionada llega únicamente al Brick
dentro de la sesión autenticada; el Access Token y el secreto permanecen del lado
servidor. Compose restringe ambos juegos al servicio `web`; el worker de expiración, el
scraper, las imágenes y el E2E no los reciben.

Primero usa las credenciales y usuarios de prueba de Mercado Pago. La API de
Orders no cambia de URL entre pruebas y producción; el entorno efectivo lo
determinan las credenciales, usuarios y tarjetas de prueba configurados en
Mercado Pago. La casilla **MODO DE PRUEBA / SANDBOX** debe coincidir con
`MP_CREDENTIALS_ENVIRONMENT`; el checkout se cierra si difieren. El arranque también se
detiene si hay credenciales de ambos entornos o falta una pieza del juego seleccionado.

## Activación de Mercado Pago

1. Ejecuta `npm run prisma:deploy` en staging/producción y despliega el servicio
   web junto con `payment-expiration-worker`.
2. Configura el entorno y sus tres variables en el gestor de secretos y reinicia
   únicamente el servicio `web`.
3. En Mercado Pago registra el webhook público HTTPS:
   `https://TU-DOMINIO/api/webhooks/mercado-pago`.
   Suscríbelo a eventos de órdenes y copia el secreto de firma como
   `MP_SANDBOX_WEBHOOK_SECRET` o `MP_PRODUCTION_WEBHOOK_SECRET`.
4. En `/admin/ajustes/pagos`, confirma que los tres indicadores estén en
   **CONFIGURADA** y **PREPARADO**. Activa primero _HABILITAR COBROS_ y después
   _OFRECER MERCADO PAGO_.
5. Prueba con un cliente aprobado, un pedido `CONFIRMED` y una tarjeta de prueba.
   Revisa el intento, su referencia, estado y webhook en `/admin/pagos`.
6. Para producción, vacía por completo `MP_SANDBOX_*`, completa `MP_PRODUCTION_*`,
   cambia el entorno a `production` y desmarca sandbox en la misma ventana controlada.

La app siempre realiza una consulta servidor-a-servidor de
`GET /v1/orders/<id>` antes de mostrar una aprobación; una respuesta del navegador
no es suficiente. Si la creación remota se logra pero falla esa consulta, el ID
de Mercado Pago ya queda persistido para que el webhook termine la conciliación.

## Operación SPEI

1. En `/admin/ajustes/pagos` registra al menos una cuenta activa con banco,
   beneficiario y CLABE de 18 dígitos o número de cuenta.
2. Configura descuento, vigencia, datos del emisor y términos. Activa
   _HABILITAR COBROS_ y _OFRECER TRANSFERENCIA SPEI_.
3. El cliente genera la cotización desde su pedido confirmado. Se capturan los
   productos, cantidades, precios con IVA, descuento, total, banco, vendedor y
   fecha de vencimiento en una versión inmutable.
4. El PDF se guarda de forma privada con SHA-256. No se regenera sobre una
   cotización existente ni se expone desde `public/`.
5. El cliente adjunta su comprobante y lo marca como reportado. Esto sólo lo deja
   **PENDIENTE**: un administrador debe revisarlo en `/admin/pagos` y confirmar o
   rechazar. La confirmación cambia el pedido a `PAID`.

Las cuentas bancarias se desactivan, no se eliminan; cada PDF conserva el snapshot
de los datos vigentes al momento de emitirse. Los comprobantes se validan por
tipo, firma/magic bytes, tamaño y autorización antes de guardarse en el volumen
privado de propuestas.

El worker se ejecuta como `npm run payments:expire-spei`; para comprobarlo una
sola vez: `npm run payments:expire-spei:once`. Compose lo mantiene activo en
producción. También puede programarse ese segundo comando cada minuto desde el
orquestador si no se usa Compose.

## Estados, stock y reembolsos

`UNPAID`, `AWAITING_PAYMENT`, `PENDING`, `PAID`, `REJECTED`,
`PARTIALLY_REFUNDED`, `REFUNDED` y `CHARGED_BACK` se derivan del ledger de
intentos y se muestran en pedido,
cliente y administración. El pago no descuenta ni reserva existencias del
proveedor por sí mismo: la existencia sincronizada sigue requiriendo validación
operativa al confirmar el pedido. Esto evita prometer un artículo cuyo inventario
externo haya cambiado; una reserva propia debe implementarse como flujo separado
cuando se defina la política de almacén.

Los campos soportan reembolso y contracargo para la trazabilidad. Esta primera
entrega **no ejecuta reembolsos de Mercado Pago ni transferencias salientes**:
se realiza el procedimiento financiero autorizado fuera de la web y se registra
el resultado en el ledger administrativo. No se habilitó una acción irreversible
sin una política y permisos de reembolso aprobados.

## Validación antes de abrir venta

```powershell
npm run prisma:deploy
npm run typecheck
npm run lint
npm run format
npm test
npx playwright test tests/e2e/payment-checkout.spec.ts --reporter=line
```

Ensaya los casos: tarjeta aprobada, rechazada, pendiente, reintento de webhook,
orden cancelada, orden vencida, reembolso parcial/total, webhook con firma
inválida, SPEI vencido, comprobante inválido, rechazo de
comprobante y doble confirmación. Confirma también que una cuenta no pueda abrir
los PDF o comprobantes de otra cuenta.

## Referencias oficiales

- [Orders API / crear orden](https://www.mercadopago.com.mx/developers/es/reference/online-payments/checkout-api/create-order/post)
- [Checkout Bricks: Card Payment](https://www.mercadopago.com.mx/developers/es/docs/checkout-api-orders/payment-integration/cards)
- [Inicialización de Checkout Bricks](https://www.mercadopago.com.mx/developers/es/docs/checkout-bricks/common-initialization)
- [Notificaciones Webhook](https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/optional-notifications)
