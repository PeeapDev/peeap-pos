/**
 * POST /api/webhooks/checkout-paid
 *
 * Called by Card / api.peeap.com (and Terminal) when a checkout session for
 * a POS charge flips to paid. Push-based counterpart to the settle-payments
 * cron: it makes a payment durable without the cashier UI being open.
 *
 * Two shapes of charge land here:
 *
 *  A. Marketplace order — a `store_orders` row already exists (created by
 *     POST /api/checkout) with payment_method mobile_money / peeap_checkout
 *     and is still `pending`. We CLAIM it (atomic pending→paid) and, if we
 *     win the claim, perform the full settlement: credit the merchant wallet
 *     and commit the reserved stock — exactly what the cron does, guarded by
 *     the same mutex so the two can't double-settle.
 *
 *  B. Terminal / scan-pay charge — no order row exists (ad-hoc keypad or
 *     cart amount, order_id like `pos_…`). Funds already moved wallet→wallet
 *     at scan time, so we DON'T credit again; we just write a durable paid
 *     receipt and decrement inventory for any catalog line items (these were
 *     never reserved, so sellStock, not commitStock).
 *
 * Auth: shared SERVICE_SECRET in `x-service-secret`, compared in constant
 * time. If the caller also sends `x-signature` (HMAC-SHA256 of the raw body
 * keyed by SERVICE_SECRET) we verify it; flip REQUIRE_SIGNATURE once the
 * caller always signs.
 *
 * Idempotency: a retried webhook is deduped by the order's paid state and,
 * for terminal receipts, by the UNIQUE(checkout_session_id) index.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { commitStock, sellStock } from "@/lib/stock";
import { creditWallet } from "@/lib/api-client";
import { timingSafeEqual, verifyHmac } from "@/lib/security";
import { generateReceiptPDF } from "@/lib/receipt-pdf";
import { uploadToR2 } from "@/lib/r2";
import { sendNotification } from "@/lib/notification-client";

const REQUIRE_SIGNATURE = process.env.REQUIRE_WEBHOOK_SIGNATURE === "true";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const expected = process.env.SERVICE_SECRET || "";
  const provided = request.headers.get("x-service-secret") || "";

  // Read the raw body once — needed for HMAC verification before parsing.
  const rawBody = await request.text();

  if (!expected || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const signature =
    request.headers.get("x-signature") ||
    request.headers.get("x-webhook-signature") ||
    "";
  if (signature) {
    if (!(await verifyHmac(rawBody, signature, expected))) {
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    }
  } else if (REQUIRE_SIGNATURE) {
    return NextResponse.json({ error: "signature_required" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId = String(body.session_id || "").trim();
  const orderId = String(body.order_id || "").trim();
  const amount = Number(body.amount || 0);
  const storeId = String(body.store_id || "").trim();
  const paidByUserId = (body.paid_by_user_id as string) || null;
  const paidAt = (body.paid_at as string) || new Date().toISOString();
  const lineItems: Array<{
    product_id?: string;
    qty?: number;
    name?: string;
    price?: number;
  }> = Array.isArray(body.line_items)
    ? (body.line_items as Array<{
        product_id?: string;
        qty?: number;
        name?: string;
        price?: number;
      }>)
    : [];

  if (!sessionId || !storeId) {
    return NextResponse.json(
      { error: "session_id_and_store_id_required" },
      { status: 400 }
    );
  }

  // ── Find a pre-existing order for this charge ──────────────────────────
  // Match priority: checkout_session_id, then payment_reference, then a real
  // order_id (only if it looks like a UUID — terminal order_ids are `pos_…`).
  type OrderRow = {
    id: string;
    status: string | null;
    merchant_id: string | null;
    total_amount: number | null;
    payment_reference: string | null;
  };
  const cols = "id, status, merchant_id, total_amount, payment_reference";

  let existing: OrderRow | null = null;
  for (const lookup of [
    () => supabase.from("store_orders").select(cols).eq("checkout_session_id", sessionId).maybeSingle(),
    () => supabase.from("store_orders").select(cols).eq("payment_reference", sessionId).maybeSingle(),
    () =>
      UUID_RE.test(orderId)
        ? supabase.from("store_orders").select(cols).eq("id", orderId).maybeSingle()
        : Promise.resolve({ data: null }),
  ]) {
    const { data } = (await lookup()) as { data: OrderRow | null };
    if (data) {
      existing = data;
      break;
    }
  }

  // ── A. Marketplace order ───────────────────────────────────────────────
  if (existing) {
    if (existing.status === "paid" || existing.status === "confirmed") {
      return NextResponse.json({ ok: true, deduped: true, order_id: existing.id });
    }

    // Atomic claim: only the caller that flips pending→paid settles it.
    const { data: claimed } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        paid_at: paidAt,
        paid_by_user_id: paidByUserId,
        checkout_session_id: sessionId,
        payment_reference: existing.payment_reference || sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("status", "pending")
      .select("id");

    if (!claimed || claimed.length === 0) {
      // Lost the race — another process (cron / pay route) settled it.
      return NextResponse.json({ ok: true, deduped: true, order_id: existing.id });
    }

    // Won the claim → full settlement. creditWallet is idempotent on the
    // order id reference, matching the cron, so a same-reference retry is safe.
    if (existing.merchant_id && (existing.total_amount || 0) > 0) {
      const credit = await creditWallet(
        existing.merchant_id,
        Number(existing.total_amount),
        `Sale: Order ${existing.id}`,
        existing.id
      );
      if (credit.error) {
        console.error(
          `[checkout-paid] merchant credit failed for order ${existing.id}:`,
          credit.error
        );
        await supabase
          .from("store_orders")
          .update({
            metadata: {
              reconciliation_needed: true,
              reconciliation_reason: "webhook_settlement_merchant_credit_failed",
              failed_at: new Date().toISOString(),
            },
          })
          .eq("id", existing.id);
      }
    }

    // Commit reserved stock for this order's items.
    const { data: items } = await supabase
      .from("store_order_items")
      .select("product_id, quantity")
      .eq("order_id", existing.id);
    const stockItems = (items || [])
      .filter((i) => i.product_id && i.quantity > 0)
      .map((i) => ({ product_id: i.product_id as string, quantity: i.quantity }));
    if (stockItems.length) await commitStock(stockItems);

    return NextResponse.json({ ok: true, order_id: existing.id, settled: true });
  }

  // ── B. Terminal / scan-pay receipt ─────────────────────────────────────
  // No order row. Funds already moved at scan time; write a durable paid
  // receipt. UNIQUE(checkout_session_id) dedupes retries: on conflict we
  // re-read the existing receipt and return it.
  const { data: store } = await supabase
    .from("stores")
    .select("merchant_id, name, logo_url, address, phone")
    .eq("id", storeId)
    .maybeSingle();
  const storeRow = store as
    | { merchant_id?: string; name?: string; logo_url?: string; address?: string; phone?: string }
    | null;

  const receiptNumber = `POS-${sessionId.slice(-10).toUpperCase()}`;
  const { data: created, error: insertErr } = await supabase
    .from("store_orders")
    .insert({
      store_id: storeId,
      merchant_id: storeRow?.merchant_id || storeId,
      order_number: receiptNumber,
      customer_name: "POS Customer",
      customer_phone: "",
      total_amount: amount,
      payment_method: "peeap_wallet",
      payment_reference: sessionId,
      checkout_session_id: sessionId,
      paid_by_user_id: paidByUserId,
      status: "paid",
      paid_at: paidAt,
      order_type: "pos",
    })
    .select("id")
    .maybeSingle();

  let finalOrderId = (created as { id?: string } | null)?.id || null;

  if (insertErr) {
    // Most likely a UNIQUE(checkout_session_id) collision = duplicate
    // delivery. Treat as success and return the existing receipt id.
    const { data: dupe } = await supabase
      .from("store_orders")
      .select("id")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json({ ok: true, deduped: true, order_id: dupe.id });
    }
    console.error("[checkout-paid] receipt insert failed:", insertErr);
    return NextResponse.json({ error: "receipt_insert_failed" }, { status: 500 });
  }

  // Decrement inventory for catalog line items (never reserved → sellStock).
  const stockItems = lineItems
    .filter((i) => i.product_id && (i.qty || 0) > 0)
    .map((i) => ({ product_id: i.product_id as string, quantity: i.qty as number }));
  if (stockItems.length) await sellStock(stockItems);

  // Instant receipt to the PAYER as verification. Best-effort: a failure here
  // must never fail the webhook — the money already moved. api.peeap.com fires
  // this webhook fire-and-forget, so awaiting is safe (and ensures the work
  // completes before the function suspends).
  if (paidByUserId) {
    await deliverPayerReceipt({
      payerUserId: paidByUserId,
      sellerUserId: storeRow?.merchant_id || null,
      storeId,
      storeName: storeRow?.name || "Store",
      storeLogoUrl: storeRow?.logo_url || null,
      storeAddress: storeRow?.address || null,
      storePhone: storeRow?.phone || null,
      receiptNumber,
      amount,
      lineItems,
    }).catch((e) =>
      console.error("[checkout-paid] payer receipt delivery failed:", e)
    );
  }

  return NextResponse.json({ ok: true, order_id: finalOrderId, settled: true });
}

/**
 * Generate a receipt PDF, upload it to R2, and notify the payer with a link —
 * their verification that the in-person payment went through. Entirely
 * best-effort; every step is independently guarded.
 */
