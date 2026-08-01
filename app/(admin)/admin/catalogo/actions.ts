"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const productInput = z.object({
  brand: z.string().trim().max(100),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(24).max(2400),
  imageUrl: z.string().trim().url().max(2048).or(z.literal("")),
  name: z.string().trim().min(3).max(180),
  sku: z.string().trim().min(3).max(80),
  specialOrder: z.boolean(),
  specifications: z.string().trim().max(4000),
  status: z.enum(["DRAFT", "PUBLISHED"])
});

type CreateProductState = {
  error?: string;
  slug?: string;
  success?: string;
};

function productSlug(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return `${normalized || "producto"}-${randomBytes(3).toString("hex")}`;
}

export async function createCatalogProduct(
  _previousState: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const admin = await requireCurrentAdmin();
  const parsed = productInput.safeParse({
    brand: formData.get("brand") ?? "",
    category: formData.get("category"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl") ?? "",
    name: formData.get("name"),
    sku: formData.get("sku"),
    specialOrder: formData.get("specialOrder") === "on",
    specifications: formData.get("specifications") ?? "",
    status: formData.get("status")
  });
  if (!parsed.success) {
    return { error: "Revisa el producto antes de guardarlo." };
  }

  const input = parsed.data;
  const specifications = input.specifications
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  try {
    const product = await database.product.create({
      data: {
        brand: input.brand || null,
        category: input.category,
        createdById: admin.id,
        description: input.description,
        imageUrl: input.imageUrl || null,
        name: input.name,
        sku: input.sku.toUpperCase(),
        slug: productSlug(input.name),
        specialOrder: input.specialOrder,
        specifications: specifications.length ? { items: specifications } : undefined,
        status: input.status
      }
    });
    revalidatePath("/admin/catalogo");
    revalidatePath("/suministro");
    revalidatePath("/suministro/catalogo");
    return {
      slug: product.slug,
      success:
        input.status === "PUBLISHED"
          ? "Producto publicado sin precio publico."
          : "Producto guardado como borrador."
    };
  } catch {
    return { error: "Ese SKU ya existe o el producto no pudo guardarse." };
  }
}
