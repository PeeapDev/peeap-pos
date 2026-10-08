// These merchants were inserted by 004_seed_demo_stores_products.sql to
// illustrate the UI. They have no real seller to fulfil a paid order.
export const DEMO_MERCHANT_IDS = [
  "a1000000-0000-0000-0000-000000000001",
  "a2000000-0000-0000-0000-000000000002",
  "a3000000-0000-0000-0000-000000000003",
  "a4000000-0000-0000-0000-000000000004",
  "a5000000-0000-0000-0000-000000000005",
  "a6000000-0000-0000-0000-000000000006",
] as const;

export const DEMO_MERCHANT_FILTER = `(${DEMO_MERCHANT_IDS.join(",")})`;

export function isDemoMerchant(merchantId: string): boolean {
  return DEMO_MERCHANT_IDS.some((id) => id === merchantId);
}
