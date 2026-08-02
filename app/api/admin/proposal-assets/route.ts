import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import {
  getProposalAssetAdminItem,
  ProposalAssetError,
  ProposalAssetValidationError,
  uploadPrivateProposalAsset
} from "@/lib/proposals/assets";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export const runtime = "nodejs";

function fileFromFormData(value: FormDataEntryValue | null) {
  return value && typeof value === "object" && "arrayBuffer" in value && "name" in value
    ? (value as File)
    : null;
}

function truthy(value: FormDataEntryValue | null) {
  return value === "true" || value === "1" || value === "on";
}

function errorResponse(error: unknown) {
  if (error instanceof ProposalAssetError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: 400 });
  }
  if (error instanceof ProposalAssetValidationError) {
    return NextResponse.json(
      { code: "ASSET_INVALID", error: error.message },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { error: "No se pudo procesar el activo privado." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }
  const rateError = assertRequestRate(request, admin.id, "proposal-asset-upload", 30);
  if (rateError) {
    return rateError;
  }
  try {
    const form = await request.formData();
    const file = fileFromFormData(form.get("file"));
    const revisionId = form.get("revisionId");
    const alias = form.get("alias");
    const altText = form.get("altText");
    if (
      !file ||
      typeof revisionId !== "string" ||
      typeof alias !== "string" ||
      typeof altText !== "string"
    ) {
      return NextResponse.json(
        { error: "Faltan los datos del activo privado." },
        { status: 400 }
      );
    }
    const result = await uploadPrivateProposalAsset({
      alias,
      altText,
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMimeType: file.type,
      isDecorative: truthy(form.get("isDecorative")),
      isRequired: truthy(form.get("isRequired")),
      originalFileName: file.name,
      revisionId,
      uploadedByAdminId: admin.id
    });
    const manifest = await getProposalAssetAdminItem(result.assetId);
    if (!manifest) {
      throw new Error(
        "El activo se guardó, pero no se pudo preparar su manifiesto administrativo."
      );
    }
    return NextResponse.json({ manifest, reused: result.reused }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
