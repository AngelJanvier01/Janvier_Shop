# JANVIER — Client Proposal Room

## Propósito

Entregar propuestas de proyecto como una experiencia privada, clara y viva; no
como un PDF aislado. Cada propuesta debe explicar el criterio, alcance,
inversión, proceso y siguiente decisión con el mismo cuidado que JANVIER pone
en una implementación.

Nombre visible propuesto:

```text
JANVIER / PROJECT_ROOM
PROPUESTA_024
```

El PDF puede existir como una instantánea descargable para archivo, pero nunca
será la experiencia principal.

## Experiencia del cliente

Una propuesta privada contiene:

1. Contexto y objetivo acordados.
2. Alcance modular: qué sí incluye y qué queda fuera.
3. Alternativas o niveles, cuando aplique.
4. Entregables, responsables y dependencias del cliente.
5. Fases, calendario y puntos de revisión.
6. Inversión, vigencia, impuestos y condiciones.
7. Evidencia, referencias o casos relacionados cuando estén autorizados.
8. Área de preguntas y solicitud de ajustes.
9. Acción explícita para aceptar, pedir cambios o agendar una conversación.
10. Historial de revisiones, para evitar negociar sobre versiones ambiguas.

La experiencia debe sentirse editorial y técnica: progreso visible, estados
claros, información densa donde ayuda a decidir y espacio suficiente para leer.
No debe convertirse en un checkout ni en un dashboard corporativo genérico.

## Flujo propuesto

```text
BORRADOR
  → revisión interna
  → enlace privado enviado
  → cliente revisa / comenta
  → ajuste o aceptación
  → propuesta bloqueada
  → proyecto, cotización o pedido creado
```

Cada modificación crea una revisión nueva. Una propuesta aceptada conserva la
revisión exacta que el cliente vio; no se edita retroactivamente.

## Acceso V1 recomendado

Usar un enlace privado con token opaco de alta entropía y un código de acceso
corto. No exigir una cuenta al cliente para abrir una primera propuesta.

Esto reduce fricción comercial sin exponer información sensible. La cuenta de
cliente llegará después, cuando existan pedidos, documentos, soporte e historial
recurrente.

Reglas:

- URL sin folios secuenciales ni datos del cliente.
- Token almacenado sólo como hash y con fecha de expiración.
- Código de acceso limitado por intentos y con rate limiting.
- Rutas `noindex`, sin caché compartida y fuera del sitemap.
- Datos, precios y archivos autorizados únicamente en servidor.
- Al aceptar: registro de fecha, revisión, nombre confirmado y auditoría.
- La aceptación V1 es una confirmación comercial; una firma electrónica formal
  requiere decisión legal y proveedor específico antes de prometerla.

## Modelo de datos inicial

```text
Client
Proposal
ProposalRevision
ProposalSection
ProposalOption
ProposalInvite
ProposalComment
ProposalDecision
AuditLog
```

Relaciones clave:

- `Proposal` pertenece a un cliente y puede enlazarse a un proyecto o una
  cotización.
- `ProposalRevision` es inmutable cuando se comparte.
- `ProposalInvite` controla acceso, expiración y revocación.
- `ProposalDecision` registra aceptar, pedir ajuste o rechazar.
- `AuditLog` registra creación, envío, lectura, comentario y decisión sin
  guardar secretos en texto plano.

## Superficies

### Administración privada

- Crear propuesta desde una oportunidad o proyecto.
- Construir secciones, importes, alternativas y condiciones.
- Vista previa idéntica a la del cliente.
- Crear, reenviar, revocar y vencer invitaciones.
- Duplicar una revisión sin alterar la anterior.
- Ver estado: borrador, enviada, vista, con comentarios, aceptada, vencida o
  reemplazada.

### Vista de cliente

Ruta final orientativa:

```text
/propuesta/[token]
```

Debe incluir etiqueta de estado, fecha de vigencia y una acción persistente para
aceptar o solicitar un ajuste. El cliente nunca debe ver controles internos,
otras propuestas ni precios ajenos.

## Fuera de alcance inicial

- Cobro automático.
- Firma electrónica con validez jurídica certificada.
- Portal completo de cuenta, pedidos y soporte.
- PDF como formato principal.
- Compartición pública o indexación.

## Criterios de aceptación

- Una propuesta se puede crear, previsualizar y compartir de forma segura.
- El cliente puede leerla en móvil y escritorio sin descargar nada.
- Aceptar o pedir cambios queda registrado contra una revisión concreta.
- No hay exposición de propuestas por enumeración de URLs.
- El enlace se puede vencer o revocar.
- La experiencia conserva contraste AA, reduced-motion y ritmo visual JANVIER.
- La exportación PDF, si se añade, reproduce la revisión aceptada y no reemplaza
  la experiencia web.

## Orden de implementación

1. Modelos PostgreSQL, migración y auditoría.
2. Administración autenticada mínima para crear borradores.
3. Renderizador de propuesta privada y sistema de invitaciones.
4. Comentarios, decisiones y bloqueo de revisión.
5. Conversión a proyecto/cotización y PDF de archivo.
6. Portal de cliente completo cuando existan operaciones recurrentes.
