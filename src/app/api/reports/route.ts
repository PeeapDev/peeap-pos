import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * Unified sales reporting across BOTH sales channels:
 *   - pos_sales       → in-person cashier sales (channel "pos")
 *   - store_orders    → online marketplace orders (channel "online") and
 *                       scan-to-pay/terminal charges (order_type "pos" → "qr")
 *
 * Previously this endpoint only counted pos_sales, so every online and
 * scan-to-pay sale was missing from the merchant's reports. Now every report
 * type sums both tables and exposes a per-channel breakdown.
 */

// store_orders statuses that count as realised revenue (everything past pending,
// excluding cancelled/refunded).
const ORDER_REVENUE_STATUSES = [
  "paid",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
];

type Channel = "pos" | "qr" | "online";
function orderChannel(orderType?: string | null): Channel {
  return orderType === "pos" ? "qr" : "online";
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const dateFrom = from || defaultFrom.toISOString();
    const dateTo = to || now.toISOString();
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    switch (type) {
      case "summary":
        return await getSummaryReport(auth.sub, dateFrom, dateTo, headers);
      case "hourly":
        return await getTimeReport(auth.sub, dateFrom, dateTo, headers, "hourly");
      case "daily":
        return await getTimeReport(auth.sub, dateFrom, dateTo, headers, "daily");
      case "products":
        return await getProductsReport(auth.sub, dateFrom, dateTo, headers);
      case "payments":
        return await getPaymentsReport(auth.sub, dateFrom, dateTo, headers);
      case "transactions":
        return await getTransactions(auth.sub, dateFrom, dateTo, headers, limit);
      default:
        return NextResponse.json(
          {
            error:
              "Invalid report type. Use: summary, hourly, daily, products, payments, transactions",
          },
          { status: 400, headers }
        );
    }
  } catch (err) {
    console.error("Error generating report:", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500, headers }
    );
  }
}

// ── Shared fetch: both channels, normalized to a common shape ──────────────
interface NormalizedSale {
  id: string;
  channel: Channel;
  reference: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string;
  status: string;
  customer_name: string | null;
  created_at: string;
}

async function fetchAllSales(
  merchantId: string,
  from: string,
  to: string
): Promise<NormalizedSale[]> {
  const [posRes, orderRes] = await Promise.all([
    supabase
      .from("pos_sales")
      .select(
        "id, sale_number, total_amount, subtotal, tax_amount, discount_amount, payment_method, status, customer_name, created_at"
      )
      .eq("merchant_id", merchantId)
      .eq("status", "completed")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("store_orders")
      .select(
        "id, order_number, total_amount, subtotal, tax_amount, discount_amount, payment_method, status, customer_name, order_type, created_at"
      )
      .eq("merchant_id", merchantId)
      .in("status", ORDER_REVENUE_STATUSES)
      .gte("created_at", from)
      .lte("created_at", to),
  ]);

  const pos: NormalizedSale[] = (posRes.data || []).map((s) => ({
    id: s.id,
    channel: "pos",
    reference: s.sale_number,
    total_amount: Number(s.total_amount) || 0,
    subtotal: Number(s.subtotal) || 0,
    tax_amount: Number(s.tax_amount) || 0,
    discount_amount: Number(s.discount_amount) || 0,
    payment_method: s.payment_method || "cash",
    status: s.status,
    customer_name: s.customer_name,
    created_at: s.created_at,
  }));

  const orders: NormalizedSale[] = (orderRes.data || []).map((o) => ({
    id: o.id,
    channel: orderChannel(o.order_type),
    reference: o.order_number,
    total_amount: Number(o.total_amount) || 0,
    subtotal: Number(o.subtotal) || 0,
    tax_amount: Number(o.tax_amount) || 0,
    discount_amount: Number(o.discount_amount) || 0,
    payment_method: o.payment_method || "mobile_money",
    status: o.status,
    customer_name: o.customer_name,
    created_at: o.created_at,
  }));

  return [...pos, ...orders];
}

