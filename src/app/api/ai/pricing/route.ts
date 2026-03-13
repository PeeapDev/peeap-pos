import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";

const AI_PRICING = {
  upscale: 5,
  remove_bg: 3,
  enhance: 5,
  auto_crop: 1,
  generate: 10,
  currency: "NLe",
} as const;

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  return NextResponse.json(AI_PRICING, { headers });
}
