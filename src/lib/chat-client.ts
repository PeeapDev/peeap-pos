/**
 * Chat Client - Sends order receipts and updates via chat.peeap.com ecommerce endpoint.
 * All methods are fire-and-forget — they never throw.
 *
 * Messages are sent FROM the seller TO the buyer, creating a direct
 * connection between vendor and customer. These messages are marked
 * as non-deletable transaction anchors.
 */

import { generateReceiptPDF } from "./receipt-pdf";
import { uploadToR2 } from "./r2";

const CHAT_API_URL =
  process.env.CHAT_API_URL || "https://chat.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

const TIMEOUT_MS = 5000;

interface EcommerceMessageParams {
  order_id: string;
  store_id: string;
  buyer_user_id: string;
  seller_user_id: string;
  category: "order_created" | "order_update" | "shipping_update" | "delivery_confirmed";
  content?: string;
  rich_content?: Record<string, unknown>;
  tracking_number?: string;
}

async function sendChatMessage(params: EcommerceMessageParams): Promise<boolean> {
  try {
    const res = await Promise.race([
      fetch(`${CHAT_API_URL}/api/ecommerce/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SERVICE_SECRET,
        },
        body: JSON.stringify(params),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("chat_message_timeout")), TIMEOUT_MS)
      ),
    ]);
    return res.ok;
  } catch (err) {
    console.error("[ChatClient] sendChatMessage failed:", err);
    return false;
  }
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  tax_rate?: number;
  tax_amount?: number;
}

interface OrderReceiptParams {
  order_id: string;
  order_number: string;
  store_id: string;
  store_name: string;
  buyer_user_id: string;
  seller_user_id: string;
  customer_name: string;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  order_type: string;
  delivery_address?: string;
  store_logo_url?: string | null;
  store_address?: string | null;
  store_phone?: string | null;
}

export async function sendOrderReceiptToChat(
  params: OrderReceiptParams
): Promise<boolean> {
  const firstName = params.customer_name.split(" ")[0];

  // Generate receipt PDF and upload to R2 (non-blocking — if it fails, we still send the chat message)
  let receiptPdfUrl: string | null = null;
  try {
    const pdfBuffer = await generateReceiptPDF({
      order_number: params.order_number,
      store_name: params.store_name,
      customer_name: params.customer_name,
      items: params.items,
      subtotal: params.subtotal,
      tax_amount: params.tax_amount,
      delivery_fee: params.delivery_fee,
      total_amount: params.total_amount,
      payment_method: params.payment_method,
      order_type: params.order_type,
      delivery_address: params.delivery_address,
      store_logo_url: params.store_logo_url,
      store_address: params.store_address,
      store_phone: params.store_phone,
      tracking_url: `https://store.peeap.com/order/${params.order_number}`,
    });

    const key = `receipts/${params.order_number}/${Date.now()}.pdf`;
    receiptPdfUrl = await uploadToR2(pdfBuffer, key, "application/pdf");
  } catch (err) {
    console.error("[ChatClient] Receipt PDF generation failed:", err);
  }

  const content = `Hi ${firstName}! We've received your order and we're getting it ready for you. If you need to make any changes or have questions, just send us a message here — we're happy to help!`;

  return sendChatMessage({
    order_id: params.order_number,
    store_id: params.store_id,
    buyer_user_id: params.buyer_user_id,
    seller_user_id: params.seller_user_id,
    category: "order_created",
    content,
    rich_content: {
      order_number: params.order_number,
      order_id: params.order_id,
      store_name: params.store_name,
      items: params.items,
      subtotal: params.subtotal,
      tax_amount: params.tax_amount,
      delivery_fee: params.delivery_fee,
      total_amount: params.total_amount,
      payment_method: params.payment_method,
      order_type: params.order_type,
      delivery_address: params.delivery_address,
      customer_name: params.customer_name,
      ...(receiptPdfUrl && { receipt_pdf_url: receiptPdfUrl }),
    },
  });
}

interface OrderStatusUpdateParams {
  order_id: string;
  order_number: string;
  store_id: string;
  store_name: string;
  buyer_user_id: string;
  seller_user_id: string;
  customer_name: string;
  new_status: string;
  total_amount: number;
}

export async function sendOrderStatusUpdateToChat(
  params: OrderStatusUpdateParams
): Promise<boolean> {
  const firstName = params.customer_name.split(" ")[0];

  const statusMessages: Record<string, string> = {
    paid: `Hi ${firstName}, your payment has been confirmed! We'll start preparing your order right away.`,
    processing: `${firstName}, your order is being prepared. We'll let you know once it's on its way!`,
    shipped: `Great news ${firstName}! Your order has been shipped. It's on its way to you!`,
    delivered: `Hi ${firstName}, your order has been delivered! Thank you for shopping with ${params.store_name} — we hope you love it. If anything isn't right, just message us here and we'll sort it out.`,
    cancelled: `Hi ${firstName}, your order #${params.order_number} has been cancelled. If you have any questions, feel free to message us here.`,
  };

  const content = statusMessages[params.new_status];
  if (!content) return false;

  const category = params.new_status === "delivered" ? "delivery_confirmed" : "order_update";

  return sendChatMessage({
    order_id: params.order_number,
    store_id: params.store_id,
    buyer_user_id: params.buyer_user_id,
    seller_user_id: params.seller_user_id,
    category,
    content,
    rich_content: {
      order_number: params.order_number,
      order_id: params.order_id,
      store_name: params.store_name,
      new_status: params.new_status,
      total_amount: params.total_amount,
      customer_name: params.customer_name,
    },
  });
}
