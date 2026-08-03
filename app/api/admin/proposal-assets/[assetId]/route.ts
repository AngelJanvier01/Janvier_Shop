import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import {
  getProposalAssetAdminItem,
  ProposalAssetError,
  ProposalAssetValidationError,
  removePrivateProposalAsset,
  replacePrivateProposalAsset,
  restorePrivateProposalAsset,
  updatePrivateProposalAsset
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

function bool(value: FormDataEntryValue | null) {
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
    { error: "No se pudo modificar el activo privado." },
    { status: 500 }
  );
}

async function authenticatedMutation(request: Request, action: string) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return { error: originError };
  }
  const rateError = assertRequestRate(request, admin.id, action, 60);
  return rateError ? { error: rateError } : { admin };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const auth = await authenticatedMutation(request, "proposal-asset-update");
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { assetId } = await context.params;
    const form = await request.formData();
    const file = fileFromFormData(form.get("file"));
    const result = file
      ? await replacePrivateProposalAsset({
          adminId: auth.admin.id,
          assetId,
          bytes: new Uint8Array(await file.arrayBuffer()),
          declaredMimeType: file.type,
          originalFileName: file.name
        })
      : {
          manifest: await updatePrivateProposalAsset({
            adminId: auth.admin.id,
            alias:
              typeof form.get("alias") === "string"
                ? String(form.get("alias"))
                : undefined,
            altText:
              typeof form.get("altText") === "string"
                ? String(form.get("altText"))
                : undefined,
            assetId,
            confirmAliasChange: bool(form.get("confirmAliasChange")),
            isDecorative:
              typeof form.get("isDecorative") === "string"
                ? bool(form.get("isDecorative"))
                : undefined,
            isRequired:
              typeof form.get("isRequired") === "string"
                ? bool(form.get("isRequired"))
                : undefined
          })
        };
    const manifest = await getProposalAssetAdminItem(assetId);
    if (!manifest) {
      throw new Error("No se pudo recuperar el manifiesto administrativo del activo.");
    }
    return NextResponse.json({ ...result, manifest });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const auth = await authenticatedMutation(request, "proposal-asset-restore");
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { assetId } = await context.params;
    const form = await request.formData();
    if (form.get("action") !== "restore") {
      return NextResponse.json({ error: "Acción no permitida." }, { status: 400 });
    }
    await restorePrivateProposalAsset(assetId, auth.admin.id);
    const manifest = await getProposalAssetAdminItem(assetId);
    if (!manifest) {
      throw new Error("No se pudo recuperar el manifiesto administrativo del activo.");
    }
    return NextResponse.json({ manifest });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const auth = await authenticatedMutation(request, "proposal-asset-remove");
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { assetId } = await context.params;
    await removePrivateProposalAsset(assetId, auth.admin.id);
    const manifest = await getProposalAssetAdminItem(assetId);
    if (!manifest) {
      throw new Error("No se pudo recuperar el manifiesto administrativo del activo.");
    }
    return NextResponse.json({ manifest });
  } catch (error) {
    return errorResponse(error);
  }
}
