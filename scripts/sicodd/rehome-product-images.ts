import "dotenv/config";

import { getProductSourceGallery } from "../../lib/commerce/catalog";
import { database } from "../../lib/database";

const apply = process.argv.includes("--apply");

try {
  const products = await database.product.findMany({
    select: { galleryUrls: true, id: true, imageUrl: true, sku: true },
    where: { status: { not: "ARCHIVED" }, supplierSourceUrl: { not: null } }
  });
  const owners = new Map<string, { id: string; position: number; sku: string }>();
  const ambiguous = new Set<string>();
  for (const product of products) {
    getProductSourceGallery(product.imageUrl, product.galleryUrls).forEach((url, position) => {
      const previous = owners.get(url);
      if (previous && previous.id !== product.id) ambiguous.add(url);
      else owners.set(url, { id: product.id, position, sku: product.sku });
    });
  }
  const derivatives = await database.productImageDerivative.findMany({
    select: { id: true, productId: true, sourcePosition: true, sourceUrl: true, sourceUrlHash: true, status: true }
  });
  const exclusions = await database.productImageExclusion.findMany({
    select: { id: true, productId: true, sourceUrl: true, sourceUrlHash: true }
  });
  const derivativeKeys = new Set(derivatives.map((item) => `${item.productId}:${item.sourceUrlHash}`));
  const exclusionKeys = new Set(exclusions.map((item) => `${item.productId}:${item.sourceUrlHash}`));
  const plannedDerivativeKeys = new Set<string>();
  const plannedExclusionKeys = new Set<string>();
  const moves = derivatives.flatMap((item) => {
    const owner = owners.get(item.sourceUrl);
    if (!owner || ambiguous.has(item.sourceUrl) || owner.id === item.productId) return [];
    const targetKey = `${owner.id}:${item.sourceUrlHash}`;
    if (derivativeKeys.has(targetKey) || plannedDerivativeKeys.has(targetKey)) {
      throw new Error(`La imagen ${item.id} ya existe en el producto de destino.`);
    }
    plannedDerivativeKeys.add(targetKey);
    return [{ ...item, targetId: owner.id, targetSku: owner.sku, position: owner.position }];
  });
  const exclusionMoves = exclusions.flatMap((item) => {
    const owner = owners.get(item.sourceUrl);
    if (!owner || ambiguous.has(item.sourceUrl) || owner.id === item.productId) return [];
    const targetKey = `${owner.id}:${item.sourceUrlHash}`;
    if (exclusionKeys.has(targetKey) || plannedExclusionKeys.has(targetKey)) {
      throw new Error(`La exclusión ${item.id} ya existe en el producto de destino.`);
    }
    plannedExclusionKeys.add(targetKey);
    return [{ ...item, targetId: owner.id, targetSku: owner.sku }];
  });
  if (apply) {
    for (const item of moves) {
      await database.productImageDerivative.update({
        data: { productId: item.targetId, sourcePosition: item.position },
        where: { id: item.id }
      });
    }
    for (const item of exclusionMoves) {
      await database.productImageExclusion.update({
        data: { productId: item.targetId },
        where: { id: item.id }
      });
    }
  }
  console.info(JSON.stringify({
    apply,
    ambiguousUrls: ambiguous.size,
    derivativesToMove: moves.length,
    exclusionsToMove: exclusionMoves.length,
    destinations: [...new Set(moves.map((item) => item.targetSku))].length
  }));
} finally {
  await database.$disconnect();
}
