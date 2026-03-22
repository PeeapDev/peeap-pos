import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";
import CartIcon from "@/components/shop/CartIcon";
import QuickAddToCartButton from "@/components/shop/QuickAddToCartButton";
import LiveActivityFeed from "@/components/marketplace/LiveActivityFeed";

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

function getYearsOperating(establishedYear: number | null): string {
  if (!establishedYear) return "New";
  const years = new Date().getFullYear() - establishedYear;
  if (years < 1) return "< 1 year";
  if (years === 1) return "1 year";
  return `${years} years`;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} className="w-4 h-4" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={`star-${i}-${rating}`}>
                <stop
                  offset={i <= full ? "100%" : i === full + 1 ? `${partial * 100}%` : "0%"}
                  stopColor="#FBBF24"
                />
                <stop
                  offset={i <= full ? "100%" : i === full + 1 ? `${partial * 100}%` : "0%"}
                  stopColor="#D1D5DB"
                />
              </linearGradient>
            </defs>
            <path
              fill={i <= full ? "#FBBF24" : i === full + 1 && partial > 0 ? `url(#star-${i}-${rating})` : "#D1D5DB"}
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
      <span className="text-sm text-gray-400">({count.toLocaleString()} reviews)</span>
    </div>
  );
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

  const [productsRes, categoriesRes, reviewsRes, recentOrdersRes] = await Promise.all([
    supabase
      .from("pos_products")
      .select("*, category:pos_categories(name)")
      .eq("merchant_id", store.merchant_id)
      .eq("is_active", true)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("order_count", { ascending: false })
      .limit(100),
    supabase
      .from("pos_categories")
      .select("*")
      .eq("merchant_id", store.merchant_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("product_reviews")
      .select("*, product:pos_products(name)")
      .eq("store_id", store.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("store_orders")
      .select("order_number, customer_name, total_amount, created_at")
      .eq("merchant_id", store.merchant_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const products = productsRes.data || [];
  const categories = categoriesRes.data || [];
  const reviews = reviewsRes.data || [];
  const recentOrders = recentOrdersRes.data || [];

  const yearsOperating = getYearsOperating(store.established_year);
  const totalProductsSold = products.reduce((sum: number, p: { order_count?: number }) => sum + (p.order_count || 0), 0);
  const specializations: string[] = store.specializations || [];

  // JSON-LD
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
    ...(store.average_rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: store.average_rating,
        reviewCount: store.total_ratings,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Banner */}
        <div className="relative">
          {store.banner_url ? (
            <div className="h-48 md:h-72 relative">
              <Image
                src={store.banner_url}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          ) : (
            <div className="h-48 md:h-72 bg-gradient-to-br from-green-600 to-green-800" />
          )}

          {/* Store info overlay */}
          <div className="max-w-7xl mx-auto px-4">
            <div className="relative -mt-16 md:-mt-20 flex flex-col md:flex-row md:items-end gap-4 pb-6">
              {/* Logo */}
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden shrink-0">
                {store.logo_url ? (
                  <Image
                    src={store.logo_url}
                    alt={store.name}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-4xl">
                    {store.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {store.name}
                  </h1>
                  {store.is_verified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified Vendor
                    </span>
                  )}
                  {store.is_featured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      Featured
                    </span>
                  )}
                </div>

                {store.description && (
                  <p className="text-gray-600 mt-1 line-clamp-2">{store.description}</p>
                )}

                {/* Rating */}
                {store.total_ratings > 0 && (
                  <div className="mt-2">
                    <StarRating rating={store.average_rating || 0} count={store.total_ratings || 0} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trust bar + Stats */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Years operating */}
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-gray-900">{yearsOperating}</p>
                <p className="text-xs text-gray-500 mt-0.5">In Business</p>
              </div>
              {/* Products */}
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-gray-900">{products.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Products</p>
              </div>
              {/* Items sold */}
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-gray-900">{totalProductsSold.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Items Sold</p>
              </div>
              {/* Orders fulfilled */}
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-gray-900">{(store.total_orders || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Orders</p>
              </div>
              {/* Response time */}
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-green-600">
                  {store.response_time_hours ? `< ${store.response_time_hours}h` : "Fast"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Response Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="bg-green-50 border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs md:text-sm">
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                100% Money Back Guarantee
              </span>
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Secure Packaging
              </span>
              {store.offers_delivery && (
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  Delivery Available
                  {store.delivery_fee > 0 && ` (NLe ${store.delivery_fee})`}
                  {store.free_delivery_minimum && ` — Free over NLe ${store.free_delivery_minimum}`}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                7-Day Returns
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Specializations */}
              {specializations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Specializes In</h3>
                  <div className="flex flex-wrap gap-2">
                    {specializations.map((spec: string) => (
                      <span key={spec} className="px-3 py-1 bg-white border rounded-full text-sm text-gray-700 font-medium">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category filter */}
              {categories && categories.length > 0 && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  <span className="px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-700 whitespace-nowrap shrink-0">
                    All ({products.length})
                  </span>
                  {categories.map(
                    (cat: { id: string; name: string; color: string }) => (
                      <span
                        key={cat.id}
                        className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border hover:bg-gray-50 cursor-pointer"
                      >
                        {cat.name}
                      </span>
                    )
                  )}
                </div>
              )}

              {/* Products Grid */}
              {products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map(
                    (product: {
                      id: string;
                      name: string;
                      slug: string;
                      price: number;
                      image_url: string | null;
                      is_featured: boolean;
                      order_count?: number;
                      average_rating?: number;
                      total_ratings?: number;
                      stock_quantity?: number;
                      track_inventory?: boolean;
                      category: { name: string } | null;
                    }) => {
                      const productSlug =
                        product.slug ||
                        product.name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "");
                      const isLowStock = product.track_inventory && (product.stock_quantity || 0) <= 5 && (product.stock_quantity || 0) > 0;
                      const isOutOfStock = product.track_inventory && (product.stock_quantity || 0) <= 0;

                      return (
                        <Link
                          key={product.id}
                          href={`/shop/${params.merchantSlug}/${productSlug}`}
                          className="group bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-all relative"
                        >
                          <div className="aspect-square relative bg-gray-100">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 768px) 50vw, 25vw"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-300">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                            {product.is_featured && (
                              <span className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                Featured
                              </span>
                            )}
                            {isLowStock && (
                              <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                Only {product.stock_quantity} left
                              </span>
                            )}
                            {isOutOfStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-sm font-bold">
                                  Sold Out
                                </span>
                              </div>
                            )}
                            <QuickAddToCartButton
                              product={{
                                id: product.id,
                                name: product.name,
                                price: product.price,
                                image_url: product.image_url,
                              }}
                              merchantSlug={params.merchantSlug}
                            />
                          </div>
                          <div className="p-3">
                            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-green-600 transition-colors">
                              {product.name}
                            </h3>
                            {/* Rating */}
                            {(product.average_rating || 0) > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-yellow-500 text-xs">
                                  {"★".repeat(Math.round(product.average_rating || 0))}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  ({product.total_ratings || 0})
                                </span>
                              </div>
                            )}
                            <p className="text-lg font-bold text-green-600 mt-1">
                              NLe {product.price.toLocaleString()}
                            </p>
                            {(product.order_count || 0) > 0 && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {product.order_count?.toLocaleString()} sold
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <p className="text-lg">No products available yet</p>
                  <p className="text-sm mt-2">This vendor is setting up their store. Check back soon!</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-80 shrink-0 space-y-4">
              {/* Store info card */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-900 mb-3">About This Store</h3>
                <div className="space-y-3 text-sm">
                  {store.city && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {store.address || store.city}, {store.country || "Sierra Leone"}
                    </div>
                  )}
                  {store.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {store.phone}
                    </div>
                  )}
                  {store.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {store.email}
                    </div>
                  )}
                  {store.established_year && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Member since {store.established_year}
                    </div>
                  )}
                </div>
              </div>

              {/* Live activity feed */}
              <LiveActivityFeed
                recentOrders={recentOrders}
                storeName={store.name}
              />

              {/* Recent reviews */}
              {reviews.length > 0 && (
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Customer Reviews</h3>
                  <div className="space-y-3">
                    {reviews.map((review: {
                      id: string;
                      customer_name: string;
                      rating: number;
                      review_text: string | null;
                      is_verified_purchase: boolean;
                      created_at: string;
                      product: { name: string } | null;
                    }) => (
                      <div key={review.id} className="text-sm border-b last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{review.customer_name}</span>
                          {review.is_verified_purchase && (
                            <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">Verified</span>
                          )}
                        </div>
                        <div className="text-yellow-500 text-xs mt-0.5">
                          {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                        </div>
                        {review.product && (
                          <p className="text-[10px] text-gray-400 mt-0.5">on {review.product.name}</p>
                        )}
                        {review.review_text && (
                          <p className="text-gray-600 mt-1 line-clamp-2">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Return policy */}
              <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <h3 className="font-semibold text-green-800">Buyer Protection</h3>
                </div>
                <p className="text-sm text-green-700">
                  {store.return_policy || "100% Money Back Guarantee on all products within 7 days. Shop with confidence."}
                </p>
              </div>
            </aside>
          </div>
        </div>

        <CartIcon merchantSlug={params.merchantSlug} />
      </div>
    </>
  );
}
