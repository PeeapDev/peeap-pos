/**
 * POST /api/vendor/pos/charge
 *
 * Cashier-side. Called from the marketplace POS dashboard when the
 * cashier taps "Charge" on a cart.
 *
 * Body:
 *   { device_sn, amount, line_items?, order_id? }
 *
 * What we do:
 *   1. Auth the vendor session, find their store
 *   2. Verify the device belongs to the store and the caller is approved
 *      staff (or the owner) — single-user devices are not chargeable via
 *      this endpoint, only org devices
 *   3. Generate or accept order_id
 *   4. Forward to terminal.peeap.com/api/checkout/push-to-device with
 *      SERVICE_SECRET — Terminal creates the checkout session in Card
 *      and paints the amount + QR on the bound device
 *   5. Return { session_id, scan_url } to the cashier UI for polling
 *
 * Polling: the cashier UI polls /api/vendor/pos/charge/status/:sessionId
 * (separate endpoint, follow-up commit) or watches store_orders for the
 * paid state if order_id maps to a real order row.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

const TERMINAL_BASE = process.env.TERMINAL_BASE_URL || "https://terminal.peeap.com";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// DELETE /api/vendor/pos/charge { session_id }
//
// Cashier cancel — fires when they tap "Cancel" while waiting for the
// customer to scan. Best-effort: we forward to Terminal which voids the
// session and dismisses the screen. The client treats failure as a no-op
// since the session also expires on its own.
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await request.json().catch(() => ({}));
  const sessionId = String((body as any).session_id || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400, headers });
  }

  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    return NextResponse.json({ error: "service_secret_not_configured" }, { status: 500, headers });
  }

  try {
    await fetch(`${TERMINAL_BASE}/api/checkout/cancel-on-device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-secret": serviceSecret,
      },
      body: JSON.stringify({ session_id: sessionId, cancelled_by_user_id: auth.sub }),
    });
  } catch {
    // swallow — session will expire on its own
  }

  return NextResponse.json({ ok: true }, { headers });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await request.json().catch(() => ({}));
  const deviceSn = String((body as any).device_sn || "").trim();
  const amount = Number((body as any).amount || 0);
  const lineItems = Array.isArray((body as any).line_items)
    ? (body as any).line_items.slice(0, 100)
    : null;
  const inOrderId = (body as any).order_id ? String((body as any).order_id) : null;

  if (!deviceSn) {
    return NextResponse.json({ error: "device_sn_required" }, { status: 400, headers });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400, headers });
  }

  // The caller's store
  const { data: store } = await supabase
    .from("stores")
    .select("id, merchant_id, name")
    .eq("merchant_id", auth.sub)
    .maybeSingle();

  // If the caller isn't the store's merchant_id, they may still be staff.
  // Find any store where the caller is approved staff AND the requested
  // device belongs.
  let targetStoreId: string | null = (store as any)?.id || null;
  let targetStoreName: string | null = (store as any)?.name || null;

  if (!targetStoreId) {
    // Caller isn't a store owner — check if they're staff on a store that
    // owns this device. We do the joined lookup in two queries because
    // PostgREST doesn't expose the store_devices ↔ store_staff join
    // shape we need without a view.
    const { data: device } = await supabase
      .from("store_devices")
      .select("owner_store_id")
      .eq("device_sn", deviceSn)
      .maybeSingle();
    if (!device || !(device as any).owner_store_id) {
      return NextResponse.json({ error: "device_not_org_owned" }, { status: 403, headers });
    }
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("role")
      .eq("store_id", (device as any).owner_store_id)
      .eq("user_id", auth.sub)
      .eq("status", "approved")
      .is("removed_at", null)
      .maybeSingle();
    if (!staffRow) {
      return NextResponse.json({ error: "not_authorized_for_device" }, { status: 403, headers });
    }
    const { data: staffStore } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", (device as any).owner_store_id)
      .maybeSingle();
    targetStoreId = (staffStore as any)?.id || null;
    targetStoreName = (staffStore as any)?.name || null;
  } else {
    // Caller is the owner. Verify the device is theirs.
    const { data: device } = await supabase
      .from("store_devices")
      .select("owner_store_id")
      .eq("device_sn", deviceSn)
      .maybeSingle();
    if (!device || (device as any).owner_store_id !== targetStoreId) {
      return NextResponse.json({ error: "device_not_owned_by_store" }, { status: 403, headers });
    }
  }

  if (!targetStoreId) {
    return NextResponse.json({ error: "no_store" }, { status: 404, headers });
  }

  const orderId = inOrderId || `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Cross-service call to Terminal. SERVICE_SECRET is shared via env.
  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    return NextResponse.json({ error: "service_secret_not_configured" }, { status: 500, headers });
  }

  let upstream: { ok: boolean; session_id?: string; scan_url?: string; expires_at?: string; error?: string };
  try {
    const r = await fetch(`${TERMINAL_BASE}/api/checkout/push-to-device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-secret": serviceSecret,
      },
      body: JSON.stringify({
        device_sn: deviceSn,
        amount,
        order_id: orderId,
        line_items: lineItems,
        store_id: targetStoreId,
        return_url: `${origin || "https://store.peeap.com"}/dashboard/pos/orders/${encodeURIComponent(orderId)}`,
      }),
    });
    upstream = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
    if (!r.ok || !upstream.ok) {
      return NextResponse.json(
        { error: "terminal_call_failed", detail: upstream.error || `HTTP ${r.status}` },
        { status: 502, headers }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "terminal_unreachable", detail: err?.message },
      { status: 502, headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      order_id: orderId,
      session_id: upstream.session_id,
      scan_url: upstream.scan_url,
      expires_at: upstream.expires_at,
      store: { id: targetStoreId, name: targetStoreName },
    },
    { headers }
  );
}
