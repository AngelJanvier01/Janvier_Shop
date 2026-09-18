"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { normalizeSicoddStockLocationName } from "@/lib/sicodd/stock-locations";
import { defaultSicoddWarehouseNickname } from "@/lib/sicodd/warehouse-directory";

export type WarehouseActionState = {
  error?: string;
  success?: string;
};

const warehouseInput = z.object({
  nickname: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(500),
  sourceName: z.string().trim().max(160),
  warehouseId: z.string().cuid().optional()
});

export async function saveSicoddWarehouse(
  _previousState: WarehouseActionState,
  formData: FormData
): Promise<WarehouseActionState> {
  await requireSettingsAdmin();
  const parsed = warehouseInput.safeParse({
    nickname: formData.get("nickname"),
    notes: formData.get("notes") ?? "",
    sourceName: formData.get("sourceName") ?? "",
    warehouseId: formData.get("warehouseId") || undefined
  });
  if (!parsed.success) {
    return { error: "Revisa el apodo y los datos de la sucursal." };
  }

  try {
    if (parsed.data.warehouseId) {
      const existing = await database.sicoddWarehouse.findUnique({
        select: { id: true },
        where: { id: parsed.data.warehouseId }
      });
      if (!existing) return { error: "La sucursal ya no existe." };
      await database.sicoddWarehouse.update({
        data: {
          nickname: parsed.data.nickname,
          notes: parsed.data.notes || null
        },
        where: { id: existing.id }
      });
    } else {
      if (!parsed.data.sourceName) {
        return { error: "Escribe el nombre exacto que utiliza SICODD." };
      }
      const normalizedName = normalizeSicoddStockLocationName(parsed.data.sourceName);
      await database.sicoddWarehouse.upsert({
        create: {
          nickname:
            parsed.data.nickname ||
            defaultSicoddWarehouseNickname(parsed.data.sourceName),
          normalizedName,
          notes: parsed.data.notes || null,
          sourceName: parsed.data.sourceName
        },
        update: {
          nickname: parsed.data.nickname,
          notes: parsed.data.notes || null,
          sourceName: parsed.data.sourceName
        },
        where: { normalizedName }
      });
    }
  } catch {
    return { error: "No fue posible guardar la sucursal. Revisa que no esté duplicada." };
  }

  revalidatePath("/admin/ajustes/sucursales");
  revalidatePath("/admin/catalogo");
  return { success: "Sucursal guardada." };
}
