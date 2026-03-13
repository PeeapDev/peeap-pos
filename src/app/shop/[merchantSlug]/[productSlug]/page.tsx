import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/shop/AddToCartButton";
import BuyNowButton from "@/components/shop/BuyNowButton";
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

  return { store, product };
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
  const { store, product } = await getStoreAndProduct(
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
            <Link
              href={`/shop/${params.merchantSlug}/cart`}
              className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
            >
              View Cart
            </Link>
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
        <CartIcon merchantSlug={params.merchantSlug} />
      </div>
    </>
  );
}
