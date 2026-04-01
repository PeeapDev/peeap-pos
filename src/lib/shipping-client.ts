/**
 * Shipping API Client - Calls shipping.peeap.com for delivery operations.
 * Uses SERVICE_SECRET for service-to-service authentication.
 */

const SHIPPING_API_URL =
  process.env.SHIPPING_API_URL || "https://shipping.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

const TIMEOUT_MS = 5000;

interface ShippingQuoteParams {
  pickup_city: string;
  delivery_city: string;
  package_size?: "small" | "medium" | "large" | "extra_large";
}

interface ShippingQuote {
  fee: number;
  estimated_time_minutes: number;
  pickup_zone: string | null;
  delivery_zone: string | null;
}

export async function getShippingQuote(
  params: ShippingQuoteParams
): Promise<ShippingQuote | null> {
  try {
    const res = await Promise.race([
      fetch(`${SHIPPING_API_URL}/api/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_city: params.pickup_city,
          delivery_city: params.delivery_city,
          package_size: params.package_size || "medium",
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("shipping_quote_timeout")), TIMEOUT_MS)
      ),
    ]);

    if (!res.ok) return null;
    const data = await res.json();
    return data.quote || null;
  } catch (err) {
    console.error("[ShippingClient] getShippingQuote failed:", err);
    return null;
  }
}

interface CreateDeliveryParams {
  store_order_id?: string;
  transaction_id?: string;
  merchant_id: string;
  merchant_name?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_city?: string;
  delivery_address: string;
  delivery_city?: string;
  shipping_fee?: number;
  package_description?: string;
  package_size?: "small" | "medium" | "large" | "extra_large";
  items?: unknown[];
  metadata?: Record<string, unknown>;
}

interface DeliveryResult {
  delivery: Record<string, unknown>;
  job_number: string;
}

export async function createDeliveryJob(
  params: CreateDeliveryParams
): Promise<DeliveryResult | null> {
  try {
    const res = await Promise.race([
      fetch(`${SHIPPING_API_URL}/api/deliveries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SERVICE_SECRET,
        },
        body: JSON.stringify({
          store_order_id: params.store_order_id,
          transaction_id: params.transaction_id,
          merchant_id: params.merchant_id,
          merchant_name: params.merchant_name,
          customer_id: params.customer_id,
          customer_name: params.customer_name,
          customer_phone: params.customer_phone,
          pickup_address: params.pickup_address,
          pickup_city: params.pickup_city || "",
          delivery_address: params.delivery_address,
          delivery_city: params.delivery_city || "",
          shipping_fee: params.shipping_fee || 0,
          package_description: params.package_description,
          package_size: params.package_size || "medium",
          items: params.items || [],
          metadata: params.metadata || {},
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("shipping_create_timeout")), TIMEOUT_MS)
      ),
    ]);

    if (!res.ok) {
      console.error("[ShippingClient] createDeliveryJob response:", res.status);
      return null;
    }

    const data = await res.json();
    return {
      delivery: data.delivery || data,
      job_number: data.job_number || data.delivery?.job_number || "",
    };
  } catch (err) {
    console.error("[ShippingClient] createDeliveryJob failed:", err);
    return null;
  }
}
