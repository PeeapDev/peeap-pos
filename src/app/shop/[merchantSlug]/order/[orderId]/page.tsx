import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  XCircle,
  CreditCard,
  ArrowLeft,
} from "lucide-react";

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

const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ElementType;
    message: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
    message: "Awaiting payment. Please complete your payment to proceed.",
  },
  paid: {
    label: "Paid",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CreditCard,
    message: "Payment received! Your order is being prepared.",
  },
  processing: {
    label: "Processing",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Package,
    message: "Your order is being prepared by the merchant.",
  },
  shipped: {
    label: "Shipped",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: Truck,
    message: "Your order is on the way!",
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
    message: "Your order has been delivered. Thank you for shopping!",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: XCircle,
    message: "This order has been cancelled.",
  },
};

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

  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;

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
        {/* Status Banner */}
        <div
          className={`rounded-lg p-6 mb-6 ${status.bgColor} flex items-start gap-4`}
        >
          <StatusIcon className={`w-8 h-8 ${status.color} shrink-0 mt-0.5`} />
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className={`text-xl font-bold ${status.color}`}>
                {status.label}
              </h2>
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${status.bgColor} ${status.color} border border-current/20`}
              >
                {order.order_number}
              </span>
            </div>
            <p className={`text-sm ${status.color} opacity-80`}>
              {status.message}
            </p>
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