async function deliverPayerReceipt(params: {
  payerUserId: string;
  sellerUserId: string | null;
  storeId: string;
  storeName: string;
  storeLogoUrl: string | null;
  storeAddress: string | null;
  storePhone: string | null;
  receiptNumber: string;
  amount: number;
  lineItems: Array<{ product_id?: string; qty?: number; name?: string; price?: number }>;
}) {
  const items = params.lineItems
    .filter((i) => (i.qty || 0) > 0)
    .map((i) => ({
      product_name: i.name || "Item",
      quantity: Number(i.qty) || 1,
      unit_price: Number(i.price) || 0,
      total_price: (Number(i.qty) || 1) * (Number(i.price) || 0),
    }));

  // Receipt PDF + R2 upload (so the payer gets a durable, shareable document).
  let receiptUrl: string | null = null;
  try {
    const pdf = await generateReceiptPDF({
      order_number: params.receiptNumber,
      store_name: params.storeName,
      customer_name: "Customer",
      items: items.length
        ? items
        : [
            {
              product_name: "Payment",
              quantity: 1,
              unit_price: params.amount,
              total_price: params.amount,
            },
          ],
      subtotal: params.amount,
      tax_amount: 0,
      delivery_fee: 0,
      total_amount: params.amount,
      payment_method: "Peeap Wallet",
      order_type: "pos",
      store_logo_url: params.storeLogoUrl,
      store_address: params.storeAddress,
      store_phone: params.storePhone,
      tracking_url: `https://store.peeap.com/receipt/${params.receiptNumber}`,
    });
    receiptUrl = await uploadToR2(
      pdf,
      `receipts/${params.receiptNumber}/${params.payerUserId}.pdf`,
      "application/pdf"
    );
  } catch (err) {
    console.error("[checkout-paid] receipt PDF failed (will still notify):", err);
  }

  // In-app notification to the payer — universal, unlike chat which needs an
  // ecommerce thread. Links to the receipt PDF when we have one.
  await sendNotification({
    user_id: params.payerUserId,
    type: "payment_receipt",
    title: "Payment Receipt",
    message: `You paid NLe ${params.amount.toLocaleString()} to ${params.storeName}.`,
    action_url: receiptUrl || undefined,
    source_service: "store",
    source_id: params.receiptNumber,
    priority: "high",
  }).catch(() => {});
}
