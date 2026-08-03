import "dotenv/config";

import { readFile } from "node:fs/promises";

import sharp from "sharp";

import { database } from "../../lib/database";
import { uploadPrivateProposalAsset } from "../../lib/proposals/assets";
import { persistMarkdownDraft, analyzeMarkdownDraft } from "../../lib/proposals/markdown/drafts";

const demoReference = "DEMO-NEXO-OPERATIVO-84";

function requiredArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Falta ${name}. Ejemplo: ${name} C:\\ruta\\imagen.png`);
  }
  return value;
}

async function prepareDemoImage(path: string) {
  const original = await readFile(path);
  return sharp(original)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .jpeg({ mozjpeg: true, quality: 88 })
    .toBuffer();
}

function demoMarkdown() {
  return `---
language: es
subtitle: Propuesta de demostración completa · editable antes de compartir.
author: JANVIER
tags:
  - demo
  - operaciones
  - sistema
template: janvier-complete-demo
theme: night
---

# Sistema Nexo Operativo

**Propuesta DEMO — no enviar a cliente.** Preparada para **Nexo Operativo S.A. de C.V.** como ejemplo completo del documento que JANVIER puede entregar.

## Resumen ejecutivo {#summary type=EXECUTIVE_SUMMARY}

Nexo Operativo necesita convertir tareas dispersas, reportes manuales y decisiones sin trazabilidad en un sistema claro de operación. La propuesta crea una ruta corta: entender el flujo actual, diseñar la interfaz correcta, implementar el núcleo y transferir la capacidad al equipo.

:::janvier-callout
type: signal
title: Decisión requerida

Autorizar la fase de descubrimiento permite congelar el alcance con evidencia antes de comprometer desarrollo, presupuesto o fechas definitivas.
:::

## Contexto {#context type=CONTEXT}

El equipo opera con información distribuida entre mensajes, hojas de cálculo y memoria individual. Hay atención al cliente, coordinación de campo y seguimiento de incidencias, pero no existe una vista común que permita priorizar y medir el trabajo.

> La oportunidad no es “digitalizar por digitalizar”: es hacer visible el trabajo crítico, reducir retrabajo y crear una operación que el equipo pueda sostener.

## Objetivos {#objectives type=OBJECTIVES}

- [x] Mapear el recorrido actual de una solicitud, desde la entrada hasta el cierre.
- [ ] Definir la interfaz operativa mínima para coordinadores y personal de campo.
- [ ] Implementar estados, responsables, alertas y evidencia de cierre.
- [ ] Medir tiempo de respuesta, cumplimiento y trabajo pendiente durante el piloto.

## Principios de solución {#solution type=SOLUTION}

La solución se construye como un **núcleo operativo**, no como una colección de pantallas. Cada movimiento deja contexto, responsable, fecha y siguiente acción. Las integraciones se validan con datos de prueba antes de entrar en producción.



