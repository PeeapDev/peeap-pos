/**
 * API Client - Calls api.peeap.com for wallet operations.
 * Uses SERVICE_SECRET for authenticated service-to-service calls.
 */

const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.peeap.com";

const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

async function apiCall<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SERVICE_SECRET,
        ...(options.headers || {}),
      },
    });

    const json = await res.json();

    if (!res.ok) {
      return { error: json.error || `API error ${res.status}` };
    }
    return { data: json as T };
  } catch (err) {
    console.error(`API call failed: ${path}`, err);
    return { error: "Failed to reach API" };
  }
}

// Wallet operations

export async function getWalletBalance(userId: string) {
  return apiCall<{ balance: number }>(`/api/wallets/${userId}/balance`);
}

export async function creditWallet(
  userId: string,
  amount: number,
  description: string,
  reference?: string
) {
  return apiCall<{ transaction_id: string }>("/api/wallets/credit", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      amount,
      description,
      reference,
      type: "pos_sale",
    }),
  });
}

export async function debitWallet(
  userId: string,
  amount: number,
  description: string,
  reference?: string
) {
  return apiCall<{ transaction_id: string }>("/api/wallets/debit", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      amount,
      description,
      reference,
      type: "pos_purchase",
    }),
  });
}

export async function transferWallet(
  fromUserId: string,
  toUserId: string,
  amount: number,
  description: string
) {
  return apiCall<{ transaction_id: string }>("/api/wallets/transfer", {
    method: "POST",
    body: JSON.stringify({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      description,
      type: "pos_transfer",
    }),
  });
}

// Payment initiation (mobile money)

export async function initiatePayment(params: {
  amount: number;
  currency?: string;
  description: string;
  reference: string;
  customer_phone?: string;
  payment_method: "mobile_money" | "card";
  callback_url?: string;
  return_url?: string;
}) {
  return apiCall<{ checkout_url: string; payment_id: string }>(
    "/api/payments/initiate",
    {
      method: "POST",
      body: JSON.stringify({
        ...params,
        currency: params.currency || "SLE",
        source: "pos_store",
      }),
    }
  );
}
