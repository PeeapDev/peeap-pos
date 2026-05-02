/**
 * Vendor-facing staff item operations.
 *
 *   PATCH  /api/vendor/pos/staff/:id  { role }   — change role (owner/manager/cashier)
 *   DELETE /api/vendor/pos/staff/:id              — remove staff (sets removed_at)
 *
 * Auth: vendor session, store-owner only. Removal closes any open shift on
 * any device this user is currently signed in on so a stuck shift doesn't
 * block the next cashier from claiming.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

async function getOwnedStore(userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("merchant_id", userId)
    .maybeSingle();
  return data as { id: string } | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) return NextResponse.json({ error: "no_store" }, { status: 404, headers });

  const body = await request.json().catch(() => ({}));
  const role = String(body.role || "").toLowerCase();
  if (!["owner", "manager", "cashier"].includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400, headers });
  }

  const { data: row, error } = await supabase
    .from("store_staff")
    .update({ role })
    .eq("id", params.id)
    .eq("store_id", store.id)
    .is("removed_at", null)
    .select("id, user_id, role, status")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "staff_not_found" }, { status: 404, headers });
  }
  return NextResponse.json({ ok: true, staff: row }, { headers });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) return NextResponse.json({ error: "no_store" }, { status: 404, headers });

  const { data: existing } = await supabase
    .from("store_staff")
    .select("id, user_id")
    .eq("id", params.id)
    .eq("store_id", store.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "staff_not_found" }, { status: 404, headers });
  }
  // Owner can't be self-removed via this endpoint — they delete the
  // store entirely (separate flow) or transfer ownership first.
  if ((existing as any).user_id === auth.sub) {
    return NextResponse.json(
      { error: "cannot_remove_self" },
      { status: 400, headers }
    );
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("store_staff")
    .update({ removed_at: nowIso, removed_by: auth.sub, status: "removed" })
    .eq("id", params.id);

  // Close any open shift this staff currently holds — otherwise a removed
  // cashier's open shift would block the next legitimate staff from
  // claiming the device.
  await supabase
    .from("store_device_shifts")
    .update({ ended_at: nowIso, metadata: { closed_via: "staff_removed" } })
    .eq("staff_user_id", (existing as any).user_id)
    .is("ended_at", null);

  // Clear claimed_by_user_id on any device this staff currently has so a
  // re-claim by another approved staff isn't blocked by 'device_in_use'.
  await supabase
    .from("store_devices")
    .update({ claimed_by_user_id: null })
    .eq("claimed_by_user_id", (existing as any).user_id)
    .eq("owner_store_id", store.id);

  return NextResponse.json({ ok: true }, { headers });
}
