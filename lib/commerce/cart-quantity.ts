type CartQuantityItem = {
  quantity: number;
};

/**
 * Returns the number of pieces in a cart. A cart may have one line with
 * multiple pieces, so using its item count would under-report the total.
 */
export function getCartQuantity(
  items: readonly CartQuantityItem[] | null | undefined
): number {
  return items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
}
