import { createHash } from "node:crypto";

import { z } from "zod";

import { createWhatsAppUrl } from "@/components/layout/navigation";

export const diagnosticServices = [
  "Software y automatización",
  "Infraestructura y conectividad",
  "Suministro tecnológico",
  "Consultoría y diagnóstico",
  "Soporte y mantenimiento",
  "Otra necesidad"
] as const;

export const diagnosticTimelines = [
  "Necesito resolverlo pronto",
  "Este trimestre",
  "En los próximos 6 meses",
  "Estoy explorando opciones"
] as const;

export const diagnosticBudgetRanges = [
  "Aún no lo defino",
  "Hasta $25,000 MXN",
  "$25,000 a $75,000 MXN",
  "$75,000 a $250,000 MXN",
  "Más de $250,000 MXN"
] as const;

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined)
    .optional();

export const diagnosticRequestInputSchema = z.object({
  budgetRange: z.enum(diagnosticBudgetRanges).optional(),
  companyName: optionalText(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  message: z.string().trim().min(24).max(6000),
  phone: optionalText(48),
  service: z.enum(diagnosticServices),
  timeline: z.enum(diagnosticTimelines).optional(),
  website: z.string().max(0).optional()
});

export type DiagnosticRequestInput = z.infer<typeof diagnosticRequestInputSchema>;

export function createDiagnosticWhatsAppUrl(input: DiagnosticRequestInput) {
  const lines = [
    "Hola, JANVIER.",
    "Acabo de enviar una solicitud de diagnóstico desde janvier.com.",
    "",
    `Nombre: ${input.contactName}`,
    `Organización: ${input.companyName ?? "No indicada"}`,
    `Correo: ${input.email}`,
    `Teléfono: ${input.phone ?? "No indicado"}`,
    `Área de interés: ${input.service}`,
    `Horizonte: ${input.timeline ?? "Por definir"}`,
    `Inversión estimada: ${input.budgetRange ?? "Por definir"}`,
    "",
    "Contexto:",
    input.message
  ];
  return createWhatsAppUrl(lines.join("\n"));
}

export function fingerprintDiagnosticRequest(value: string | null) {
  if (!value) return null;
  const pepper = process.env.AUTH_SECRET ?? "janvier-development-fingerprint";
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}
