import os from "node:os";
import path from "node:path";

export const proposalAssetLimits = {
  maxAssetsPerRevision: 50,
  maxDimension: 12000,
  maxPixels: 60_000_000,
  maxThumbnailDimension: 4096
} as const;

export type ProposalAssetConfig = {
  gcGraceDays: number;
  maxFileBytes: number;
  maxRevisionBytes: number;
  storageDriver: "local";
  storagePath: string;
};

export class ProposalAssetConfigurationError extends Error {}

function positiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ProposalAssetConfigurationError(`${name} debe ser un entero positivo.`);
  }
  return parsed;
}

export function getProposalAssetConfig(): ProposalAssetConfig {
  const production = process.env.NODE_ENV === "production";
  const driver = process.env.PROPOSAL_ASSET_STORAGE_DRIVER;
  const storagePath = process.env.PROPOSAL_ASSET_STORAGE_PATH;
  if (production && (!driver || !storagePath)) {
    throw new ProposalAssetConfigurationError(
      "PROPOSAL_ASSET_STORAGE_DRIVER y PROPOSAL_ASSET_STORAGE_PATH son obligatorios en producción."
    );
  }
  if (driver && driver !== "local") {
    throw new ProposalAssetConfigurationError(
      "Sólo PROPOSAL_ASSET_STORAGE_DRIVER=local está disponible en Hito D."
    );
  }
  const resolvedPath = path.resolve(
    /* turbopackIgnore: true */
    storagePath ?? path.join(os.homedir(), ".janvier", "proposal-assets")
  );
  const projectRoot = process.cwd();
  if (
    resolvedPath === projectRoot ||
    resolvedPath.startsWith(`${projectRoot}${path.sep}`)
  ) {
    throw new ProposalAssetConfigurationError(
      "PROPOSAL_ASSET_STORAGE_PATH no puede estar dentro del repositorio."
    );
  }
  return {
    gcGraceDays: positiveInteger("PROPOSAL_ASSET_GC_GRACE_DAYS", 30),
    maxFileBytes: positiveInteger("PROPOSAL_ASSET_MAX_FILE_BYTES", 15 * 1024 * 1024),
    maxRevisionBytes: positiveInteger(
      "PROPOSAL_ASSET_MAX_REVISION_BYTES",
      150 * 1024 * 1024
    ),
    storageDriver: "local",
    storagePath: resolvedPath
  };
}
