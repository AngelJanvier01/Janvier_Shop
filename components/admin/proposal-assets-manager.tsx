"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  AdminProposalAssetManagerItem,
  MarkdownAssetReport
} from "@/lib/proposals/assets";

import styles from "./proposal-assets-manager.module.css";

type QueueItem = {
  alias: string;
  altText: string;
  file: File;
  id: string;
  isDecorative: boolean;
  isRequired: boolean;
  progress: number;
  state: "READY" | "UPLOADING" | "ERROR";
};

type ProposalAssetsManagerProps = {
  initialAssets: AdminProposalAssetManagerItem[];
  initialReport: MarkdownAssetReport | null;
  revisionId: string;
};

function safeAlias(fileName: string, suffix = "") {
  const base = fileName
    .replace(/\.[^.]+$/u, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(0, Math.max(1, 76 - suffix.length));
  return `${/^[a-z]/u.test(base) ? base : `asset-${base || "image"}`}${suffix}`.slice(
    0,
    80
  );
}

function altFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/u, "")
    .replace(/[-_]+/gu, " ")
    .trim()
    .slice(0, 500);
}

function readableBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MiB`;
}

async function readJson(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    manifest?: AdminProposalAssetManagerItem;
    reused?: boolean;
  } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "No se pudo completar la operaciÃ³n del activo.");
  }
  return body;
}

export function ProposalAssetsManager({
  initialAssets,
  initialReport,
  revisionId
}: ProposalAssetsManagerProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRequests = useRef(new Map<string, XMLHttpRequest>());
  const uploadCancelled = useRef(false);

  const activeAssets = useMemo(() => assets.filter((asset) => !asset.removed), [assets]);
  const usedAliases = new Set(initialReport?.usedAliases ?? []);

  function enqueue(files: FileList | File[]) {
    const existingAliases = new Set([
      ...assets.map((asset) => asset.alias),
      ...queue.map((item) => item.alias)
    ]);
    const additions = Array.from(files).map((file, index) => {
      let alias = safeAlias(file.name);
      let suffixIndex = index + 2;
      while (existingAliases.has(alias)) {
        alias = safeAlias(file.name, `-${suffixIndex++}`);
      }
      existingAliases.add(alias);
      return {
        alias,
        altText: altFromFileName(file.name),
        file,
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        isDecorative: false,
        isRequired: false,
        progress: 0,
        state: "READY" as const
      };
    });
    setQueue((current) => [...current, ...additions]);
  }

  function updateQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function uploadItem(item: QueueItem) {
    return new Promise<AdminProposalAssetManagerItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const key = item.id;
      uploadRequests.current.set(key, xhr);
      xhr.open("POST", "/api/admin/proposal-assets");
      xhr.responseType = "json";
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setQueue((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    progress: Math.round((event.loaded / event.total) * 100)
                  }
                : candidate
            )
          );
        }
      });
      xhr.addEventListener("load", () => {
        uploadRequests.current.delete(key);
        const payload = xhr.response as {
          error?: string;
          manifest?: AdminProposalAssetManagerItem;
        } | null;
        if (xhr.status >= 200 && xhr.status < 300 && payload?.manifest) {
          resolve(payload.manifest);
        } else {
          reject(new Error(payload?.error ?? "No se pudo cargar el activo."));
        }
      });
      xhr.addEventListener("error", () =>
        reject(new Error("La carga privada se interrumpiÃ³."))
      );
      xhr.addEventListener("abort", () => reject(new Error("Carga cancelada.")));
      const form = new FormData();
      form.set("file", item.file);
      form.set("revisionId", revisionId);
      form.set("alias", item.alias);
      form.set("altText", item.altText);
      form.set("isDecorative", String(item.isDecorative));
      form.set("isRequired", String(item.isRequired));
      xhr.send(form);
    });
  }

  async function uploadQueue() {
    const candidates = queue.filter((item) => item.state === "READY");
    if (!candidates.length) {
      return;
    }
    uploadCancelled.current = false;
    setMessage(null);
    for (const item of candidates) {
      if (uploadCancelled.current) {
        break;
      }
      updateQueue(item.id, { state: "UPLOADING" });
      try {
        const manifest = await uploadItem(item);
        setAssets((current) => [...current, manifest]);
        setQueue((current) => current.filter((candidate) => candidate !== item));
        router.refresh();
      } catch (error) {
        if (uploadCancelled.current) {
          break;
        }
        updateQueue(item.id, {
          state: "ERROR",
          progress: 0
        });
        setMessage(
          error instanceof Error ? error.message : "No se pudo cargar el activo."
        );
      }
    }
  }

  function cancelUploads() {
    uploadCancelled.current = true;
    for (const request of uploadRequests.current.values()) {
      request.abort();
    }
    uploadRequests.current.clear();
    setQueue((current) =>
      current.map((item) =>
        item.state === "UPLOADING" ? { ...item, progress: 0, state: "READY" } : item
      )
    );
  }

  async function mutateAsset(
    asset: AdminProposalAssetManagerItem,
    method: "DELETE" | "PATCH" | "POST",
    form?: FormData
  ) {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/proposal-assets/${asset.id}`, {
        body: form,
        method
      });
      const payload = await readJson(response);
      if (payload?.manifest) {
        setAssets((current) =>
          current.map((item) => (item.id === asset.id ? payload.manifest! : item))
        );
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo modificar el activo."
      );
    }
  }

  async function editAsset(asset: AdminProposalAssetManagerItem) {
    const alias = window.prompt("Alias Markdown (asset:alias)", asset.alias);
    if (alias === null) {
      return;
    }
    const altText = window.prompt("Texto alternativo", asset.altText);
    if (altText === null) {
      return;
    }
    const form = new FormData();
    form.set("alias", alias);
    form.set("altText", altText);
    form.set("isDecorative", String(asset.isDecorative));
    form.set("isRequired", String(asset.isRequired));
    if (alias !== asset.alias && usedAliases.has(asset.alias)) {
      const confirmed = window.confirm(
        "Este alias ya aparece en Markdown. Cambiarlo no reescribe el documento. Â¿Continuar?"
      );
      if (!confirmed) {
        return;
      }
      form.set("confirmAliasChange", "true");
    }
    await mutateAsset(asset, "PATCH", form);
  }

  async function replaceAsset(
    asset: AdminProposalAssetManagerItem,
    file: File | undefined
  ) {
    if (!file) {
      return;
    }
    const form = new FormData();
    form.set("file", file);
    await mutateAsset(asset, "PATCH", form);
  }

  async function toggleRequired(asset: AdminProposalAssetManagerItem) {
    const form = new FormData();
    form.set("alias", asset.alias);
    form.set("altText", asset.altText);
    form.set("isDecorative", String(asset.isDecorative));
    form.set("isRequired", String(!asset.isRequired));
    await mutateAsset(asset, "PATCH", form);
  }

  return (
    <section className={styles.manager} data-testid="proposal-assets-manager">
      <header>
        <div>
          <p>PRIVATE_ASSETS / REVISION_DRAFT</p>
          <h2>ImÃ¡genes privadas, referencias estables.</h2>
        </div>
        <span>{activeAssets.length}/50 ACTIVOS</span>
      </header>

      <div
        className={styles.dropzone}
        data-dragging={dragging || undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          enqueue(event.dataTransfer.files);
        }}
      >
        <p>PNG / JPEG / WEBP â€” hasta 15 MiB por archivo.</p>
        <button onClick={() => fileInput.current?.click()} type="button">
          Seleccionar imÃ¡genes
        </button>
        <input
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          hidden
          multiple
          onChange={(event) => {
            if (event.target.files) {
              enqueue(event.target.files);
              event.target.value = "";
            }
          }}
          ref={fileInput}
          type="file"
        />
      </div>

      {queue.length ? (
        <section className={styles.queue} aria-label="Cola de cargas privadas">
          {queue.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.file.name}</b>
                <span>
                  {readableBytes(item.file.size)} / {item.state}
                </span>
              </div>
              <label>
                Alias
                <input
                  disabled={item.state === "UPLOADING"}
                  maxLength={80}
                  onChange={(event) =>
                    updateQueue(item.id, { alias: safeAlias(event.target.value) })
                  }
                  value={item.alias}
                />
              </label>
              <label>
                Texto alternativo
                <input
                  disabled={item.state === "UPLOADING" || item.isDecorative}
                  maxLength={500}
                  onChange={(event) =>
                    updateQueue(item.id, { altText: event.target.value })
                  }
                  value={item.altText}
                />
              </label>
              <label className={styles.check}>
                <input
                  checked={item.isDecorative}
                  disabled={item.state === "UPLOADING"}
                  onChange={(event) =>
                    updateQueue(item.id, { isDecorative: event.target.checked })
                  }
                  type="checkbox"
                />
                Decorativa
              </label>
              <label className={styles.check}>
                <input
                  checked={item.isRequired}
                  disabled={item.state === "UPLOADING"}
                  onChange={(event) =>
                    updateQueue(item.id, { isRequired: event.target.checked })
                  }
                  type="checkbox"
                />
                Requerida al compartir
              </label>
              {item.state === "UPLOADING" ? (
                <progress max="100" value={item.progress} />
              ) : null}
              <button
                disabled={item.state === "UPLOADING"}
                onClick={() =>
                  setQueue((current) =>
                    current.filter((candidate) => candidate.id !== item.id)
                  )
                }
                type="button"
              >
                Quitar
              </button>
            </article>
          ))}
          <div className={styles.queueActions}>
            <button onClick={uploadQueue} type="button">
              Cargar cola privada
            </button>
            <button onClick={cancelUploads} type="button">
              Cancelar cargas
            </button>
          </div>
        </section>
      ) : null}

      {initialReport ? (
        <aside className={styles.report} data-testid="proposal-asset-report">
          <b>MARKDOWN_ASSET_ANALYSIS</b>
          <span>REFERENCIADOS {initialReport.usedAliases.length}</span>
          <span>NO USADOS {initialReport.unusedAliases.length}</span>
          <span>FALTANTES {initialReport.missingAliases.length}</span>
          <span>ALT_PENDIENTE {initialReport.unresolvedAltAliases.length}</span>
          {initialReport.missingAliases.length ? (
            <p>
              Faltan: {initialReport.missingAliases.map((item) => item.alias).join(", ")}
            </p>
          ) : null}
        </aside>
      ) : null}

      <div className={styles.assets}>
        {assets.length ? (
          assets.map((asset) => (
            <article data-removed={asset.removed || undefined} key={asset.id}>
              {/* Private authenticated images cannot use the public Next image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={asset.isDecorative ? "" : asset.altText} src={asset.accessUrl} />
              <div>
                <p>asset:{asset.alias}</p>
                <b>{asset.originalFileName}</b>
                <span>
                  {asset.mimeType} / {readableBytes(asset.sizeBytes)}
                </span>
                <span>
                  {asset.removed
                    ? "RETIRED"
                    : usedAliases.has(asset.alias)
                      ? "MARKDOWN_LINKED"
                      : "UNUSED"}
                </span>
                {asset.isRequired ? <span>REQUIRED</span> : null}
              </div>
              <div className={styles.assetActions}>
                {!asset.removed ? (
                  <>
                    <button onClick={() => editAsset(asset)} type="button">
                      Editar
                    </button>
                    <label>
                      Reemplazar
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => replaceAsset(asset, event.target.files?.[0])}
                        type="file"
                      />
                    </label>
                    <button onClick={() => mutateAsset(asset, "DELETE")} type="button">
                      Retirar
                    </button>
                    <button onClick={() => toggleRequired(asset)} type="button">
                      {asset.isRequired ? "No requerida" : "Marcar requerida"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const form = new FormData();
                      form.set("action", "restore");
                      void mutateAsset(asset, "POST", form);
                    }}
                    type="button"
                  >
                    Restaurar
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className={styles.empty}>
            AÃºn no hay activos privados para esta revisiÃ³n.
          </p>
        )}
      </div>
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
