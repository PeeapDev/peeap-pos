"use client";

import { useEffect, useState } from "react";
import { MapPin, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ShippingAddress {
  id: string;
  address_line: string;
  city?: string;
  is_default?: boolean;
}

export default function ProductDeliveryDetails({
  offersDelivery,
  deliveryFee,
  freeDeliveryMinimum,
  productPrice,
}: {
  offersDelivery: boolean;
  deliveryFee: number;
  freeDeliveryMinimum: number;
  productPrice: number;
}) {
  const { user, token, loading: authLoading, loginPopup } = useAuth();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user?.id || !token) {
      setAddresses([]);
      setSelectedId("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    fetch(`/api/address?user_id=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Session ${token}` },
    })
      .then(response => {
        if (!response.ok) throw new Error("Address lookup failed");
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        const saved = (data.addresses || []).filter((address: ShippingAddress) => address.id !== "profile");
        setAddresses(saved);
        const preferred = sessionStorage.getItem("store_delivery_address_id");
        const selected = saved.find((address: ShippingAddress) => address.id === preferred)
          || saved.find((address: ShippingAddress) => address.is_default)
          || saved[0];
        if (selected) {
          setSelectedId(selected.id);
          sessionStorage.setItem("store_delivery_address_id", selected.id);
        }
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, token]);

  const feeLabel = offersDelivery
    ? freeDeliveryMinimum > 0 && productPrice >= freeDeliveryMinimum
      ? "Delivery fee: free for this item"
      : deliveryFee > 0
        ? `Delivery fee from NLe ${deliveryFee.toFixed(2)}`
        : "Delivery fee: free"
    : "Delivery availability and cost are confirmed at checkout";

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-labelledby="product-delivery-title">
      <h2 id="product-delivery-title" className="flex items-center gap-2 font-semibold text-gray-900">
        <Truck className="h-5 w-5 text-emerald-700" /> Delivery & shipping
      </h2>
      <p className="mt-2 text-sm text-gray-700">{feeLabel}. The final delivery details are shown before you pay.</p>
      {authLoading || loading ? (
        <p className="mt-3 text-sm text-gray-500">Checking your delivery addresses…</p>
      ) : !user ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
          <MapPin className="h-4 w-4" />
          <span>Sign in to choose where this item should be delivered.</span>
          <button type="button" onClick={() => void loginPopup()} className="font-semibold text-emerald-700 underline">Sign in</button>
        </div>
      ) : loadFailed ? (
        <p className="mt-3 text-sm text-red-700">Could not load your saved delivery addresses. You can check them at checkout.</p>
      ) : addresses.length ? (
        <div className="mt-3">
          <label htmlFor="product-delivery-address" className="mb-1 block text-sm font-medium text-gray-800">Deliver to</label>
          <select
            id="product-delivery-address"
            value={selectedId}
            onChange={event => {
              setSelectedId(event.target.value);
              sessionStorage.setItem("store_delivery_address_id", event.target.value);
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            {addresses.map(address => (
              <option key={address.id} value={address.id}>
                {[address.address_line, address.city].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
          <a href="https://my.peeap.com/profile" className="mt-2 inline-block text-xs font-medium text-emerald-700 underline">Manage addresses in Peeap</a>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-800">
          No saved delivery address yet. <a href="https://my.peeap.com/profile" className="font-semibold underline">Add one in Peeap</a> before paying.
        </p>
      )}
    </section>
  );
}
