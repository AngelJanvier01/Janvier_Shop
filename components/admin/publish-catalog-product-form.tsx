"use client";

import { useLayoutEffect } from "react";
import { useFormStatus } from "react-dom";

import { publishCatalogProduct } from "@/app/(admin)/admin/catalogo/actions";

const scrollStateKey = "janvier-admin-catalog-publish-scroll";

type SavedScrollState = {
  productId: string;
  scrollY: number;
  viewportTop: number | null;
};

function restoreSavedPosition(saved: SavedScrollState) {
  const product = document.getElementById(`catalog-product-${saved.productId}`);
  if (product && saved.viewportTop !== null) {
    window.scrollBy({
      behavior: "instant",
      top: product.getBoundingClientRect().top - saved.viewportTop
    });
    return;
  }
  window.scrollTo({ behavior: "instant", top: saved.scrollY });
}

export function CatalogPublishScrollRestoration({ signature }: { signature: string }) {
  useLayoutEffect(() => {
    const rawState = window.sessionStorage.getItem(scrollStateKey);
    if (!rawState) return;

    window.sessionStorage.removeItem(scrollStateKey);
    try {
      const saved = JSON.parse(rawState) as SavedScrollState;
      window.requestAnimationFrame(() => {
        restoreSavedPosition(saved);
        window.requestAnimationFrame(() => restoreSavedPosition(saved));
      });
    } catch {
      // Un estado antiguo o incompleto no debe impedir administrar el catálogo.
    }
  }, [signature]);

  return null;
}

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "PUBLICANDO…" : "PUBLICAR"}
    </button>
  );
}

export function PublishCatalogProductForm({ productId }: { productId: string }) {
  function savePosition(event: React.FormEvent<HTMLFormElement>) {
    const product = event.currentTarget.closest<HTMLElement>("article[data-product-row]");
    const saved: SavedScrollState = {
      productId,
      scrollY: window.scrollY,
      viewportTop: product?.getBoundingClientRect().top ?? null
    };
    window.sessionStorage.setItem(scrollStateKey, JSON.stringify(saved));
  }

  return (
    <form action={publishCatalogProduct} onSubmit={savePosition}>
      <input name="productId" type="hidden" value={productId} />
      <PublishButton />
    </form>
  );
}
