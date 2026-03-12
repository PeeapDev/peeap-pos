import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";
import CartIcon from "@/components/shop/CartIcon";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface Props {
  params: { merchantSlug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = getSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name, description, logo_url")
    .eq("slug", params.merchantSlug)
    .eq("is_published", true)
    .single();

  if (!store) return { title: "Store Not Found" };

  return {
    title: `${store.name} | Peeap Store`,
    description: store.description || `Shop at ${store.name} on Peeap Store`,
    openGraph: {
      title: store.name,
      description: store.description || `Shop at ${store.name}`,
      url: `${STORE_URL}/shop/${params.merchantSlug}`,
      images: store.logo_url ? [{ url: store.logo_url }] : [],
      type: "website",
    },
  };
}

export default async function StorePage({ params }: Props) {
  const supabase = getSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", params.merchantSlug)
    .eq("is_published", true)
    .single();

  if (!store) notFound();

  const { data: products } = await supabase
    .from("pos_products")
    .select("*, category:pos_categories(name)")
    .eq("merchant_id", store.merchant_id)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("name")
    .limit(100);

  const { data: categories } = await supabase
    .from("pos_categories")
    .select("*")
    .eq("merchant_id", store.merchant_id)
    .eq("is_active", true)
    .order("sort_order");

  // JSON-LD: LocalBusiness
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: store.name,
    description: store.description,
    url: `${STORE_URL}/shop/${params.merchantSlug}`,
    ...(store.logo_url && { image: store.logo_url }),
    ...(store.address && {
      address: { "@type": "PostalAddress", streetAddress: store.address },
    }),
    ...(store.phone && { telephone: store.phone }),
    ...(store.email && { email: store.email }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Store Header */}
        <div className="bg-white border-b">
          {store.banner_url && (
            <div className="h-48 md:h-64 relative">
              <Image
                src={store.banner_url}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              {store.logo_url && (
                <Image
                  src={store.logo_url}
                  alt={store.name}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {store.name}
                </h1>
                {store.description && (
                  <p className="text-gray-600 mt-1">{store.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Categories */}
          {categories && categories.length > 0 && (
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {categories.map(
                (cat: { id: string; name: string; color: string }) => (
                  <span
                    key={cat.id}
                    className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: cat.color + "20",
                      color: cat.color,
                    }}
                  >
                    {cat.name}
                  </span>
                )
              )}
            </div>
          )}

          {/* Products Grid */}
          {products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map(
                (product: {
                  id: string;
                  name: string;
                  slug: string;
                  price: number;
                  image_url: string | null;
                  is_featured: boolean;
                  category: { name: string } | null;
                }) => {
                  const productSlug =
                    product.slug ||
                    product.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "");

                  return (
                    <Link
                      key={product.id}
                      href={`/shop/${params.merchantSlug}/${productSlug}`}
                      className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-square relative bg-gray-100">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            No image
                          </div>
                        )}
                        {product.is_featured && (
                          <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-medium">
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                          {product.name}
                        </h3>
                        {product.category && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {product.category.name}
                          </p>
                        )}
                        <p className="text-lg font-bold text-green-600 mt-1">
                          NLe {product.price.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No products available yet</p>
              <p className="text-sm mt-2">Check back soon!</p>
            </div>
          )}
        </div>

        <CartIcon merchantSlug={params.merchantSlug} />
      </div>
    </>
  );
}
