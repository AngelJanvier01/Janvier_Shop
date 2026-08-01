"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const projectInput = z.object({
  clientEmail: z.string().trim().email().max(320),
  clientName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160),
  isPublic: z.boolean(),
  summary: z.string().trim().min(24).max(1200),
  title: z.string().trim().min(4).max(160)
});

type CreateProjectState = {
  error?: string;
  slug?: string;
  success?: string;
};

function projectSlug(title: string) {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return `${normalized || "proyecto"}-${randomBytes(3).toString("hex")}`;
}

export async function createPortfolioProject(
  _previousState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const admin = await requireCurrentAdmin();
  const parsed = projectInput.safeParse({
    clientEmail: formData.get("clientEmail"),
    clientName: formData.get("clientName"),
    companyName: formData.get("companyName") ?? "",
    isPublic: formData.get("isPublic") === "on",
    summary: formData.get("summary"),
    title: formData.get("title")
  });
  if (!parsed.success) {
    return { error: "Revisa los datos del proyecto antes de guardarlo." };
  }

  const input = parsed.data;
  const email = input.clientEmail.toLowerCase();
  const client = await database.client.findFirst({
    where: { email },
    orderBy: { updatedAt: "desc" }
  });
  const resolvedClient =
    client ??
    (await database.client.create({
      data: {
        companyName: input.companyName || null,
        contactName: input.clientName,
        email
      }
    }));
  const project = await database.project.create({
    data: {
      clientId: resolvedClient.id,
      isPublic: input.isPublic,
      ownerId: admin.id,
      slug: projectSlug(input.title),
      status: input.isPublic ? "COMPLETED" : "DRAFT",
      summary: input.summary,
      title: input.title
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
  revalidatePath("/proyectos");
  return {
    slug: project.slug,
    success: input.isPublic
      ? "Caso publicado. Ya esta visible en el portafolio."
      : "Proyecto guardado como borrador privado."
  };
}
