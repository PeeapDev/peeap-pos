import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { getShippingQuote } from "@/lib/shipping-client";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const { pickup_city, delivery_city, package_size } = body;

    if (!pickup_city || !delivery_city) {
      return NextResponse.json(
        { error: "pickup_city and delivery_city are required" },
        { status: 400, headers }
      );
    }

    const quote = await getShippingQuote({
      pickup_city,
      delivery_city,
      package_size: package_size || "medium",
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Unable to get shipping quote" },
        { status: 503, headers }
      );
    }

    return NextResponse.json({ quote }, { headers });
  } catch (err) {
    console.error("[ShippingQuote] Error:", err);
    return NextResponse.json(
      { error: "Failed to get shipping quote" },
      { status: 500, headers }
    );
  }
}
