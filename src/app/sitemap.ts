import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: STORE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Add store pages
    const { data: stores } = await supabase
      .from("stores")
      .select("slug, updated_at")
      .eq("is_published", true);

    for (const store of stores || []) {
      entries.push({
        url: `${STORE_URL}/shop/${store.slug}`,
        lastModified: new Date(store.updated_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    // Add product pages
    const { data: products } = await supabase
      .from("pos_products")
      .select("slug, merchant_id, updated_at")
      .eq("is_active", true)
      .eq("is_published", true);

    if (products && stores) {
      const storeMap = new Map(
        stores.map((s: { slug: string; updated_at: string }) => {
          // We need merchant_id, re-fetch or join — for now skip unmapped
          return [s.slug, s];
        })
      );

      // Get merchant_id → store slug mapping
      const { data: storesWithMerchant } = await supabase
        .from("stores")
        .select("merchant_id, slug")
        .eq("is_published", true);

      const merchantToSlug = new Map(
        (storesWithMerchant || []).map((s) => [s.merchant_id, s.slug])
      );

      for (const product of products) {
        const storeSlug = merchantToSlug.get(product.merchant_id);
        if (storeSlug && product.slug) {
          entries.push({
            url: `${STORE_URL}/shop/${storeSlug}/${product.slug}`,
            lastModified: new Date(product.updated_at),
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error generating sitemap:", err);
  }

  return entries;
}
