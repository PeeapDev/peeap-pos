/**
 * R2 Upload Utility — Uploads files to Cloudflare R2 using AWS Signature V4.
 * Used for receipt PDFs and other programmatic uploads.
 */

// All R2 config comes from env — no hardcoded account ids / bucket URLs in source.
const R2_BUCKET = process.env.R2_BUCKET || "peeap-images";
const R2_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * Upload a buffer to Cloudflare R2 and return the public URL.
 * Returns null if upload fails or R2 is not configured.
 */
export async function uploadToR2(
  buffer: ArrayBuffer,
  key: string,
  contentType: string
): Promise<string | null> {
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID || !R2_PUBLIC_URL) {
    console.warn("[R2] Not configured — skipping upload");
    return null;
  }

  try {
    const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.slice(0, 8);

    const region = "auto";
    const service = "s3";
    const credential = `${R2_ACCESS_KEY}/${shortDate}/${region}/${service}/aws4_request`;

    const payloadHash = await sha256Hex(buffer);
    const canonicalHeaders =
      `content-type:${contentType}\n` +
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

    const canonicalRequestHash = await sha256Hex(
      new TextEncoder().encode(canonicalRequest)
    );

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      dateStamp,
      `${shortDate}/${region}/${service}/aws4_request`,
      canonicalRequestHash,
    ].join("\n");

    const signingKey = await getSignatureKey(R2_SECRET_KEY, shortDate, region, service);
    const signature = await hmacHex(signingKey, new TextEncoder().encode(stringToSign));

    const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateStamp,
        Authorization: authorization,
      },
      body: buffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[R2] Upload failed:", res.status, errText);
      return null;
    }

    return `${R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("[R2] Upload error:", err);
    return null;
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
