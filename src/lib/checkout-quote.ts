import { z } from "zod";

const money = z.number().finite().nonnegative().max(1_000_000_000).multipleOf(0.01);
const itemSchema = z.object({
  product_id: z.string().uuid(), name: z.string().min(1), quantity: z.number().int().positive().max(10000),
  unit_price: money, total_price: money, image_url: z.string().nullable().optional(),
});
const quoteSchema = z.object({
  success: z.literal(true), items: z.array(itemSchema).min(1).max(100),
  product_subtotal: money, delivery_fee: money, charge_total: money, currency: z.literal("SLE"),
  shipping_address: z.object({ id: z.string().uuid(), address: z.string().min(1), city: z.string().min(1) }),
  quote_token: z.string().min(1).max(30000), quote_expires_at: z.string().datetime(),
});
export type CheckoutQuote = z.infer<typeof quoteSchema>;
export type CheckoutCartLine = { product_id: string; quantity: number };

/** Validate the complete server price and exact selected address/cart before showing PIN. */
export function parseCheckoutQuote(data: unknown, requested: CheckoutCartLine[], addressId: string, now = Date.now()): CheckoutQuote {
  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Could not verify the complete product and shipping total. Please refresh the quote.");
  const quote = parsed.data;
  const cents = (value: number) => Math.round(value * 100);
  const requestedMap = new Map(requested.map((item) => [item.product_id, item.quantity]));
  const quotedIds = new Set(quote.items.map((item) => item.product_id));
  if (requestedMap.size !== requested.length || quotedIds.size !== quote.items.length || quote.items.length !== requested.length ||
      quote.items.some((item) => requestedMap.get(item.product_id) !== item.quantity || cents(item.unit_price * item.quantity) !== cents(item.total_price)) ||
      quote.shipping_address.id !== addressId || cents(quote.product_subtotal) !== quote.items.reduce((sum, item) => sum + cents(item.total_price), 0) ||
      cents(quote.charge_total) !== cents(quote.product_subtotal) + cents(quote.delivery_fee) || Date.parse(quote.quote_expires_at) <= now) {
    throw new Error("The checkout quote no longer matches your cart or delivery address. Refresh and review it before paying.");
  }
  return quote;
}

/** Context includes the session, so an account/cart/address change cannot reuse an old quote. */
export function checkoutQuoteContext(userId: string | undefined, token: string | null, storeSlug: string, items: CheckoutCartLine[], addressId: string | null) {
  return JSON.stringify([userId || null, token, storeSlug, [...items].sort((a, b) => a.product_id.localeCompare(b.product_id)), addressId]);
}

export function checkoutQuoteReady(quote: CheckoutQuote | null, quotedContext: string, currentContext: string, now = Date.now()): quote is CheckoutQuote {
  return !!quote && quotedContext === currentContext && Date.parse(quote.quote_expires_at) > now;
}

export function randomizedPinKeys(random = Math.random) {
  const keys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let index = keys.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [keys[index], keys[other]] = [keys[other], keys[index]];
  }
  return keys;
}

export const validTransactionPin = (value: string) => /^\d{4,6}$/.test(value);
