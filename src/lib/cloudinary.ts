/**
 * Cloudinary fetch-mode helper.
 *
 * Routes an external image URL (e.g. our R2 bucket) through Cloudinary's
 * fetch endpoint so we get on-the-fly resize + auto-format + auto-quality
 * without migrating storage.
 *
 * When NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is unset, returns the original URL —
 * so the app works exactly as before until the env var is configured.
 *
 * Usage:
 *   <Image src={cld(product.image_url, 'card')} ... />
 *   <Image src={cld(product.image_url, { w: 800, q: 80 })} ... />
 */

const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  process.env.CLOUDINARY_CLOUD_NAME ||
  "";

type Preset = "thumb" | "card" | "detail" | "hero" | "logo" | "banner";

type Opts = {
  w?: number;
  h?: number;
  q?: number | "auto";
  f?: "auto" | "webp" | "avif" | "jpg" | "png";
  c?: "fill" | "fit" | "limit" | "pad" | "scale";
  g?: "auto" | "face" | "center";
  dpr?: "auto" | number;
};

const PRESETS: Record<Preset, Opts> = {
  thumb: { w: 120, h: 120, c: "fill" },
  card: { w: 400, h: 400, c: "fill" },
  detail: { w: 1200, c: "limit" },
  hero: { w: 1600, c: "limit" },
  logo: { w: 96, h: 96, c: "fill" },
  banner: { w: 1600, h: 533, c: "fill" },
};

function buildTransform(opts: Opts): string {
  const parts: string[] = ["f_auto", "q_auto", "dpr_auto"];
  if (opts.w) parts.push(`w_${opts.w}`);
  if (opts.h) parts.push(`h_${opts.h}`);
  if (opts.q && opts.q !== "auto") parts[1] = `q_${opts.q}`;
  if (opts.f && opts.f !== "auto") parts[0] = `f_${opts.f}`;
  if (opts.c) parts.push(`c_${opts.c}`);
  if (opts.g) parts.push(`g_${opts.g}`);
  if (opts.dpr && opts.dpr !== "auto") parts.push(`dpr_${opts.dpr}`);
  return parts.join(",");
}

/**
 * Wrap an image URL with Cloudinary fetch-mode transforms.
 * Safe no-op when:
 *   - Cloudinary not configured
 *   - URL is empty / data: / blob:
 *   - URL is already a Cloudinary URL
 */
export function cld(
  url: string | null | undefined,
  preset: Preset | Opts = "card"
): string {
  if (!url) return "";
  if (!CLOUD_NAME) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.includes("res.cloudinary.com")) return url;
  if (!/^https?:\/\//i.test(url)) return url;

  const opts = typeof preset === "string" ? PRESETS[preset] : preset;
  const transform = buildTransform(opts);

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transform}/${encodeURI(url)}`;
}

export const cloudinaryConfigured = Boolean(CLOUD_NAME);
