import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { debitWallet, creditWallet } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import { generateImageSchema } from "@/lib/validation";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";
const GENERATION_COST = 10;

// Stable Diffusion XL model
const SDXL_VERSION =
  "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

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

  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers }
    );
  }

  const { prompt, product_name } = parsed.data;

  // Fail closed if Replicate isn't configured. Previously the route
  // debited the merchant's wallet first and then returned a placeholder
  // image — silently charging for a fake result. Check the env BEFORE
  // taking any money.
  if (!REPLICATE_API_TOKEN) {
    return NextResponse.json(
      {
        error: "AI image generation is not configured on this deployment",
        details: "Server is missing REPLICATE_API_TOKEN. No charge was made.",
      },
      { status: 503, headers }
    );
  }

  // Debit wallet
  const debitRef = `ai-generate-${Date.now()}`;
  const debitResult = await debitWallet(
    auth.sub,
    GENERATION_COST,
    `AI image generation: ${product_name}`,
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

    // Build a product photography prompt
    const fullPrompt = `Professional product photography of ${product_name}. ${prompt}. Clean white background, studio lighting, high resolution, commercial quality, sharp focus, centered composition.`;

    // Call Replicate with SDXL
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
          version: SDXL_VERSION,
          input: {
            prompt: fullPrompt,
            negative_prompt:
              "blurry, low quality, distorted, watermark, text overlay, cartoon, illustration, painting",
            width: 1024,
            height: 1024,
            num_outputs: 1,
            scheduler: "K_EULER",
            num_inference_steps: 30,
            guidance_scale: 7.5,
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

    // Poll for completion (max 30 seconds)
    if (prediction.status !== "succeeded" && prediction.status !== "failed") {
      const pollUrl =
        prediction.urls?.get ||
        `https://api.replicate.com/v1/predictions/${prediction.id}`;
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

        if (
          prediction.status === "succeeded" ||
          prediction.status === "failed"
        ) {
          break;
        }
      }
    }

    if (prediction.status === "failed") {
      throw new Error(prediction.error || "Image generation failed");
    }

    if (prediction.status !== "succeeded") {
      throw new Error("Image generation timed out after 30 seconds");
    }

    // Extract output URL
    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    if (!outputUrl || typeof outputUrl !== "string") {
      throw new Error("No output URL from AI model");
    }

    // Download and upload to Supabase Storage
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error("Failed to download generated image");
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const fileName = `generated/${auth.sub}/${Date.now()}.png`;
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
          generated_url: outputUrl,
          prompt,
          product_name,
          cost: GENERATION_COST,
        },
        { headers }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(fileName);

    return NextResponse.json(
      {
        generated_url: publicUrl,
        prompt,
        product_name,
        cost: GENERATION_COST,
      },
      { headers }
    );
  } catch (err) {
    console.error("AI generate error:", err);

    // Refund the wallet on failure
    try {
      await creditWallet(
        auth.sub,
        GENERATION_COST,
        `Refund: AI image generation failed`,
        `refund-${debitRef}`
      );
    } catch (refundErr) {
      console.error("Failed to refund wallet:", refundErr);
    }

    return NextResponse.json(
      {
        error: "Image generation failed",
        details: err instanceof Error ? err.message : "Unknown error",
        refunded: true,
      },
      { status: 500, headers }
    );
  }
}
