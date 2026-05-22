"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CldImage from "@/components/CldImage";

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  link_type: string;
  link_target?: string;
}

export default function HeroBanner({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) {
    // Default hero when no banners configured
    return (
      <section className="bg-gradient-to-br from-green-600 to-green-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">
            Shop from local businesses
          </h1>
          <p className="mt-3 text-lg text-green-100 max-w-xl mx-auto">
            Discover products from verified merchants across Sierra Leone.
            Pay with mobile money or Peeap Wallet.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link
              href="/search"
              className="bg-white text-green-700 px-6 py-2.5 rounded-lg font-medium hover:bg-green-50 transition-colors"
            >
              Browse Products
            </Link>
            <Link
              href="/dashboard"
              className="border border-white/30 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-white/10 transition-colors"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const banner = banners[current];

  function getBannerLink(b: Banner): string {
    if (b.link_url) return b.link_url;
    if (b.link_type === "category" && b.link_target)
      return `/category/${b.link_target}`;
    if (b.link_type === "store" && b.link_target)
      return `/shop/${b.link_target}`;
    if (b.link_type === "product" && b.link_target)
      return `/search?q=${b.link_target}`;
    return "/search";
  }

  return (
    <section className="relative bg-gray-900 overflow-hidden">
      <Link href={getBannerLink(banner)} className="block relative">
        <div className="relative aspect-[3/1] md:aspect-[4/1]">
          <CldImage
            src={banner.image_url}
            preset="banner"
            alt={banner.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-md">
              <h2 className="text-2xl md:text-4xl font-bold text-white">
                {banner.title}
              </h2>
              {banner.subtitle && (
                <p className="mt-2 text-white/80 text-sm md:text-base">
                  {banner.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"
            onClick={() =>
              setCurrent((prev) => (prev - 1 + banners.length) % banners.length)
            }
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"
            onClick={() =>
              setCurrent((prev) => (prev + 1) % banners.length)
            }
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-white" : "bg-white/40"
                }`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
