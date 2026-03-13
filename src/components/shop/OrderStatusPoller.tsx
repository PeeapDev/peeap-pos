"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  XCircle,
  CreditCard,
  Loader2,
} from "lucide-react";

interface OrderStatusPollerProps {
  orderId: string;
  initialStatus: string;
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

// Statuses where we should stop polling
const terminalStatuses = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export default function OrderStatusPoller({
  orderId,
  initialStatus,
}: OrderStatusPollerProps) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [isPolling, setIsPolling] = useState(
    !terminalStatuses.has(initialStatus)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't poll if already in a terminal status
    if (terminalStatuses.has(currentStatus)) {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;

        const data = await res.json();
        const newStatus = data.order?.status;

        if (newStatus && newStatus !== currentStatus) {
          setCurrentStatus(newStatus);

          if (terminalStatuses.has(newStatus)) {
            setIsPolling(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      } catch {
        // Silently ignore poll errors - will retry on next interval
      }
    };

    // Poll every 5 seconds
    intervalRef.current = setInterval(pollStatus, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [orderId, currentStatus]);

  const status = statusConfig[currentStatus] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div>
      {/* Status Banner */}
      <div
        className={`rounded-lg p-6 ${status.bgColor} flex items-start gap-4`}
      >
        <StatusIcon className={`w-8 h-8 ${status.color} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className={`text-xl font-bold ${status.color}`}>
              {status.label}
            </h2>
          </div>
          <p className={`text-sm ${status.color} opacity-80`}>
            {status.message}
          </p>
        </div>
      </div>

      {/* Polling Indicator */}
      {isPolling && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking payment status...</span>
        </div>
      )}
    </div>
  );
}
