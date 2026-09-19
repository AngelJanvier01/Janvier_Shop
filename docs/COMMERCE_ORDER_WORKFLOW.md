# Flujo comercial de Suministro

Fecha de corte: 19 de septiembre de 2026.

Este documento describe el flujo B2B que ya existe en la aplicacion. No guarda
credenciales ni activa cobros.

## Recorrido del cliente

```text
Solicitud de cuenta -> correo verificado -> revision administrativa -> acceso aprobado
Catalogo con precio de cuenta -> lista activa -> solicitud de cotizacion
Cotizacion con snapshot -> solicitud de pedido -> validacion administrativa -> PDF privado
```

1. El cliente completa el registro y verifica su correo.
2. Un administrador aprueba la cuenta y define su lista y descuento comercial.
3. El cliente ve precios calculados para esa cuenta, agrega partidas a su lista y
   solicita una cotizacion.
4. La solicitud conserva nombre, SKU, marca, descuento, precio con IVA,
   existencia y fecha de cada partida; cambios posteriores de catalogo no
   reescriben el historial.
5. Desde una cotizacion, el cliente puede crear un pedido `REQUESTED`. Esto es
   una intencion de compra, nunca un cargo ni una reserva de inventario.
6. El equipo revisa el pedido en `/admin/pedidos` y mueve su estado:
   `REQUESTED`, `REVIEWING`, `CONFIRMED`, `FULFILLED` o `CANCELLED`.
7. Cliente y administrador pueden descargar un PDF privado del pedido. El PDF
   se autoriza por sesion y por cuenta; nunca se indexa ni se guarda en cache.

## Operacion administrativa

- `/admin/clientes`: valida la cuenta y su condicion comercial.
- `/admin/solicitudes`: atiende solicitudes de cotizacion.
- `/admin/pedidos`: busca por referencia, empresa, contacto, correo, SKU o
  producto; filtra por estado y pagina de 25 en 25.
- Las notas de cliente se muestran al equipo. Las notas administrativas quedan
  solo en administracion y no se incluyen en el portal ni PDF del cliente.
- Un `EDITOR` no puede modificar pedidos. Solo `OWNER` y `ADMIN` pueden cambiar
  el estado.

## Avisos de correo

Al configurar `CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL`, la aplicacion envia los
avisos despues de responder la accion al usuario; un proveedor lento no
retrasa la cotizacion ni el pedido.

Plantillas emitidas:

- `customer-email-verification`
- `customer-account-approved`, `customer-account-rejected`,
  `customer-account-suspended`
- `customer-quote-received`
- `customer-order-received`
- `customer-order-status-updated`

Los payloads incluyen solamente los campos necesarios para la plantilla:
`template`, `to`, `verificationUrl` cuando aplica, `accountUrl`, `companyName`,
`reference` y `status` cuando aplica. El secreto del webhook viaja unicamente
del servidor al proveedor como `Authorization: Bearer ...`.

## Despliegue

La migracion `20260919050000_commerce_order_workflow` debe aplicarse junto con
el despliegue:

```powershell
npm run prisma:deploy
npm run prisma:generate
npm run build
```

Realiza un respaldo de PostgreSQL antes de migrar produccion. Configura la URL
del webhook y su secreto en el gestor de secretos, no en el repositorio.

## Lo que permanece intencionalmente apagado

No hay checkout, cobro con Mercado Pago, SPEI, reserva automatica de inventario,
facturacion ni captura de datos de pago. Antes de activar cualquiera de esos
pasos se deben definir conciliacion, impuestos, cargos por envio, ventanas de
vigencia, cancelaciones, privacidad, antifraude y manejo de pagos fallidos.
