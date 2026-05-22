/**
 * <CldImage> — Next/Image wrapper that routes through Cloudinary fetch mode
 * and bypasses Vercel's image optimizer.
 *
 * Why bypass Vercel:
 *   - Cloudinary already handles f_auto / q_auto / resize / CDN
 *   - Letting Next/Image also resize causes upscaling artifacts when our
 *     Cloudinary preset caps width below the srcSet's largest variant
 *   - Avoids paying Vercel image-optimizer credits on top of Cloudinary
 *
 * Keep using <Image> directly for purely local assets (e.g. /public/*).
 * Use <CldImage> for any user-uploaded / R2 / Supabase product image.
 */

import Image, { ImageProps } from "next/image";
import { cld } from "@/lib/cloudinary";

type Preset = "thumb" | "card" | "detail" | "hero" | "logo" | "banner";

type CldOpts = {
  w?: number;
  h?: number;
  q?: number | "auto";
  f?: "auto" | "webp" | "avif" | "jpg" | "png";
  c?: "fill" | "fit" | "limit" | "pad" | "scale";
  g?: "auto" | "face" | "center";
};

type CldImageProps = Omit<ImageProps, "src" | "unoptimized"> & {
  src: string | null | undefined;
  preset?: Preset | CldOpts;
};

export default function CldImage({
  src,
  preset = "card",
  ...rest
}: CldImageProps) {
  const wrapped = cld(src, preset);
  if (!wrapped) return null;
  return <Image src={wrapped} unoptimized {...rest} />;
}
