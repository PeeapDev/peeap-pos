import type { POSProduct, POSDiscount } from "@/types/pos";

export interface CartItem {
  product: POSProduct;
  quantity: number;
  discount: number;
  discountType?: "percentage" | "fixed";
}

export function calcSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

export function calcItemDiscounts(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.discount, 0);
}

export function calcCodeDiscount(
  discount: POSDiscount | null,
  subtotal: number,
  cart: CartItem[]
): number {
  if (!discount) return 0;
  if (discount.min_purchase && subtotal < discount.min_purchase) return 0;

  let amount = 0;
  if (discount.type === "percentage") {
    amount = subtotal * (discount.value / 100);
  } else if (discount.type === "fixed") {
    amount = discount.value;
  } else if (discount.type === "buy_x_get_y") {
    // Simplified BOGO
    const eligible = cart.filter(
      (i) =>
        !discount.product_ids?.length ||
        discount.product_ids.includes(i.product.id!)
    );
    if (eligible.length > 0) {
      const cheapest = Math.min(...eligible.map((i) => i.product.price));
      amount = cheapest;
    }
  }

  if (discount.max_discount && amount > discount.max_discount) {
    amount = discount.max_discount;
  }
  return Math.min(amount, subtotal);
}

export function calcTotal(
  cart: CartItem[],
  appliedDiscount: POSDiscount | null,
  taxRate = 0
): {
  subtotal: number;
  itemDiscounts: number;
  codeDiscount: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = calcSubtotal(cart);
  const itemDiscounts = calcItemDiscounts(cart);
  const codeDiscount = calcCodeDiscount(appliedDiscount, subtotal, cart);
  const afterDiscount = subtotal - itemDiscounts - codeDiscount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal, itemDiscounts, codeDiscount, taxAmount, total };
}
