import { createReadStream } from "node:fs";
import { access, chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import { getProposalAssetConfig } from "./config";

export type PutPrivateAssetInput = { bytes: Uint8Array; storageKey: string };
export type StoredPrivateAsset = { sizeBytes: number; storageKey: string };

export interface ProposalAssetStorage {
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  open(storageKey: string): Promise<Readable>;
  put(input: PutPrivateAssetInput): Promise<StoredPrivateAsset>;
}

export class PrivateAssetStorageError extends Error {}

function assertStorageKey(storageKey: string) {
  if (!/^blobs\/[a-z0-9][a-z0-9/-]{10,500}$/u.test(storageKey)) {
    throw new PrivateAssetStorageError(
      "La clave de almacenamiento privado no es válida."
    );
  }
}

export class LocalPrivateAssetStorage implements ProposalAssetStorage {
  readonly rootPath: string;

  constructor(rootPath = getProposalAssetConfig().storagePath) {
    this.rootPath = path.resolve(rootPath);
  }

  private resolve(storageKey: string) {
    assertStorageKey(storageKey);
    const target = path.resolve(this.rootPath, storageKey);
    if (!target.startsWith(`${this.rootPath}${path.sep}`)) {
      throw new PrivateAssetStorageError(
        "La clave intentó salir del almacenamiento privado."
      );
    }
    return target;
  }

  async put({ bytes, storageKey }: PutPrivateAssetInput): Promise<StoredPrivateAsset> {
    const target = this.resolve(storageKey);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    if (await this.exists(storageKey)) {
      throw new PrivateAssetStorageError("No se permite sobrescribir un blob privado.");
    }
    const temporary = `${target}.tmp-${randomUUID()}`;
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await chmod(temporary, 0o600);
      await rename(temporary, target);
      if (!(await this.exists(storageKey))) {
        throw new PrivateAssetStorageError(
          "El blob no quedó disponible después de escribirlo."
        );
      }
      return { sizeBytes: bytes.byteLength, storageKey };
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async open(storageKey: string): Promise<Readable> {
    const target = this.resolve(storageKey);
    if (!(await this.exists(storageKey))) {
      throw new PrivateAssetStorageError("El blob privado no existe.");
    }
    return createReadStream(target);
  }

  async exists(storageKey: string) {
    try {
      await access(this.resolve(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string) {
    await rm(this.resolve(storageKey), { force: true });
  }
}

let storage: ProposalAssetStorage | null = null;

export function getProposalAssetStorage(): ProposalAssetStorage {
  storage ??= new LocalPrivateAssetStorage();
  return storage;
}

export function setProposalAssetStorageForTests(
  nextStorage: ProposalAssetStorage | null
) {
  storage = nextStorage;
}
