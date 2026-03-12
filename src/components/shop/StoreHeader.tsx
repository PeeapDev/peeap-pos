import Image from "next/image";
import Link from "next/link";

interface StoreHeaderProps {
  store: {
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
  };
  showCart?: boolean;
}

export default function StoreHeader({
  store,
  showCart = true,
}: StoreHeaderProps) {
  return (
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
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {store.logo_url && (
              <Image
                src={store.logo_url}
                alt={store.name}
                width={48}
                height={48}
                className="rounded-full"
              />
            )}
            <div>
              <Link
                href={`/shop/${store.slug}`}
                className="text-xl font-bold text-gray-900 hover:text-green-600 transition-colors"
              >
                {store.name}
              </Link>
              {store.description && (
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">
                  {store.description}
                </p>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href={`/shop/${store.slug}`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Shop
            </Link>
            {showCart && (
              <Link
                href={`/shop/${store.slug}/cart`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cart
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
