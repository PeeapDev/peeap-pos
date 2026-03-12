import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

// GET /api/feeds/google-shopping.xml — Google Shopping product feed
// ISR: revalidate every hour
export const revalidate = 3600;

export async function GET() {
  try {
    // Get all published products with their stores
    const { data: products, error } = await supabase
      .from("pos_products")
      .select(
        `
        id, name, description, price, image_url, barcode, sku,
        stock_quantity, track_inventory, is_active,
        slug, seo_title, seo_description,
        merchant_id,
        category:pos_categories(name)
      `
      )
      .eq("is_active", true)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) throw error;

    // Get stores for merchant lookup
    const merchantIds = [
      ...new Set((products || []).map((p) => p.merchant_id)),
    ];
    const { data: stores } = await supabase
      .from("stores")
      .select("merchant_id, slug, name")
      .in("merchant_id", merchantIds)
      .eq("is_published", true);

    const storeMap = new Map(
      (stores || []).map((s) => [s.merchant_id, s])
    );

    const items = (products || [])
      .filter((p) => storeMap.has(p.merchant_id))
      .map((product) => {
        const store = storeMap.get(product.merchant_id)!;
        const productSlug =
          product.slug ||
          product.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const link = `${STORE_URL}/shop/${store.slug}/${productSlug}`;
        const availability =
          product.track_inventory && product.stock_quantity <= 0
            ? "out of stock"
            : "in stock";
        const catData = product.category as
          | { name: string }
          | { name: string }[]
          | null;
        const category = (Array.isArray(catData) ? catData[0]?.name : catData?.name) || "General";

        return `    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${product.seo_title || product.name}]]></g:title>
      <g:description><![CDATA[${product.seo_description || product.description || product.name}]]></g:description>
      <g:link>${link}</g:link>
      ${product.image_url ? `<g:image_link>${product.image_url}</g:image_link>` : ""}
      <g:availability>${availability}</g:availability>
      <g:price>${product.price.toFixed(2)} SLE</g:price>
      <g:condition>new</g:condition>
      <g:brand><![CDATA[${store.name}]]></g:brand>
      ${product.barcode ? `<g:gtin>${product.barcode}</g:gtin>` : ""}
      ${product.sku ? `<g:mpn>${product.sku}</g:mpn>` : ""}
      <g:product_type><![CDATA[${category}]]></g:product_type>
    </item>`;
      });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Peeap Store - Product Feed</title>
    <link>${STORE_URL}</link>
    <description>Products from Peeap Store merchants</description>
${items.join("\n")}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("Error generating Google Shopping feed:", err);
    return new NextResponse(
      '<?xml version="1.0"?><rss version="2.0"><channel><title>Error</title></channel></rss>',
      {
        status: 500,
        headers: { "Content-Type": "application/xml" },
      }
    );
  }
}
