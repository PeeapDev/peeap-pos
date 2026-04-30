import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/shop/AddToCartButton";
import BuyNowButton from "@/components/shop/BuyNowButton";
import CartIcon from "@/components/shop/CartIcon";
import ShopUserButton from "@/components/shop/ShopUserButton";

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
  params: { merchantSlug: string; productSlug: string };
}

async function getStoreAndProduct(merchantSlug: string, productSlug: string) {
  const supabase = getSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", merchantSlug)
    .eq("is_published", true)
    .single();

  if (!store) return { store: null, product: null };

  const { data: product } = await supabase
    .from("pos_products")
    .select("*, category:pos_categories(name)")
    .eq("merchant_id", store.merchant_id)
    .eq("slug", productSlug)
    .eq("is_active", true)
    .eq("is_published", true)
    .single();

  // Fetch similar products from same store
  const { data: similarProducts } = await supabase
    .from("pos_products")
    .select("id, name, slug, price, image_url, stock_quantity, track_inventory")
    .eq("merchant_id", store.merchant_id)
    .eq("is_active", true)
    .eq("is_published", true)
    .neq("id", product?.id || "")
    .order("order_count", { ascending: false })
    .limit(8);

  return { store, product, similarProducts: (similarProducts || []) as any[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, product } = await getStoreAndProduct(
    params.merchantSlug,
    params.productSlug
  );

  if (!product || !store) return { title: "Product Not Found" };

  const title = product.seo_title || `${product.name} | ${store.name}`;
  const description =
    product.seo_description ||
    product.description ||
    `Buy ${product.name} from ${store.name} on Peeap Store`;

  return {
    title,
    description,
    openGraph: {
      title: product.name,
      description,
      url: `${STORE_URL}/shop/${params.merchantSlug}/${params.productSlug}`,
      images: product.image_url ? [{ url: product.image_url }] : [],
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { store, product, similarProducts = [] } = await getStoreAndProduct(
    params.merchantSlug,
    params.productSlug
  );

  if (!store || !product) notFound();

  const availability =
    product.track_inventory && product.stock_quantity <= 0
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  // JSON-LD: Product
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    url: `${STORE_URL}/shop/${params.merchantSlug}/${params.productSlug}`,
    ...(product.image_url && { image: product.image_url }),
    ...(product.sku && { sku: product.sku }),
    ...(product.barcode && { gtin: product.barcode }),
    brand: {
      "@type": "Brand",
      name: store.name,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "SLE",
      availability,
      url: `${STORE_URL}/shop/${params.merchantSlug}/${params.productSlug}`,
      seller: {
        "@type": "Organization",
        name: store.name,
      },
    },
    ...(product.category && {
      category: (product.category as { name: string }).name,
    }),
  };

  const isOutOfStock = product.track_inventory && product.stock_quantity <= 0;
  const isLowStock =
    product.track_inventory &&
    product.stock_quantity > 0 &&
    product.stock_quantity <= 5;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb + View Cart */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <Link href="/" className="hover:text-gray-700">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link
                href={`/shop/${params.merchantSlug}`}
                className="hover:text-gray-700"
              >
                {store.name}
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">{product.name}</span>
            </div>
            <ShopUserButton merchantSlug={params.merchantSlug} />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Product Image */}
            <div className="space-y-4">
              <div className="aspect-square relative bg-white rounded-lg overflow-hidden">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-lg">
                    No image available
                  </div>
                )}
              </div>

              {/* Video embed */}
              {product.video_url && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={product.video_url.replace("watch?v=", "embed/")}
                    title={`${product.name} video`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              {product.category && (
                <p className="text-sm text-blue-600 font-medium mb-2">
                  {(product.category as { name: string }).name}
                </p>
              )}

              <h1 className="text-3xl font-bold text-gray-900">
                {product.name}
              </h1>

              <div className="mt-4">
                <p className="text-3xl font-bold text-green-600">
                  NLe {product.price.toLocaleString()}
                </p>
                {product.cost_price > 0 &&
                  product.cost_price < product.price && (
                    <p className="text-sm text-gray-400 line-through mt-1">
                      NLe{" "}
                      {(product.price * 1.2).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  )}
              </div>

              {/* Availability / Stock Status */}
              <div className="mt-4">
                {isOutOfStock ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                    Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                    Low Stock &mdash; Only {product.stock_quantity} left
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                    In Stock
                  </span>
                )}
              </div>

              {/* Delivery Info */}
              {store.offers_delivery && (
                <div className="mt-5 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 text-violet-800 font-semibold text-sm">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    Get it delivered to your door
                  </div>
                  <p className="text-xs text-violet-600 mt-1">
                    {store.free_delivery_minimum && product.price >= store.free_delivery_minimum
                      ? "Free delivery on this item!"
                      : store.delivery_fee > 0
                        ? `Delivery from NLe ${Number(store.delivery_fee).toLocaleString()} — arrives in minutes`
                        : "Free delivery — arrives in minutes"
                    }
                  </p>
                </div>
              )}

              {/* Add to Cart + Buy Now */}
              <div className="mt-6 space-y-3">
                <AddToCartButton
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                  }}
                  merchantSlug={params.merchantSlug}
                  disabled={isOutOfStock}
                  stockQuantity={product.stock_quantity}
                  trackInventory={product.track_inventory}
                />
                <BuyNowButton
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                  }}
                  merchantSlug={params.merchantSlug}
                  disabled={isOutOfStock}
                />
              </div>

              {/* Description */}
              {product.description && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Description
                  </h2>
                  <p className="text-gray-600 whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Product Details */}
              <div className="mt-6 border-t pt-6 space-y-2 text-sm">
                {product.sku && (
                  <p>
                    <span className="text-gray-500">SKU:</span>{" "}
                    <span className="text-gray-900">{product.sku}</span>
                  </p>
                )}
                {product.barcode && (
                  <p>
                    <span className="text-gray-500">Barcode:</span>{" "}
                    <span className="text-gray-900">{product.barcode}</span>
                  </p>
                )}
              </div>

              {/* Store Info */}
              <div className="mt-8 bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  {store.logo_url && (
                    <Image
                      src={store.logo_url}
                      alt={store.name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{store.name}</p>
                    <Link
                      href={`/shop/${params.merchantSlug}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View all products
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* More from this store */}
        {similarProducts.length > 0 && (
          <div className="max-w-6xl mx-auto mt-12 px-4 pb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              More from {store.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {similarProducts.map((sp: any) => {
                const spOutOfStock = sp.track_inventory && sp.stock_quantity <= 0;
                return (
                  <Link
                    key={sp.id}
                    href={`/shop/${params.merchantSlug}/${sp.slug}`}
                    className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {sp.image_url ? (
                        <Image
                          src={sp.image_url}
                          alt={sp.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
                          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                      )}
                      {spOutOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
                        </div>
                      )}
                      {store.offers_delivery && (
                        <div className="absolute top-2 right-2 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Delivery
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {sp.name}
                      </h3>
                      <p className="text-sm font-bold text-emerald-600 mt-1">
                        NLe {Number(sp.price).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <CartIcon merchantSlug={params.merchantSlug} />
      </div>
    </>
  );
}
