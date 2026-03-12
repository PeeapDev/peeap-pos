import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function LandingPage() {
  let stores: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
  }> = [];

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("stores")
      .select("id, name, slug, description, logo_url")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(12);

    stores = data || [];
  } catch {
    // DB not set up yet — show empty state
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-green-600">
            Peeap Store
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Merchant Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-600 to-green-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold">
            Your Store, Online
          </h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl mx-auto">
            Every Peeap POS merchant gets a Google-indexed online store.
            Manage your inventory, process sales, and sell online — all in
            one place.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-white text-green-700 px-6 py-3 rounded-lg font-medium hover:bg-green-50 transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Discover Stores */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Discover Stores
        </h2>

        {stores.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/shop/${store.slug}`}
                className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                {store.logo_url ? (
                  <Image
                    src={store.logo_url}
                    alt={store.name}
                    width={80}
                    height={80}
                    className="rounded-full mx-auto"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-green-100 mx-auto flex items-center justify-center text-green-600 font-bold text-2xl">
                    {store.name.charAt(0)}
                  </div>
                )}
                <h3 className="font-medium text-gray-900 mt-3">
                  {store.name}
                </h3>
                {store.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {store.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No stores yet. Be the first to create one!</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-white border-t py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Powered by Peeap &mdash; Payments for Sierra Leone</p>
        </div>
      </footer>
    </div>
  );
}
