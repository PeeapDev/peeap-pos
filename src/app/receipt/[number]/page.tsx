/**
 * Public receipt verifier — the page a receipt QR points at.
 *
 * Looks up the receipt across both record types (cashier sales in pos_sales,
 * scan-to-pay/online orders in store_orders) using the server-side service
 * role, and renders a minimal, non-sensitive verification view: store, items,
 * total, date, and a PAID/VERIFIED badge. No customer personal data is shown.
 */
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/utils/currency";

export const dynamic = "force-dynamic";

interface VerifiedReceipt {
  storeName: string;
  number: string;
  createdAt: string;
  paymentMethod: string;
  total: number;
  subtotal: number;
  tax: number;
  status: string;
  items: Array<{ name: string; qty: number; total: number }>;
}

async function storeName(opts: { merchantId?: string | null; storeId?: string | null }) {
  if (opts.storeId) {
    const { data } = await supabase
      .from("stores")
      .select("name")
      .eq("id", opts.storeId)
      .maybeSingle();
    if (data?.name) return data.name as string;
  }
  if (opts.merchantId) {
    const { data } = await supabase
      .from("stores")
      .select("name")
      .eq("merchant_id", opts.merchantId)
      .maybeSingle();
    if (data?.name) return data.name as string;
  }
  return "Peeap Store";
}

async function lookup(number: string): Promise<VerifiedReceipt | null> {
  // 1. Cashier sale (pos_sales)
  const { data: sale } = await supabase
    .from("pos_sales")
    .select(
      "sale_number, merchant_id, subtotal, tax_amount, total_amount, payment_method, status, created_at, items:pos_sale_items(product_name, quantity, total_price)"
    )
    .eq("sale_number", number)
    .maybeSingle();

  if (sale) {
    const s = sale as any;
    return {
      storeName: await storeName({ merchantId: s.merchant_id }),
      number: s.sale_number,
      createdAt: s.created_at,
      paymentMethod: s.payment_method || "",
      total: Number(s.total_amount) || 0,
      subtotal: Number(s.subtotal) || 0,
      tax: Number(s.tax_amount) || 0,
      status: s.status || "completed",
      items: (s.items || []).map((i: any) => ({
        name: i.product_name,
        qty: i.quantity,
        total: Number(i.total_price) || 0,
      })),
    };
  }

  // 2. Online / scan-to-pay order (store_orders)
  const { data: order } = await supabase
    .from("store_orders")
    .select(
      "order_number, store_id, subtotal, tax_amount, total_amount, payment_method, status, created_at, items:store_order_items(product_name, quantity, total_price)"
    )
    .eq("order_number", number)
    .maybeSingle();

  if (order) {
    const o = order as any;
    return {
      storeName: await storeName({ storeId: o.store_id }),
      number: o.order_number,
      createdAt: o.created_at,
      paymentMethod: o.payment_method || "",
      total: Number(o.total_amount) || 0,
      subtotal: Number(o.subtotal) || 0,
      tax: Number(o.tax_amount) || 0,
      status: o.status || "paid",
      items: (o.items || []).map((i: any) => ({
        name: i.product_name,
        qty: i.quantity,
        total: Number(i.total_price) || 0,
      })),
    };
  }

  return null;
}

const prettyMethod = (m: string) =>
  m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const isPaid = (s: string) =>
  ["paid", "completed", "confirmed", "delivered", "shipped", "processing"].includes(
    s.toLowerCase()
  );

export default async function ReceiptVerifyPage({
  params,
}: {
  params: { number: string };
}) {
  const number = decodeURIComponent(params.number);
  const receipt = await lookup(number);

  if (!receipt) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Receipt not found</h1>
          <p className="text-sm text-gray-500 mt-2">
            We couldn&apos;t verify a receipt with reference{" "}
            <span className="font-mono">{number}</span>.
          </p>
          <a href="https://peeap.com" className="text-green-600 text-sm mt-4 inline-block">
            peeap.com
          </a>
        </div>
      </main>
    );
  }

  const paid = isPaid(receipt.status);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border max-w-sm w-full overflow-hidden">
        <div className="p-6 text-center border-b">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
              paid ? "bg-green-50" : "bg-amber-50"
            }`}
          >
            <span className="text-2xl">{paid ? "✓" : "•"}</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">{receipt.storeName}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Receipt {receipt.number}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(receipt.createdAt).toLocaleString()}
          </p>
          <span
            className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold ${
              paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {paid ? "✓ Verified · Paid" : prettyMethod(receipt.status)}
          </span>
        </div>

        <div className="p-6 font-mono text-sm">
          {receipt.items.length > 0 ? (
            <div className="space-y-2">
              {receipt.items.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-3">
                  <span className="text-gray-700">
                    {i.qty} × {i.name}
                  </span>
                  <span className="text-gray-900 whitespace-nowrap">
                    {formatCurrency(i.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center">Payment</p>
          )}

          <div className="border-t border-dashed my-4" />

          {receipt.tax > 0 && (
            <div className="flex justify-between text-gray-500 text-xs mb-1">
              <span>Tax</span>
              <span>{formatCurrency(receipt.tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(receipt.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Payment</span>
            <span>{prettyMethod(receipt.paymentMethod)}</span>
          </div>
        </div>

        <div className="px-6 pb-6 text-center text-xs text-gray-400">
          Verified by Peeap · peeap.com
        </div>
      </div>
    </main>
  );
}
