/**
 * Cards API Client - Calls cards.peeap.com for card authorization.
 * Uses SERVICE_SECRET for service-to-service authentication.
 */

const CARDS_API_URL =
  process.env.CARDS_API_URL || "https://cards.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export const DECLINE_CODE_MESSAGES: Record<string, string> = {
  "01": "Insufficient card balance",
  "02": "Card is not active",
  "03": "Card is frozen",
  "04": "Card is blocked",
  "05": "Card has expired",
  "06": "Amount exceeds per-transaction limit",
  "07": "Daily spending limit reached",
  "08": "Weekly spending limit reached",
  "09": "Monthly spending limit reached",
  "10": "This merchant category is restricted on your card",
  "11": "Transaction flagged for fraud — contact support",
  "12": "Invalid PIN",
  "13": "PIN blocked due to too many attempts",
  "14": "Card not found",
  "15": "NFC verification failed",
  "16": "Daily transaction count limit reached",
};

interface AuthorizeParams {
  card_token: string;
  amount: number;
  currency?: string;
  merchant_id: string;
  entry_mode?: "QR_SCAN" | "NFC_TAP" | "ONLINE" | "MANUAL";
  pin?: string;
  idempotency_key: string;
  description?: string;
  metadata?: Record<string, string>;
}

interface AuthorizeResult {
  authorized: boolean;
  id?: string;
  auth_code?: string;
  decline_code?: string;
  decline_reason?: string;
  fraud_score?: number;
  hold_expires_at?: string;
}

export async function authorizeCardPayment(
  params: AuthorizeParams,
  clientIp?: string
): Promise<AuthorizeResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Service-Secret": SERVICE_SECRET,
  };
  if (clientIp) {
    headers["X-Forwarded-For"] = clientIp;
  }

  const res = await fetch(`${CARDS_API_URL}/api/v1/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      card_token: params.card_token,
      amount: params.amount,
      currency: params.currency || "SLE",
      merchant_id: params.merchant_id,
      entry_mode: params.entry_mode || "ONLINE",
      pin: params.pin,
      idempotency_key: params.idempotency_key,
      description: params.description,
      metadata: params.metadata,
    }),
  });

  const data = await res.json();

  if (res.ok && data.status === "AUTHORIZED") {
    return {
      authorized: true,
      id: data.id,
      auth_code: data.auth_code,
      fraud_score: data.fraud_score,
      hold_expires_at: data.hold_expires_at,
    };
  }

  // Declined or error
  const declineCode = data.decline_code || "";
  return {
    authorized: false,
    id: data.id || "",
    decline_code: declineCode,
    decline_reason:
      DECLINE_CODE_MESSAGES[declineCode] ||
      data.decline_reason ||
      data.error ||
      "Card payment declined",
    fraud_score: data.fraud_score,
  };
}

export async function voidAuthorization(
  authorizationId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${CARDS_API_URL}/api/v1/authorizations/${authorizationId}/void`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SERVICE_SECRET,
        },
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[CardsClient] Void failed:", err);
    return false;
  }
}
