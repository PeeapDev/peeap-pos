/**
 * Image Upload API — Uploads product images to Cloudflare R2.
 *
 * POST /api/upload
 *   - Multipart form: file (image)
 *   - Returns: { url, id, thumbnail, medium }
 *
 * Images served via R2 public URL:
 *   https://pub-26fe0488ce234b198ea67133103ca1b4.r2.dev/{key}
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { authenticateRequest } from "@/lib/auth";

const R2_BUCKET = "peeap-images";
const R2_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "a82104182bb421661f32ba45592d4241";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://pub-26fe0488ce234b198ea67133103ca1b4.r2.dev";
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Strict raster-image allowlist. Deliberately excludes image/svg+xml — SVGs
// can carry <script>, and these are served from a public R2 origin, so an
// uploaded SVG is a stored-XSS vector. Keyed by MIME → allowed extensions.
const ALLOWED_IMAGE_TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/avif": ["avif"],
};

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return NextResponse.json(
      { error: "Image upload not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY." },
      { status: 503, headers }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Send multipart/form-data with a file field" },
        { status: 400, headers }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400, headers });
    }

    const allowedExts = ALLOWED_IMAGE_TYPES[file.type];
    if (!allowedExts) {
      return NextResponse.json(
        { error: "Unsupported image type. Allowed: JPEG, PNG, WebP, GIF, AVIF." },
        { status: 400, headers }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400, headers });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400, headers }
      );
    }

    // Derive extension from the validated MIME type, not the client-supplied
    // filename — never trust the upload's own extension for the stored key.
    const ext = allowedExts[0];
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const key = `products/${auth.sub}/${timestamp}-${random}.${ext}`;

    // Upload to R2 using S3-compatible API with AWS Signature V4
    const fileBuffer = await file.arrayBuffer();
    const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;

    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.slice(0, 8);

    // AWS Sig V4 signing
    const region = "auto";
    const service = "s3";
    const credential = `${R2_ACCESS_KEY}/${shortDate}/${region}/${service}/aws4_request`;

    // Create canonical request
    const payloadHash = await sha256Hex(fileBuffer);
    const canonicalHeaders =
      `content-type:${file.type}\n` +
      `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${dateStamp}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = [
      "PUT",
      `/${R2_BUCKET}/${key}`,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));

    // Create string to sign
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      dateStamp,
      `${shortDate}/${region}/${service}/aws4_request`,
      canonicalRequestHash,
    ].join("\n");

    // Calculate signature
    const signingKey = await getSignatureKey(R2_SECRET_KEY, shortDate, region, service);
    const signature = await hmacHex(signingKey, new TextEncoder().encode(stringToSign));

    const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const r2Res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateStamp,
        Authorization: authorization,
      },
      body: fileBuffer,
    });

    if (!r2Res.ok) {
      const errText = await r2Res.text();
      console.error("[Upload] R2 error:", r2Res.status, errText);
      return NextResponse.json(
        { error: "Failed to upload image to storage" },
        { status: 502, headers }
      );
    }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json(
      {
        id: key,
        url: publicUrl,
        thumbnail: publicUrl,
        medium: publicUrl,
      },
      { headers }
    );
  } catch (err) {
    console.error("[Upload] Error:", err);
    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 500, headers }
    );
  }
}

// ── AWS Signature V4 helpers ──

async function sha256Hex(data: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: BufferSource, data: BufferSource): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, data);
}

async function hmacHex(key: BufferSource, data: BufferSource): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate = await hmac(enc.encode("AWS4" + secretKey), enc.encode(dateStamp));
  const kRegion = await hmac(kDate, enc.encode(region));
  const kService = await hmac(kRegion, enc.encode(service));
  return hmac(kService, enc.encode("aws4_request"));
}
