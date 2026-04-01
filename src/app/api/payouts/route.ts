import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authenticateRequest } from "@/lib/auth";
import { creditWallet } from "@/lib/api-client";
import { notifyPayoutCompleted } from "@/lib/notification-client";
import { z } from "zod";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

const PLATFORM_FEE_PERCENT = 2; // 2% platform fee

// GET /api/payouts - Merchant: earnings overview + payout history
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    // Calculate total sales (paid/confirmed/processing/shipped/delivered orders)
    const { data: salesData } = await supabase
      .from("store_orders")
      .select("total_amount, commission_amount")
      .eq("merchant_id", auth.sub)
      .in("status", ["paid", "confirmed", "processing", "shipped", "delivered"]);

    const totalSales = salesData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const totalCommissions = salesData?.reduce((sum, o) => sum + Number(o.commission_amount || 0), 0) || 0;

    // Calculate total paid out
    const { data: payoutsData } = await supabase
      .from("merchant_payouts")
      .select("net_amount")
      .eq("merchant_id", auth.sub)
      .eq("status", "completed");

    const totalPaid = payoutsData?.reduce((sum, p) => sum + Number(p.net_amount || 0), 0) || 0;
    const availableBalance = totalSales - totalCommissions - totalPaid;

    // Payout history
    const { data: payouts } = await supabase
      .from("merchant_payouts")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json(
      {
        earnings: {
          total_sales: totalSales,
          total_commissions: totalCommissions,
          total_paid: totalPaid,
          available_balance: Math.max(0, availableBalance),
        },
        payouts: payouts || [],
      },
      { headers }
    );
  } catch (err) {
    console.error("[Payouts] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500, headers });
  }
}

const requestPayoutSchema = z.object({
  amount: z.number().positive(),
  payout_method: z.string().max(50).default("wallet"),
  notes: z.string().max(2000).optional(),
});

// POST /api/payouts - Merchant: request payout
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
    const parsed = requestPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { amount, payout_method, notes } = parsed.data;

    // Calculate available balance
    const { data: salesData } = await supabase
      .from("store_orders")
      .select("total_amount, commission_amount")
      .eq("merchant_id", auth.sub)
      .in("status", ["paid", "confirmed", "processing", "shipped", "delivered"]);

    const totalSales = salesData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const totalCommissions = salesData?.reduce((sum, o) => sum + Number(o.commission_amount || 0), 0) || 0;

    const { data: payoutsData } = await supabase
      .from("merchant_payouts")
      .select("net_amount")
      .eq("merchant_id", auth.sub)
      .eq("status", "completed");

    const totalPaid = payoutsData?.reduce((sum, p) => sum + Number(p.net_amount || 0), 0) || 0;
    const availableBalance = totalSales - totalCommissions - totalPaid;

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: NLe ${availableBalance.toFixed(2)}` },
        { status: 400, headers }
      );
    }

    // Calculate fee
    const fee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100;
    const netAmount = amount - fee;
    const reference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Create payout record
    const { data: payout, error: insertError } = await supabase
      .from("merchant_payouts")
      .insert({
        merchant_id: auth.sub,
        amount,
        fee,
        net_amount: netAmount,
        status: "processing",
        payout_method,
        reference,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Credit merchant wallet
    const walletResult = await creditWallet(
      auth.sub,
      netAmount,
      `Store payout: ${reference}`,
      payout.id
    );

    if (walletResult.data?.transaction_id) {
      await supabase
        .from("merchant_payouts")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", payout.id);

      // Notify (non-blocking)
      notifyPayoutCompleted(auth.sub, netAmount).catch(() => {});

      return NextResponse.json(
        {
          payout: { ...payout, status: "completed" },
          transaction_id: walletResult.data.transaction_id,
        },
        { status: 201, headers }
      );
    } else {
      await supabase
        .from("merchant_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payout.id);

      return NextResponse.json(
        { error: walletResult.error || "Wallet credit failed" },
        { status: 500, headers }
      );
    }
  } catch (err) {
    console.error("[Payouts] POST error:", err);
    return NextResponse.json({ error: "Failed to process payout" }, { status: 500, headers });
  }
}
