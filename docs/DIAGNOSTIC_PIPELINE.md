# Pipeline privado de diagnósticos

El formulario público de contacto de JANVIER registra una solicitud privada antes de ofrecer continuar por WhatsApp. El objetivo es conservar el contexto comercial y convertir sólo los diagnósticos que realmente ameritan una propuesta.

## Recorrido

```text
/contacto o /diagnostico
  -> DiagnosticRequest (NEW)
  -> /admin/diagnosticos
  -> CONTACTED / QUALIFIED / PROPOSAL / WON / LOST / ARCHIVED
  -> propuesta DRAFT vinculada, cuando procede
```

La conversión crea o reutiliza un cliente por correo electrónico y genera una propuesta en borrador con una revisión inicial y una sección de contexto. No comparte ni publica información: el acceso continúa protegido por la sesión de administración.

## Datos y protección

- Se guardan nombre, organización opcional, correo, teléfono opcional, necesidad, horizonte, inversión estimada opcional y contexto.
- Las notas del panel son privadas. No se muestran en el sitio público ni en Project Room.
- Se conserva una huella SHA-256 de la dirección de red para limitar abuso; la dirección IP literal no se persiste.
- El formulario tiene un honeypot y límites de tres solicitudes por huella en una hora y tres por correo en veinticuatro horas.
- WhatsApp es un siguiente paso explícito: no sustituye el registro ni envía el formulario automáticamente a terceros.

## Operación

Revisar `/admin/diagnosticos` durante la jornada. Marcar `CONTACTED` al responder, `QUALIFIED` al confirmar que conviene preparar alcance y usar **Crear propuesta** una sola vez. La operación es idempotente: si ya existe un borrador, el panel abre el vínculo existente.

`WON`, `LOST` y `ARCHIVED` son estados de cierre. Una solicitud cerrada no puede crear propuestas hasta que se recupere manualmente desde el selector de estado.

## Límites deliberados de este sprint

No hay notificaciones por correo, proveedor de analítica, automatización CRM, pagos ni firma electrónica. Requieren credenciales, consentimiento y políticas comerciales que deben decidirse antes de integrar un proveedor externo. El pipeline actual funciona de forma privada y manual sin depender de ellos.

## Verificación

- `tests/unit/diagnostic-request.test.ts` valida el esquema, la URL de WhatsApp y la huella no reversible.
- `tests/e2e/contact-form.spec.ts` prueba el formulario público y confirma que el registro se guarda.
- `tests/e2e/diagnostic-pipeline.spec.ts` prueba la calificación y conversión administrativa. Se ejecuta explícitamente con `DIAGNOSTIC_E2E=1` y PostgreSQL local disponible.