// Merge product-line items from both pos_sale_items and store_order_items.
async function fetchAllItems(merchantId: string, from: string, to: string) {
  const [posItems, orderItems] = await Promise.all([
    supabase
      .from("pos_sale_items")
      .select(
        "product_id, product_name, product_sku, quantity, total_price, cost_price, sale:pos_sales!inner(merchant_id, status, created_at)"
      )
      .eq("sale.merchant_id", merchantId)
      .eq("sale.status", "completed")
      .gte("sale.created_at", from)
      .lte("sale.created_at", to),
    supabase
      .from("store_order_items")
      .select(
        "product_id, product_name, quantity, total_price, order:store_orders!inner(merchant_id, status, created_at)"
      )
      .eq("order.merchant_id", merchantId)
      .in("order.status", ORDER_REVENUE_STATUSES)
      .gte("order.created_at", from)
      .lte("order.created_at", to),
  ]);

  const items: Array<{
    product_id: string | null;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    total_price: number;
    cost_price: number;
  }> = [];
  for (const i of posItems.data || []) {
    items.push({
      product_id: i.product_id || null,
      product_name: i.product_name,
      product_sku: (i as { product_sku?: string }).product_sku || null,
      quantity: i.quantity || 0,
      total_price: Number(i.total_price) || 0,
      cost_price: Number((i as { cost_price?: number }).cost_price) || 0,
    });
  }
  for (const i of orderItems.data || []) {
    items.push({
      product_id: i.product_id || null,
      product_name: i.product_name,
      product_sku: null,
      quantity: i.quantity || 0,
      total_price: Number(i.total_price) || 0,
      cost_price: 0,
    });
  }
  return items;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Summary (with per-channel breakdown) ───────────────────────────────────
async function getSummaryReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const sales = await fetchAllSales(merchantId, from, to);

  const totalSales = sales.length;
  const totalRevenue = sales.reduce((s, x) => s + x.total_amount, 0);
  const totalTax = sales.reduce((s, x) => s + x.tax_amount, 0);
  const totalDiscount = sales.reduce((s, x) => s + x.discount_amount, 0);
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const byChannel: Record<Channel, { count: number; revenue: number }> = {
    pos: { count: 0, revenue: 0 },
    qr: { count: 0, revenue: 0 },
    online: { count: 0, revenue: 0 },
  };
  for (const s of sales) {
    byChannel[s.channel].count += 1;
    byChannel[s.channel].revenue += s.total_amount;
  }
  for (const c of Object.keys(byChannel) as Channel[]) {
    byChannel[c].revenue = round2(byChannel[c].revenue);
  }

  const items = await fetchAllItems(merchantId, from, to);
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const existing = productMap.get(item.product_name) || {
      name: item.product_name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.total_price;
    productMap.set(item.product_name, existing);
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return NextResponse.json(
    {
      report: {
        type: "summary",
        from,
        to,
        total_sales: totalSales,
        total_revenue: round2(totalRevenue),
        total_tax: round2(totalTax),
        total_discount: round2(totalDiscount),
        avg_order_value: round2(avgOrderValue),
        by_channel: byChannel,
        top_products: topProducts,
      },
    },
    { headers }
  );
}

// ── Hourly / Daily ─────────────────────────────────────────────────────────
async function getTimeReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>,
  mode: "hourly" | "daily"
) {
  const sales = await fetchAllSales(merchantId, from, to);

  if (mode === "hourly") {
    const hourly: Record<number, { count: number; revenue: number }> = {};
    for (let h = 0; h < 24; h++) hourly[h] = { count: 0, revenue: 0 };
    for (const s of sales) {
      const h = new Date(s.created_at).getHours();
      hourly[h].count += 1;
      hourly[h].revenue += s.total_amount;
    }
    const hours = Object.entries(hourly).map(([hour, d]) => ({
      hour: parseInt(hour),
      sales_count: d.count,
      revenue: round2(d.revenue),
    }));
    return NextResponse.json({ report: { type: "hourly", from, to, hours } }, { headers });
  }

  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (const s of sales) {
    const date = s.created_at.split("T")[0];
    const existing = dailyMap.get(date) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += s.total_amount;
    dailyMap.set(date, existing);
  }
  const days = Array.from(dailyMap.entries())
    .map(([date, d]) => ({ date, sales_count: d.count, revenue: round2(d.revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ report: { type: "daily", from, to, days } }, { headers });
}

// ── Products ───────────────────────────────────────────────────────────────
async function getProductsReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const items = await fetchAllItems(merchantId, from, to);
  const productMap = new Map<
    string,
    { product_id: string | null; name: string; sku: string | null; quantity_sold: number; revenue: number; cost: number }
  >();
  for (const item of items) {
    const key = item.product_id || item.product_name;
    const existing = productMap.get(key) || {
      product_id: item.product_id,
      name: item.product_name,
      sku: item.product_sku,
      quantity_sold: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity_sold += item.quantity;
    existing.revenue += item.total_price;
    existing.cost += item.cost_price * item.quantity;
    productMap.set(key, existing);
  }
  const products = Array.from(productMap.values())
    .map((p) => ({
      ...p,
      revenue: round2(p.revenue),
      cost: round2(p.cost),
      profit: round2(p.revenue - p.cost),
    }))
    .sort((a, b) => b.quantity_sold - a.quantity_sold);
  return NextResponse.json({ report: { type: "products", from, to, products } }, { headers });
}

// ── Payments ───────────────────────────────────────────────────────────────
async function getPaymentsReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const sales = await fetchAllSales(merchantId, from, to);
  const methodMap = new Map<string, { count: number; revenue: number }>();
  for (const s of sales) {
    const method = s.payment_method || "unknown";
    const existing = methodMap.get(method) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += s.total_amount;
    methodMap.set(method, existing);
  }
  const totalRevenue = sales.reduce((s, x) => s + x.total_amount, 0);
  const methods = Array.from(methodMap.entries())
    .map(([method, d]) => ({
      method,
      count: d.count,
      revenue: round2(d.revenue),
      percentage: totalRevenue > 0 ? round2((d.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  return NextResponse.json(
    { report: { type: "payments", from, to, total_revenue: round2(totalRevenue), methods } },
    { headers }
  );
}

// ── Transactions (merged, normalized list — the "one view") ────────────────
async function getTransactions(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>,
  limit: number
) {
  const sales = await fetchAllSales(merchantId, from, to);
  sales.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return NextResponse.json(
    {
      report: {
        type: "transactions",
        from,
        to,
        total: sales.length,
        transactions: sales.slice(0, limit),
      },
    },
    { headers }
  );
}
