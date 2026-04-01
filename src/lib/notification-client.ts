/**
 * Notification Client - Sends notifications via api.peeap.com internal endpoint.
 * All methods are fire-and-forget — they never throw.
 */

const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

interface NotificationParams {
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  source_service?: string;
  source_id?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export async function sendNotification(
  params: NotificationParams
): Promise<boolean> {
  try {
    const res = await Promise.race([
      fetch(`${API_BASE_URL}/api/notifications/internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SERVICE_SECRET,
        },
        body: JSON.stringify({
          user_id: params.user_id,
          type: params.type,
          title: params.title,
          message: params.message,
          action_url: params.action_url,
          source_service: params.source_service || "store",
          source_id: params.source_id,
          priority: params.priority || "normal",
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("notification_timeout")), 3000)
      ),
    ]);
    return res.ok;
  } catch (err) {
    console.error("[NotificationClient] sendNotification failed:", err);
    return false;
  }
}

// ── Helper functions ──

export async function notifyOrderConfirmed(
  userId: string,
  orderNumber: string,
  storeName: string,
  totalAmount: number
): Promise<boolean> {
  return sendNotification({
    user_id: userId,
    type: "store_order_confirmed",
    title: "Order Confirmed!",
    message: `Your order #${orderNumber} from ${storeName} for NLe ${totalAmount.toLocaleString()} has been placed.`,
    source_service: "store",
    source_id: orderNumber,
    priority: "high",
  });
}

export async function notifyNewOrder(
  merchantId: string,
  orderNumber: string,
  customerName: string,
  totalAmount: number
): Promise<boolean> {
  return sendNotification({
    user_id: merchantId,
    type: "store_new_order",
    title: "New Order Received",
    message: `${customerName} placed order #${orderNumber} for NLe ${totalAmount.toLocaleString()}.`,
    source_service: "store",
    source_id: orderNumber,
    priority: "high",
  });
}

export async function notifyOrderStatusChanged(
  userId: string,
  orderNumber: string,
  newStatus: string,
  storeName?: string
): Promise<boolean> {
  const statusMessages: Record<string, { type: string; title: string; message: string }> = {
    shipped: {
      type: "store_order_shipped",
      title: "Order Shipped",
      message: `Your order #${orderNumber}${storeName ? ` from ${storeName}` : ""} has been shipped.`,
    },
    delivered: {
      type: "store_order_delivered",
      title: "Order Delivered",
      message: `Your order #${orderNumber}${storeName ? ` from ${storeName}` : ""} has been delivered.`,
    },
    cancelled: {
      type: "store_order_cancelled",
      title: "Order Cancelled",
      message: `Your order #${orderNumber}${storeName ? ` from ${storeName}` : ""} has been cancelled.`,
    },
  };

  const info = statusMessages[newStatus];
  if (!info) return false;

  return sendNotification({
    user_id: userId,
    type: info.type,
    title: info.title,
    message: info.message,
    source_service: "store",
    source_id: orderNumber,
    priority: newStatus === "cancelled" ? "high" : "normal",
  });
}

export async function notifyReturnRequested(
  merchantId: string,
  orderNumber: string,
  customerName: string
): Promise<boolean> {
  return sendNotification({
    user_id: merchantId,
    type: "store_return_requested",
    title: "Return Request",
    message: `${customerName} requested a return for order #${orderNumber}.`,
    source_service: "store",
    source_id: orderNumber,
    priority: "high",
  });
}

export async function notifyReturnApproved(
  userId: string,
  orderNumber: string,
  refundAmount: number
): Promise<boolean> {
  return sendNotification({
    user_id: userId,
    type: "store_return_approved",
    title: "Return Approved",
    message: `Your return for order #${orderNumber} has been approved. NLe ${refundAmount.toLocaleString()} will be refunded.`,
    source_service: "store",
    source_id: orderNumber,
    priority: "high",
  });
}

export async function notifyPayoutCompleted(
  merchantId: string,
  amount: number
): Promise<boolean> {
  return sendNotification({
    user_id: merchantId,
    type: "store_payout_completed",
    title: "Payout Sent",
    message: `NLe ${amount.toLocaleString()} has been credited to your wallet.`,
    source_service: "store",
    priority: "normal",
  });
}
