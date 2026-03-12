import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/reports?type=<summary|hourly|daily|products|payments>&from=&to=
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Default date range: last 30 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const dateFrom = from || defaultFrom.toISOString();
    const dateTo = to || now.toISOString();

    switch (type) {
      case "summary":
        return await getSummaryReport(auth.sub, dateFrom, dateTo, headers);
      case "hourly":
        return await getHourlyReport(auth.sub, dateFrom, dateTo, headers);
      case "daily":
        return await getDailyReport(auth.sub, dateFrom, dateTo, headers);
      case "products":
        return await getProductsReport(auth.sub, dateFrom, dateTo, headers);
      case "payments":
        return await getPaymentsReport(auth.sub, dateFrom, dateTo, headers);
      default:
        return NextResponse.json(
          {
            error:
              "Invalid report type. Use: summary, hourly, daily, products, payments",
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

// ─── Summary Report ─────────────────────────────────────────────────
async function getSummaryReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  // Fetch all completed sales in date range
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("id, total_amount, subtotal, tax_amount, discount_amount, payment_method, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "completed")
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) throw error;

  const allSales = sales || [];
  const totalSales = allSales.length;
  const totalRevenue = allSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalTax = allSales.reduce((sum, s) => sum + (s.tax_amount || 0), 0);
  const totalDiscount = allSales.reduce(
    (sum, s) => sum + (s.discount_amount || 0),
    0
  );
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Get top 5 products by quantity sold
  const { data: topItems } = await supabase
    .from("pos_sale_items")
    .select("product_name, quantity, total_price, sale:pos_sales!inner(merchant_id, status, created_at)")
    .eq("sale.merchant_id", merchantId)
    .eq("sale.status", "completed")
    .gte("sale.created_at", from)
    .lte("sale.created_at", to);

  // Aggregate top products in code
  const productMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const item of topItems || []) {
    const existing = productMap.get(item.product_name) || {
      name: item.product_name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity || 0;
    existing.revenue += item.total_price || 0;
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
        total_revenue: totalRevenue,
        total_tax: totalTax,
        total_discount: totalDiscount,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        top_products: topProducts,
      },
    },
    { headers }
  );
}

// ─── Hourly Report ──────────────────────────────────────────────────
async function getHourlyReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("total_amount, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "completed")
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) throw error;

  // Group by hour (0-23)
  const hourlyData: Record<number, { count: number; revenue: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyData[h] = { count: 0, revenue: 0 };
  }

  for (const sale of sales || []) {
    const hour = new Date(sale.created_at).getHours();
    hourlyData[hour].count += 1;
    hourlyData[hour].revenue += sale.total_amount || 0;
  }

  const hours = Object.entries(hourlyData).map(([hour, data]) => ({
    hour: parseInt(hour),
    sales_count: data.count,
    revenue: Math.round(data.revenue * 100) / 100,
  }));

  return NextResponse.json(
    { report: { type: "hourly", from, to, hours } },
    { headers }
  );
}

// ─── Daily Report ───────────────────────────────────────────────────
async function getDailyReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("total_amount, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "completed")
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) throw error;

  // Group by date (YYYY-MM-DD)
  const dailyMap = new Map<string, { count: number; revenue: number }>();

  for (const sale of sales || []) {
    const date = sale.created_at.split("T")[0];
    const existing = dailyMap.get(date) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += sale.total_amount || 0;
    dailyMap.set(date, existing);
  }

  const days = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      sales_count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    { report: { type: "daily", from, to, days } },
    { headers }
  );
}

// ─── Products Report ────────────────────────────────────────────────
async function getProductsReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const { data: items, error } = await supabase
    .from("pos_sale_items")
    .select(
      "product_id, product_name, product_sku, quantity, total_price, cost_price, sale:pos_sales!inner(merchant_id, status, created_at)"
    )
    .eq("sale.merchant_id", merchantId)
    .eq("sale.status", "completed")
    .gte("sale.created_at", from)
    .lte("sale.created_at", to);

  if (error) throw error;

  // Aggregate by product
  const productMap = new Map<
    string,
    {
      product_id: string;
      name: string;
      sku: string | null;
      quantity_sold: number;
      revenue: number;
      cost: number;
    }
  >();

  for (const item of items || []) {
    const key = item.product_id || item.product_name;
    const existing = productMap.get(key) || {
      product_id: item.product_id,
      name: item.product_name,
      sku: item.product_sku || null,
      quantity_sold: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity_sold += item.quantity || 0;
    existing.revenue += item.total_price || 0;
    existing.cost += (item.cost_price || 0) * (item.quantity || 0);
    productMap.set(key, existing);
  }

  const products = Array.from(productMap.values())
    .map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      cost: Math.round(p.cost * 100) / 100,
      profit: Math.round((p.revenue - p.cost) * 100) / 100,
    }))
    .sort((a, b) => b.quantity_sold - a.quantity_sold);

  return NextResponse.json(
    { report: { type: "products", from, to, products } },
    { headers }
  );
}

// ─── Payments Report ────────────────────────────────────────────────
async function getPaymentsReport(
  merchantId: string,
  from: string,
  to: string,
  headers: Record<string, string>
) {
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("payment_method, total_amount")
    .eq("merchant_id", merchantId)
    .eq("status", "completed")
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) throw error;

  // Group by payment method
  const methodMap = new Map<
    string,
    { count: number; revenue: number }
  >();

  for (const sale of sales || []) {
    const method = sale.payment_method || "unknown";
    const existing = methodMap.get(method) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += sale.total_amount || 0;
    methodMap.set(method, existing);
  }

  const totalRevenue = (sales || []).reduce(
    (sum, s) => sum + (s.total_amount || 0),
    0
  );

  const methods = Array.from(methodMap.entries())
    .map(([method, data]) => ({
      method,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage:
        totalRevenue > 0
          ? Math.round((data.revenue / totalRevenue) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json(
    {
      report: {
        type: "payments",
        from,
        to,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        methods,
      },
    },
    { headers }
  );
}
