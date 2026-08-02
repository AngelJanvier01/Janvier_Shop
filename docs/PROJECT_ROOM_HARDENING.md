# JANVIER / PROJECT_ROOM — endurecimiento V1

Este documento describe el PR mínimo que convierte la propuesta compartida en
evidencia versionada. No incorpora CRM, pagos, PDF/DOCX, notificaciones
generales ni seguimiento operativo del proyecto.

## Flujo y máquina de estados

```text
             compartir + bloquear + invitar
DRAFT ------------------------------------> SENT
  ^                                           |
  | nueva revisión editable                   | primera lectura
  |                                           v
CHANGES_REQUESTED <----------------------- VIEWED
  |                    pedir ajustes          | \
  |                                            |  \ aceptar / rechazar
  | compartir nueva revisión                   |   v
  +------------------------------------------+ ACCEPTED / DECLINED
                                                    terminales

SENT o VIEWED -> EXPIRED
Una revisión compartida posterior marca la revisión compartida anterior
como `replacedAt`; no se modifica su contenido histórico.
```

`lib/proposals/proposal-state.ts` es la única autoridad de transiciones de
`Proposal`. Las acciones sólo aplican el objeto devuelto por
`transitionProposal`. Abrir una invitación sólo ejecuta `SENT -> VIEWED`; una
propuesta `ACCEPTED` o `DECLINED` nunca vuelve a `VIEWED`.

## Cambios de modelo y migración

Migración: `20260802010000_harden_project_room`.

| Modelo               | Cambio                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Proposal`           | `selectedOptionId` y relación de selección; la aceptación sigue siendo una a una.                                                             |
| `ProposalRevision`   | `replacedAt`, conceptos económicos y aceptaciones relacionadas.                                                                               |
| `ProposalOption`     | `isEnabled`, selección y conceptos opcionales relacionados.                                                                                   |
| `ProposalLineItem`   | Concepto facturable con cantidad/precio/descuento/impuesto Decimal y separación estricta de `internalCost`, `markupPercent`, `internalNotes`. |
| `ProposalAcceptance` | Evidencia append-only, única por propuesta: identidad, invitación, revisión, alternativa, totales, términos, snapshot y hash SHA-256.         |
| `ProposalEventType`  | Eventos de propuesta, invitación, selección, comentario, decisión y creación de proyecto con nombres explícitos.                              |

Las claves foráneas de `ProposalAcceptance` son `RESTRICT`; la aplicación no
expone operaciones de actualización ni borrado de aceptaciones. La unicidad de
`proposalId` protege la doble aceptación incluso ante solicitudes concurrentes.

## Compartir, aceptar y crear proyecto

1. Crear desde administración genera `DRAFT` con revisión editable y evento
   `PROPOSAL_CREATED`; todavía no existe enlace ni invitación.
2. Compartir valida que haya contenido incluido, bloquea la revisión, marca
   `SENT`, revoca accesos activos previos, crea una invitación de un solo uso
   operacional y registra `REVISION_SHARED` / `INVITE_CREATED`.
3. El cliente puede elegir una única alternativa habilitada de esa revisión.
   La selección se audita como `OPTION_SELECTED`, pero no cambia el estado.
4. Aceptar exige nombre, correo autorizado, cargo, términos y código. La
   transacción vuelve a verificar invitación, estado y alternativa antes de
   construir la evidencia; después bloquea, revoca invitaciones activas,
   cambia a `ACCEPTED` y crea un `Project` en `DRAFT` sólo si aún no existe.
5. La creación automática se registra en `PROJECT_CREATED`; activar el
   proyecto sigue siendo una decisión manual posterior.

Las operaciones críticas revalidan dentro de una transacción PostgreSQL. Así,
una selección o una rotación que empezó antes de una aceptación no puede
completar contra un estado ya terminal.

## Snapshot canónico de aceptación

El servidor construye el JSON visible con Decimal y orden estable, lo serializa
de forma canónica y guarda `SHA-256(canonicalJson(snapshot))`. Ejemplo
abreviado:

```json
{
  "alternative": { "code": "BASE", "title": "Implementación base" },
  "currency": "MXN",
  "lineItems": [
    {
      "code": "IMPL-01",
      "description": "Implementación base",
      "quantity": "2.000",
      "unitPrice": "100.00",
      "discount": "10.00",
      "taxRate": "16.0000",
      "type": "ONE_TIME"
    }
  ],
  "revision": 1,
  "sections": [{ "position": 1, "title": "Alcance", "content": "…" }],
  "terms": "Vigencia y condiciones.",
  "totals": { "subtotal": "190.00", "tax": "30.40", "total": "220.40" }
}
```

El snapshot y el RSC público seleccionan explícitamente sólo los campos
permitidos. `internalCost`, `markupPercent` e `internalNotes` no se serializan,
no se muestran en Project Room y no se incluyen en metadata pública.

## Verificación y límites de la V1

`developmentInviteCodeVerification` implementa un adaptador de verificación
con el código de invitación ya hasheado. No se presenta como firma electrónica
avanzada. Un proveedor de correo/SMS o un mecanismo legal puede sustituir el
adaptador sin alterar el flujo de aceptación.

## Pruebas

- Unitarias: tabla completa de transiciones válidas e inválidas, protección de
  terminales, cálculo Decimal, hash canónico y ausencia de datos internos.
- Integración Playwright opcional (`PROJECT_ROOM_E2E=1`): borrador real,
  selección obligatoria, aceptación/snapshot/proyecto, rechazo terminal,
  aislamiento A/B, expiración, revocación, cinco intentos erróneos y rotación
  de invitación.

## Riesgos que permanecen deliberadamente fuera del PR

- No hay firma electrónica certificada ni identidad corporativa verificada.
- `EXPIRED` se soporta en la máquina de estados; una tarea programada de
  expiración y alertas pertenece a una fase posterior.
- El snapshot es evidencia de la aplicación: los administradores con acceso
  directo privilegiado a PostgreSQL siguen siendo una frontera de confianza.
- Adjuntos privados, generación de PDF, CRM, cobro y flujo de proyecto quedan
  fuera de este cambio.
