import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OrderStatusPoller from "@/components/shop/OrderStatusPoller";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface Props {
  params: { merchantSlug: string; orderId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Order Confirmation | Peeap Store",
    robots: { index: false, follow: false },
  };
}

export default async function OrderConfirmationPage({ params }: Props) {
  const supabase = getSupabase();

  // Fetch order with items
  const { data: order, error } = await supabase
    .from("store_orders")
    .select("*, items:store_order_items(*)")
    .eq("id", params.orderId)
    .single();

  if (error || !order) notFound();

  // Fetch store for the header link
  const { data: store } = await supabase
    .from("stores")
    .select("name, slug")
    .eq("slug", params.merchantSlug)
    .single();

  const formattedDate = new Date(order.created_at).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/shop/${params.merchantSlug}`}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">
            {store?.name || "Store"}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Status Banner with live polling */}
        <div className="mb-6">
          <OrderStatusPoller
            orderId={order.id}
            initialStatus={order.status}
          />
          {/* Order number badge */}
          <div className="mt-3 text-center">
            <span className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              Order {order.order_number}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Details */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">
              Order Details
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Order Number</dt>
                <dd className="font-medium text-gray-900">
                  {order.order_number}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Date</dt>
                <dd className="text-gray-900">{formattedDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Payment Method</dt>
                <dd className="text-gray-900 capitalize">
                  {order.payment_method?.replace("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Customer</dt>
                <dd className="text-gray-900">{order.customer_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900">{order.customer_phone}</dd>
              </div>
              {order.customer_email && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-900">{order.customer_email}</dd>
                </div>
              )}
              {order.notes && (
                <div>
                  <dt className="text-gray-500 mb-1">Notes</dt>
                  <dd className="text-gray-900 text-sm bg-gray-50 rounded p-2">
                    {order.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Shipping Info */}
          {(order.delivery_address || (order.metadata as any)?.shipping_job_number) && (
            <div className="bg-white rounded-lg p-6 shadow-sm md:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                Delivery Information
              </h3>
              <dl className="space-y-3 text-sm">
                {order.delivery_address && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Deliver to</dt>
                    <dd className="text-gray-900 text-right max-w-[60%]">{order.delivery_address}</dd>
                  </div>
                )}
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Delivery Fee</dt>
                    <dd className="text-gray-900">NLe {Number(order.delivery_fee).toLocaleString()}</dd>
                  </div>
                )}
                {(order.metadata as any)?.shipping_job_number && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tracking Number</dt>
                    <dd>
                      <a
                        href={`https://shipping.peeap.com/track/${(order.metadata as any).shipping_job_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-violet-600 hover:underline"
                      >
                        {(order.metadata as any).shipping_job_number}
                      </a>
                    </dd>
                  </div>
                )}
                {(order.metadata as any)?.shipping_status && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Shipping Status</dt>
                    <dd className="capitalize font-medium text-gray-900">
                      {((order.metadata as any).shipping_status as string).replace(/_/g, " ")}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-gray-400 mt-4">Your order will be delivered to your address. You'll receive a notification when it's on the way.</p>
            </div>
          )}

          {/* Items & Pricing */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Items</h3>

            <div className="space-y-3">
              {(order.items || []).map(
                (item: {
                  id: string;
                  product_name: string;
                  quantity: number;
                  unit_price: number;
                  total_price: number;
                }) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <div>
                      <span className="text-gray-900">{item.product_name}</span>
                      <span className="text-gray-500 ml-1">
                        x{item.quantity}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">
                      NLe {item.total_price.toLocaleString()}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="border-t mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>NLe {order.subtotal.toLocaleString()}</span>
              </div>
              {order.tax_amount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>NLe {order.tax_amount.toLocaleString()}</span>
                </div>
              )}
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span>NLe {Number(order.delivery_fee).toLocaleString()}</span>
                </div>
              )}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-NLe {order.discount_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t">
                <span>Total</span>
                <span>NLe {order.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Shopping */}
        <div className="text-center mt-8">
          <Link
            href={`/shop/${params.merchantSlug}`}
            className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
