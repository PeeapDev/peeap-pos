import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import {
  openCashSessionSchema,
  cashSessionActionSchema,
} from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/cash-sessions — Get today's open session for the merchant
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
    const all = searchParams.get("all") === "true";

    if (all) {
      // Return recent sessions
      const limit = Math.min(
        parseInt(searchParams.get("limit") || "30"),
        100
      );
      const offset = parseInt(searchParams.get("offset") || "0");

      const { data, error, count } = await supabase
        .from("pos_cash_sessions")
        .select("*", { count: "exact" })
        .eq("merchant_id", auth.sub)
        .order("opened_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json(
        { sessions: data || [], total: count || 0 },
        { headers }
      );
    }

    // Default: return today's open session
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("pos_cash_sessions")
      .select("*")
      .eq("merchant_id", auth.sub)
      .eq("status", "open")
      .gte("opened_at", todayStart.toISOString())
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ session: data }, { headers });
  } catch (err) {
    console.error("Error fetching cash session:", err);
    return NextResponse.json(
      { error: "Failed to fetch cash session" },
      { status: 500, headers }
    );
  }
}

// POST /api/cash-sessions — Open a new cash session
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const parsed = openCashSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    // Check for an already-open session
    const { data: existing } = await supabase
      .from("pos_cash_sessions")
      .select("id")
      .eq("merchant_id", auth.sub)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A cash session is already open. Close it before opening a new one." },
        { status: 409, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_cash_sessions")
      .insert({
        merchant_id: auth.sub,
        opening_amount: parsed.data.opening_amount,
        current_amount: parsed.data.opening_amount,
        opened_by: parsed.data.opened_by || auth.email || auth.sub,
        notes: parsed.data.notes,
        status: "open",
        opened_at: new Date().toISOString(),
        cash_in_total: 0,
        cash_out_total: 0,
        sales_total: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error opening cash session:", err);
    return NextResponse.json(
      { error: "Failed to open cash session" },
      { status: 500, headers }
    );
  }
}

// PUT /api/cash-sessions?id=<uuid> — Close session or perform cash-in/cash-out
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const sessionId = new URL(request.url).searchParams.get("id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = cashSessionActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    // Fetch current session
    const { data: session, error: fetchError } = await supabase
      .from("pos_cash_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("merchant_id", auth.sub)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404, headers }
      );
    }

    if (session.status !== "open") {
      return NextResponse.json(
        { error: "Session is already closed" },
        { status: 400, headers }
      );
    }

    const { action, amount, closing_amount, notes, closed_by } = parsed.data;

    if (action === "close") {
      const updateData: Record<string, unknown> = {
        status: "closed",
        closing_amount: closing_amount ?? session.current_amount,
        closed_by: closed_by || auth.email || auth.sub,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.notes = session.notes
          ? `${session.notes}\nClose: ${notes}`
          : `Close: ${notes}`;
      }

      // Calculate expected vs actual difference
      const expectedAmount =
        (session.opening_amount || 0) +
        (session.sales_total || 0) +
        (session.cash_in_total || 0) -
        (session.cash_out_total || 0);
      updateData.expected_amount = expectedAmount;
      updateData.difference =
        (closing_amount ?? session.current_amount) - expectedAmount;

      const { data, error } = await supabase
        .from("pos_cash_sessions")
        .update(updateData)
        .eq("id", sessionId)
        .eq("merchant_id", auth.sub)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ session: data }, { headers });
    }

    if (action === "cash_in" || action === "cash_out") {
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Amount is required and must be positive" },
          { status: 400, headers }
        );
      }

      const isCashIn = action === "cash_in";
      const newCurrentAmount = isCashIn
        ? (session.current_amount || 0) + amount
        : (session.current_amount || 0) - amount;

      const updateData: Record<string, unknown> = {
        current_amount: Math.max(0, newCurrentAmount),
        updated_at: new Date().toISOString(),
      };

      if (isCashIn) {
        updateData.cash_in_total = (session.cash_in_total || 0) + amount;
      } else {
        updateData.cash_out_total = (session.cash_out_total || 0) + amount;
      }

      if (notes) {
        const entry = `${isCashIn ? "Cash In" : "Cash Out"}: ${amount} - ${notes}`;
        updateData.notes = session.notes
          ? `${session.notes}\n${entry}`
          : entry;
      }

      const { data, error } = await supabase
        .from("pos_cash_sessions")
        .update(updateData)
        .eq("id", sessionId)
        .eq("merchant_id", auth.sub)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ session: data }, { headers });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers }
    );
  } catch (err) {
    console.error("Error updating cash session:", err);
    return NextResponse.json(
      { error: "Failed to update cash session" },
      { status: 500, headers }
    );
  }
}
