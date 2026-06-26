/**
 * POST /api/vendor/pos/charge/qr
 *
 * Cashier-side, NO hardware. Creates a Peeap checkout session for an
 * in-person sale and returns a QR the customer scans with their Peeap PWA
 * wallet app to pay wallet→wallet.
 *
 * Flow:
 *   1. Auth the vendor session; resolve their store (owner or approved staff)
 *   2. Create a `cs_` checkout session on api.peeap.com using the
 *      P2P/device-keypad routing: merchant_id=null + metadata.recipientId =
 *      store.merchant_id. scan-pay then credits that user's merchant/primary
 *      wallet (same routing HEMI scan-to-pay devices use). We also set
 *      metadata.store_id + line_items so api.peeap.com fires the
 *      checkout-paid webhook back to this POS to durably record the sale,
 *      decrement stock, and send the buyer a receipt.
 *   3. Return { session_id, qr_url, expires_at, amount }. qr_url is the
 *      popup.html URL the PWA scanner already recognises — no client changes.
 *
 * Polling: the cashier UI polls /api/vendor/pos/charge/qr/status/:sessionId.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { enforceIpRateLimit } from "@/lib/rate-limit";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.peeap.com";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

interface QrLineItem {
  product_id?: string;
  name?: string;
  qty?: number;
  price?: number;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const limited = await enforceIpRateLimit(request, "charge-qr", 30, 60);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers }
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number((body as any).amount || 0);
  const description = String((body as any).description || "").slice(0, 200) || undefined;
  const rawItems: QrLineItem[] = Array.isArray((body as any).line_items)
    ? (body as any).line_items.slice(0, 100)
    : [];

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400, headers });
  }

  // Resolve the caller's store: either the owner, or an approved staff member.
  let store: { id: string; merchant_id: string; name: string; logo_url?: string | null } | null =
    null;

  const { data: owned } = await supabase
    .from("stores")
    .select("id, merchant_id, name, logo_url")
    .eq("merchant_id", auth.sub)
    .maybeSingle();

  if (owned) {
    store = owned as any;
  } else {
    // Approved staff on some store?
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("store_id")
      .eq("user_id", auth.sub)
      .eq("status", "approved")
      .is("removed_at", null)
      .maybeSingle();
    if (staffRow?.store_id) {
      const { data: staffStore } = await supabase
        .from("stores")
        .select("id, merchant_id, name, logo_url")
        .eq("id", (staffRow as any).store_id)
        .maybeSingle();
      if (staffStore) store = staffStore as any;
    }
  }

  if (!store) {
    return NextResponse.json({ error: "no_store" }, { status: 404, headers });
  }

  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    return NextResponse.json(
      { error: "service_secret_not_configured" },
      { status: 500, headers }
    );
  }

  // Normalise line items: keep product_id + qty for the webhook's inventory
  // decrement, plus name/price for the receipt.
  const lineItems = rawItems
    .filter((i) => (i.qty || 0) > 0)
    .map((i) => ({
      product_id: i.product_id || null,
      name: i.name || "Item",
      qty: Number(i.qty) || 1,
      price: Number(i.price) || 0,
    }));

  // Create the checkout session on api.peeap.com.
  let session: { sessionId?: string; url?: string; expiresAt?: string; error?: string };
  try {
    const r = await fetch(`${API_BASE_URL}/api/checkout/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify({
        // P2P/device-keypad routing → credits store.merchant_id's wallet.
        recipientId: store.merchant_id,
        recipientName: store.name,
        amount,
        currency: "SLE",
        description: description || `Payment to ${store.name}`,
        merchantName: store.name,
        merchantLogoUrl: store.logo_url || undefined,
        metadata: {
          store_id: store.id,
          source: "pos_scan_qr",
          cashier_id: auth.sub,
          line_items: lineItems,
        },
      }),
    });
    session = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    if (!r.ok || !session.sessionId) {
      return NextResponse.json(
        { error: "session_create_failed", detail: session.error || `HTTP ${r.status}` },
        { status: 502, headers }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "api_unreachable", detail: err?.message },
      { status: 502, headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      session_id: session.sessionId,
      // The popup.html URL the Peeap PWA scanner already recognises.
      qr_url: session.url,
      expires_at: session.expiresAt,
      amount,
      store: { id: store.id, name: store.name },
    },
    { headers }
  );
}
