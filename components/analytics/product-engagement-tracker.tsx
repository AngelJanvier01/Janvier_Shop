"use client";

import { useEffect } from "react";

import {
  markProductViewMeasured,
  sendProductEngagement
} from "./product-engagement-client";

export function ProductEngagementTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (!markProductViewMeasured(productId)) return;
    sendProductEngagement({ eventType: "PRODUCT_VIEW", productId });
  }, [productId]);

  return null;
}