\`\`\`ts
const operatingRule = {
  event: "solicitud creada",
  owner: "coordinación",
  nextState: "clasificación"
};
\`\`\`

## Referencia de sistema {#system-reference type=ARCHITECTURE}

![Vista editorial del sistema Nexo Operativo](asset:nexo-system "Composición editorial de módulos operativos sobre una retícula técnica")

La referencia visual representa los módulos que deben poder trabajar como una sola operación: entrada, decisión, ejecución, evidencia y seguimiento.

:::janvier-metrics

label: Tiempo de primera respuesta
value: 12 h → meta 4 h

label: Solicitudes trazables
value: 100 %

label: Riesgo de adopción
value: Medio · mitigable con piloto
:::

## Arquitectura de flujo {#architecture type=ARCHITECTURE}

![Mapa técnico de proceso con módulos conectados](asset:operation-map "Mapa visual de los flujos y módulos del sistema operativo")

| Módulo | Responsabilidad | Evidencia |
| --- | --- | --- |
| Entrada | Registrar la solicitud con contexto mínimo | Folio y responsable |
| Orquestación | Priorizar, asignar y alertar | Estado y bitácora |
| Ejecución | Resolver la actividad en campo o escritorio | Registro de trabajo |
| Cierre | Confirmar resultado con el solicitante | Evidencia y siguiente paso |

:::janvier-ascii
INPUT: REQUEST
ROUTE: TRIAGE -> OWNER -> ACTION
OUTPUT: VERIFIED_CLOSURE
SYSTEM_READY = 1
:::

## Alcance y entregables {#scope type=SCOPE}

1. Diagnóstico operativo con entrevistas y mapa de decisiones.
2. Prototipo navegable de los flujos prioritarios.
3. Implementación del núcleo y una integración prioritaria.
4. Pruebas con escenario real, transferencia y plan de continuidad.

**Incluye:** sesiones de trabajo, tablero de decisiones, ambientes de prueba, manual breve y acompañamiento de arranque.

**No incluye:** compra de licencias de terceros, operación 24/7, captura histórica masiva ni integraciones no validadas durante descubrimiento.

## Alternativas {#alternatives type=ALTERNATIVES}

{{proposal.options}}

## Cronograma {#timeline type=TIMELINE}

{{proposal.timeline}}

{{proposal.paymentSchedule}}

:::janvier-page-break
:::

## Inversión {#investment type=INVESTMENT}

{{proposal.lineItems}}

{{proposal.totals}}

## Condiciones comerciales {#terms type=TERMS}

- Vigencia de esta propuesta: **{{proposal.validUntil}}**.
- Moneda de referencia: **{{proposal.currency}}**.
- Forma de pago: **{{proposal.paymentTermsSummary}}**.
- Entrega y soporte: **{{proposal.deliveryTerms}}**.
- Garantía: **{{proposal.warrantySummary}}**.

Los importes no incluyen cambios de alcance posteriores a la fase de descubrimiento. Cualquier decisión que altere integraciones, usuarios, sedes o disponibilidad se registra como ajuste de alcance antes de ejecutarse.

## Preguntas frecuentes {#faq type=FAQ}

### ¿Qué necesitamos de Nexo antes de comenzar?

Una persona responsable con disponibilidad semanal, acceso al flujo actual y capacidad de validar decisiones operativas. JANVIER no necesita documentación perfecta: necesita el recorrido real.

### ¿Qué pasa si el alcance cambia durante el piloto?

Se documenta el impacto, se prioriza con el equipo y, si altera la inversión o el calendario, se emite una revisión nueva. Nada se “absorbe” silenciosamente.

### ¿Quién conserva el conocimiento después de la entrega?

El equipo cliente recibe un mapa de operación, criterios de decisión, bitácora de acuerdos y sesión de transferencia para operar el sistema sin depender de una sola persona.

## Siguiente paso {#next-steps type=NEXT_STEPS}

:::janvier-decision
title: Confirmar la ruta de trabajo

Selecciona la alternativa que conviene revisar. Puedes aprobarla, solicitar ajustes o dejar comentarios en el Project Room cuando esta demostración se comparta.
:::

## Notas internas {#internal-notes type=REFERENCE internal=true}

:::janvier-internal

DEMO: los costos, fechas, cliente e importes son ficticios. Esta sección prueba el aislamiento entre contenido administrativo y lo que verá un cliente.
:::
`;
}

