import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { debitWallet, creditWallet } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import { enhanceImageSchema } from "@/lib/validation";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

const ENHANCEMENT_PRICING: Record<string, number> = {
  upscale: 5,
  remove_bg: 3,
  enhance: 5,
  auto_crop: 1,
};

const REPLICATE_MODELS: Record<string, { version: string }> = {
  upscale: {
    version:
      "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
  },
  remove_bg: {
    version:
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
  },
  enhance: {
    version:
      "tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c",
  },
};

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers }
    );
  }

  const parsed = enhanceImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers }
    );
  }

  const { image_url, enhancement_type } = parsed.data;
  const cost = ENHANCEMENT_PRICING[enhancement_type];

  // Fail closed if Replicate isn't configured for non-trivial enhancements.
  // auto_crop is client-side only so it works without the token.
  if (enhancement_type !== "auto_crop" && !REPLICATE_API_TOKEN) {
    return NextResponse.json(
      {
        error: "AI image enhancement is not configured on this deployment",
        details: "Server is missing REPLICATE_API_TOKEN. No charge was made.",
      },
      { status: 503, headers }
    );
  }

  // Debit wallet
  const debitRef = `ai-enhance-${enhancement_type}-${Date.now()}`;
  const debitResult = await debitWallet(
    auth.sub,
    cost,
    `AI image ${enhancement_type} enhancement`,
    debitRef
  );

  if (debitResult.error) {
    return NextResponse.json(
      {
        error: "Insufficient balance or wallet error",
        details: debitResult.error,
      },
      { status: 402, headers }
    );
  }

  try {
    // auto_crop: no AI needed - return original with crop metadata
    if (enhancement_type === "auto_crop") {
      return NextResponse.json(
        {
          enhanced_url: image_url,
          original_url: image_url,
          enhancement_type,
          cost,
          metadata: { auto_crop: true, note: "Client-side crop applied" },
        },
        { headers }
      );
    }

    // (No-token path is handled at the top of the request before debit.)

    // Call Replicate API
    const model = REPLICATE_MODELS[enhancement_type];
    const [owner_model, version] = model.version.split(":");

    const createRes = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version,
          input: {
            image: image_url,
            ...(enhancement_type === "upscale" ? { scale: 2 } : {}),
          },
        }),
      }
    );

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("Replicate create failed:", createRes.status, errBody);
      throw new Error(`Replicate API error: ${createRes.status}`);
    }

    let prediction = await createRes.json();

    // Poll for completion if not already done (max 30 seconds)
    if (prediction.status !== "succeeded" && prediction.status !== "failed") {
      const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
      const maxAttempts = 15;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pollRes = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        });

        if (!pollRes.ok) {
          throw new Error(`Replicate poll error: ${pollRes.status}`);
        }

        prediction = await pollRes.json();

        if (prediction.status === "succeeded" || prediction.status === "failed") {
          break;
        }
      }
    }

    if (prediction.status === "failed") {
      throw new Error(prediction.error || "AI enhancement failed");
    }

    if (prediction.status !== "succeeded") {
      throw new Error("AI enhancement timed out after 30 seconds");
    }

    // Extract the output URL
    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    if (!outputUrl || typeof outputUrl !== "string") {
      throw new Error("No output URL from AI model");
    }

    // Download and upload to Supabase Storage
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error("Failed to download enhanced image");
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const fileName = `enhanced/${auth.sub}/${Date.now()}-${enhancement_type}.png`;
    const supabase = getSupabase();

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, Buffer.from(imageBuffer), {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      // Return the Replicate URL directly as fallback
      return NextResponse.json(
        {
          enhanced_url: outputUrl,
          original_url: image_url,
          enhancement_type,
          cost,
        },
        { headers }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(fileName);

    return NextResponse.json(
      {
        enhanced_url: publicUrl,
        original_url: image_url,
        enhancement_type,
        cost,
      },
      { headers }
    );
  } catch (err) {
    console.error("AI enhance error:", err);

    // Refund the wallet on failure
    try {
      await creditWallet(
        auth.sub,
        cost,
        `Refund: AI ${enhancement_type} enhancement failed`,
        `refund-${debitRef}`
      );
    } catch (refundErr) {
      console.error("Failed to refund wallet:", refundErr);
    }

    return NextResponse.json(
      {
        error: "Enhancement failed",
        details: err instanceof Error ? err.message : "Unknown error",
        refunded: true,
      },
      { status: 500, headers }
    );
  }
}