async function main() {
  const coverPath = requiredArgument("--cover");
  const mapPath = requiredArgument("--map");
  const resetExisting = process.argv.includes("--reset");
  const existing = await database.proposal.findUnique({
    include: { revisions: { select: { id: true }, take: 1 } },
    where: { reference: demoReference }
  });
  if (existing) {
    if (resetExisting) {
      await database.proposal.delete({ where: { id: existing.id } });
      console.log(`Se reiniciÃ³ la propuesta demo ${demoReference}.`);
    } else {
    const revision = await database.proposalRevision.findFirst({
      include: {
        assets: { where: { removedAt: null } },
        lineItems: true,
        markdownSource: true,
        options: true,
        paymentStages: true,
        timelinePhases: true
      },
      where: { proposalId: existing.id }
    });
    console.log(
      JSON.stringify({
        alternatives: revision?.options.length ?? 0,
        assets: revision?.assets.map((asset) => asset.alias) ?? [],
        lineItems: revision?.lineItems.length ?? 0,
        markdownStatus: revision?.markdownSource?.parseStatus ?? null,
        paymentStages: revision?.paymentStages.length ?? 0,
        proposalId: existing.id,
        reference: demoReference,
        status: "already-exists",
        timelinePhases: revision?.timelinePhases.length ?? 0
      })
    );
    return;
    }
  }

  const admin = await database.adminUser.findFirst({
    orderBy: { createdAt: "asc" },
    where: { isActive: true }
  });
  if (!admin) {
    throw new Error("No hay un administrador activo para crear la propuesta demo.");
  }

  const clientEmail = "demo.nexo@janvier.example";
  const client =
    (await database.client.findFirst({ where: { email: clientEmail } })) ??
    (await database.client.create({
      data: {
        companyName: "Nexo Operativo S.A. de C.V.",
        contactName: "Mariana Torres",
        email: clientEmail,
        notes: "Cliente ficticio para demostración interna."
      }
    }));

  const proposal = await database.proposal.create({
    data: {
      clientId: client.id,
      currency: "MXN",
      ownerId: admin.id,
      reference: demoReference,
      status: "DRAFT",
      title: "Sistema Nexo Operativo · DEMO"
    }
  });
  const revision = await database.proposalRevision.create({
    data: {
      authorId: admin.id,
      currency: "MXN",
      deliveryTerms:
        "Implementación remota con sesiones semanales; arranque sujeto a la confirmación del anticipo.",
      introduction:
        "Demostración integral de una propuesta JANVIER con documento, activos privados y datos comerciales.",
      paymentTermsSummary: "40 % al aceptar · 40 % al terminar el piloto · 20 % al cierre.",
      proposalId: proposal.id,
      revision: 1,
      supportSummary:
        "Acompañamiento semanal durante el piloto y 30 días de estabilización posterior.",
      taxDisplayMode: "EXCLUSIVE",
      terms:
        "Los datos y montos de esta revisión son únicamente demostrativos.",
      title: proposal.title,
      validUntil: new Date("2026-09-30T00:00:00.000Z"),
      warrantySummary:
        "Corrección de defectos reproducibles del alcance aprobado durante 30 días posteriores a la entrega."
    }
  });

  const markdown = demoMarkdown();
  const analyzed = analyzeMarkdownDraft(markdown);
  if (analyzed.status === "ERROR") {
    throw new Error(`La propuesta demo no pasó el parser: ${JSON.stringify(analyzed.diagnostics)}`);
  }
  await persistMarkdownDraft(revision.id, admin.id, {
    expectedSourceHash: null,
    expectedVersion: null,
    originalFileName: "nexo-operativo-demo.md",
    reason: "IMPORT",
    sourceHash: analyzed.sourceHash,
    sourceMarkdown: analyzed.normalizedSource
  });

  const [cover, map] = await Promise.all([prepareDemoImage(coverPath), prepareDemoImage(mapPath)]);
  await uploadPrivateProposalAsset({
    alias: "nexo-system",
    altText: "Módulos operativos conectados sobre una composición técnica.",
    bytes: cover,
    declaredMimeType: "image/jpeg",
    isDecorative: false,
    isRequired: true,
    originalFileName: "nexo-system-demo.jpg",
    revisionId: revision.id,
    uploadedByAdminId: admin.id
  });
  await uploadPrivateProposalAsset({
    alias: "operation-map",
    altText: "Mapa técnico de flujo con módulos operativos conectados.",
    bytes: map,
    declaredMimeType: "image/jpeg",
    isDecorative: false,
    isRequired: true,
    originalFileName: "operation-map-demo.jpg",
    revisionId: revision.id,
    uploadedByAdminId: admin.id
  });

  await database.$transaction(async (transaction) => {
    const [core, integral, continuity] = await Promise.all([
      transaction.proposalOption.create({
        data: {
          code: "CORE",
          conditionsSummary: "Una operación prioritaria, una integración y un piloto controlado.",
          description: "Núcleo operativo para la prioridad más urgente.",
          estimatedDuration: "6 semanas",
          investment: "78000",
          isActive: true,
          isEnabled: true,
          position: 1,
          recommended: false,
          revisionId: revision.id,
          supportSummary: "30 días de estabilización.",
          taxIncluded: false,
          title: "CORE · resolver lo prioritario"
        }
      }),
      transaction.proposalOption.create({
        data: {
          code: "INTEGRAL",
          conditionsSummary: "Dos flujos prioritarios, integración, piloto y transferencia completa.",
          description: "Sistema operativo completo para conectar entrada, coordinación y cierre.",
          estimatedDuration: "10 semanas",
          investment: "128000",
          isActive: true,
          isEnabled: true,
          position: 2,
          recommended: true,
          revisionId: revision.id,
          supportSummary: "30 días de estabilización y dos sesiones de seguimiento.",
          taxIncluded: false,
          title: "INTEGRAL · sistema operativo recomendado"
        }
      }),
      transaction.proposalOption.create({
        data: {
          code: "CONTINUIDAD",
          conditionsSummary: "Bolsa mensual para evolución posterior al lanzamiento.",
          description: "Acompañamiento para ajustes, medición y nuevas prioridades.",
          estimatedDuration: "Mensual",
          investment: "18000",
          isActive: true,
          isEnabled: true,
          position: 3,
          recommended: false,
          revisionId: revision.id,
          supportSummary: "Prioridad acordada en revisión mensual.",
          taxIncluded: false,
          title: "CONTINUIDAD · evolución mensual"
        }
      })
    ]);

    await transaction.proposalLineItem.createMany({
      data: [
        {
          billingType: "ONE_TIME",
          code: "DISCOVERY",
          description: "Entrevistas, mapa del flujo actual y decisiones de alcance.",
          discount: "0",
          discountType: "NONE",
          discountValue: "0",
          internalCost: "16000",
          internalNotes: "Incluye preparación y síntesis de hallazgos.",
          isActive: true,
          isIncluded: false,
          isOptional: false,
          isTaxable: true,
          markupPercent: "50",
          name: "Descubrimiento operativo",
          position: 1,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "COMMON",
          selectedByDefault: true,
          taxIncluded: false,
          taxRate: "16",
          type: "ONE_TIME",
          unit: "phase",
          unitPrice: "24000",
          visibleForClient: true,
          visibleToClient: true
        },
        {
          billingType: "ONE_TIME",
          code: "CORE-BUILD",
          description: "Prototipo, interfaz y configuración del flujo prioritario.",
          discount: "0",
          discountType: "NONE",
          discountValue: "0",
          internalCost: "32000",
          internalNotes: "Implementación del flujo base.",
          isActive: true,
          isIncluded: false,
          isOptional: false,
          isTaxable: true,
          markupPercent: "45",
          name: "Implementación CORE",
          optionId: core.id,
          position: 2,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          selectedByDefault: false,
          taxIncluded: false,
          taxRate: "16",
          type: "ONE_TIME",
          unit: "project",
          unitPrice: "54000",
          visibleForClient: true,
          visibleToClient: true
        },
        {
          billingType: "ONE_TIME",
          code: "INTEGRAL-BUILD",
          description: "Dos flujos, integración prioritaria, tablero y transferencia.",
          discount: "5000",
          discountType: "FIXED_AMOUNT",
          discountValue: "5000",
          internalCost: "72000",
          internalNotes: "Integra piloto y transferencia presencial/remota.",
          isActive: true,
          isIncluded: false,
          isOptional: false,
          isTaxable: true,
          markupPercent: "48",
          name: "Implementación INTEGRAL",
          optionId: integral.id,
          position: 3,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          selectedByDefault: true,
          taxIncluded: false,
          taxRate: "16",
          type: "ONE_TIME",
          unit: "project",
          unitPrice: "104000",
          visibleForClient: true,
          visibleToClient: true
        },
        {
          billingType: "MONTHLY",
          code: "CONTINUITY",
          description: "Bolsa mensual de evolución, medición y soporte priorizado.",
          discount: "0",
          discountType: "NONE",
          discountValue: "0",
          internalCost: "12000",
          internalNotes: "No se incluye en el total de una sola vez.",
          isActive: true,
          isIncluded: false,
          isOptional: true,
          isTaxable: true,
          markupPercent: "50",
          name: "Continuidad mensual",
          optionId: continuity.id,
          position: 4,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          selectedByDefault: false,
          taxIncluded: false,
          taxRate: "16",
          type: "MONTHLY",
          unit: "month",
          unitPrice: "18000",
          visibleForClient: true,
          visibleToClient: true
        },
        {
          billingType: "OPTIONAL",
          code: "ON-SITE",
          description: "Sesión presencial de diseño o transferencia en Ciudad de México.",
          discount: "0",
          discountType: "NONE",
          discountValue: "0",
          internalCost: "6500",
          internalNotes: "Viáticos fuera de CDMX se cotizan por separado.",
          isActive: true,
          isIncluded: false,
          isOptional: true,
          isTaxable: true,
          markupPercent: "38",
          name: "Sesión presencial opcional",
          optionId: integral.id,
          position: 5,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          selectedByDefault: false,
          taxIncluded: false,
          taxRate: "16",
          type: "OPTIONAL",
          unit: "day",
          unitPrice: "9000",
          visibleForClient: true,
          visibleToClient: true
        }
      ]
    });

    const phases = await Promise.all([
      transaction.proposalTimelinePhase.create({
        data: {
          code: "DISCOVERY",
          description: "Entender la operación y decidir el alcance verificable.",
          durationUnit: "WEEK",
          durationValue: 2,
          estimatedEndDate: new Date("2026-09-18T00:00:00.000Z"),
          estimatedStartDate: new Date("2026-09-07T00:00:00.000Z"),
          isOptional: false,
          position: 1,
          revisionId: revision.id,
          title: "Descubrimiento y decisión",
          visibleToClient: true
        }
      }),
      transaction.proposalTimelinePhase.create({
        data: {
          code: "DESIGN",
          description: "Diseñar los flujos, estados y criterios de interfaz.",
          durationUnit: "WEEK",
          durationValue: 2,
          estimatedEndDate: new Date("2026-10-02T00:00:00.000Z"),
          estimatedStartDate: new Date("2026-09-21T00:00:00.000Z"),
          isOptional: false,
          position: 2,
          revisionId: revision.id,
          title: "Diseño de sistema",
          visibleToClient: true
        }
      }),
      transaction.proposalTimelinePhase.create({
        data: {
          code: "PILOT",
          description: "Implementar, probar con casos reales y ajustar antes de escalar.",
          durationUnit: "WEEK",
          durationValue: 4,
          estimatedEndDate: new Date("2026-10-30T00:00:00.000Z"),
          estimatedStartDate: new Date("2026-10-05T00:00:00.000Z"),
          isOptional: false,
          optionId: integral.id,
          position: 3,
          revisionId: revision.id,
          title: "Implementación y piloto",
          visibleToClient: true
        }
      }),
      transaction.proposalTimelinePhase.create({
        data: {
          code: "TRANSFER",
          description: "Transferir operación, métricas y criterios de continuidad.",
          durationUnit: "WEEK",
          durationValue: 2,
          estimatedEndDate: new Date("2026-11-13T00:00:00.000Z"),
          estimatedStartDate: new Date("2026-11-02T00:00:00.000Z"),
          isOptional: false,
          optionId: integral.id,
          position: 4,
          revisionId: revision.id,
          title: "Transferencia y cierre",
          visibleToClient: true
        }
      })
    ]);
    await transaction.proposalTimelineDependency.createMany({
      data: [
        { dependsOnPhaseId: phases[0].id, phaseId: phases[1].id },
        { dependsOnPhaseId: phases[1].id, phaseId: phases[2].id },
        { dependsOnPhaseId: phases[2].id, phaseId: phases[3].id }
      ]
    });
    await transaction.proposalTimelineDeliverable.createMany({
      data: [
        { phaseId: phases[0].id, position: 1, title: "Mapa de operación actual", visibleToClient: true },
        { phaseId: phases[0].id, position: 2, title: "Alcance priorizado", visibleToClient: true },
        { phaseId: phases[1].id, position: 1, title: "Prototipo navegable", visibleToClient: true },
        { phaseId: phases[2].id, position: 1, title: "Flujos configurados", visibleToClient: true },
        { phaseId: phases[2].id, position: 2, title: "Bitácora del piloto", visibleToClient: true },
        { phaseId: phases[3].id, position: 1, title: "Sesión de transferencia", visibleToClient: true },
        { phaseId: phases[3].id, position: 2, title: "Plan de continuidad", visibleToClient: true }
      ]
    });
    await transaction.proposalPaymentStage.createMany({
      data: [
        {
          calculationType: "PERCENTAGE",
          description: "Reserva de capacidad y activación de descubrimiento.",
          dueDays: 5,
          percentage: "40",
          position: 1,
          revisionId: revision.id,
          title: "Inicio",
          triggerDescription: "Al aceptar la propuesta.",
          triggerType: "ACCEPTANCE",
          visibleToClient: true
        },
        {
          calculationType: "PERCENTAGE",
          description: "Aprobación del prototipo y paso a implementación.",
          dueDays: 5,
          percentage: "40",
          position: 2,
          revisionId: revision.id,
          title: "Piloto",
          triggerDescription: "Al aprobar el diseño de sistema.",
          triggerType: "MILESTONE",
          visibleToClient: true
        },
        {
          calculationType: "REMAINDER",
          description: "Cierre, transferencia y entrega de evidencia.",
          dueDays: 5,
          position: 3,
          revisionId: revision.id,
          title: "Cierre",
          triggerDescription: "Al entregar el piloto y la transferencia.",
          triggerType: "DELIVERY",
          visibleToClient: true
        }
      ]
    });
    await transaction.proposalEvent.createMany({
      data: [
        {
          adminActorId: admin.id,
          metadata: { kind: "demo", reference: demoReference },
          proposalId: proposal.id,
          revisionId: revision.id,
          type: "PROPOSAL_CREATED"
        },
        {
          adminActorId: admin.id,
          metadata: { alternatives: 3, lineItems: 5, timelinePhases: 4 },
          proposalId: proposal.id,
          revisionId: revision.id,
          type: "PROPOSAL_COMMERCIAL_RECALCULATED"
        }
      ]
    });
  });

  console.log(
    JSON.stringify({
      adminUrl: `/admin/propuestas/${proposal.id}`,
      previewUrl: `/admin/propuestas/${proposal.id}/preview`,
      proposalId: proposal.id,
      reference: demoReference,
      status: "DRAFT"
    })
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
