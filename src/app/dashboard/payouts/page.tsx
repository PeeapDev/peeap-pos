"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  ArrowLeft,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface Earnings {
  total_sales: number;
  total_commissions: number;
  total_paid: number;
  available_balance: number;
}

interface Payout {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  payout_method: string;
  reference: string;
  created_at: string;
}

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("auth_token="));
  return match ? match.split("=")[1] : null;
}

const fmt = (n: number) =>
  `NLe ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayoutsPage() {
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [amount, setAmount] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/payouts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEarnings(data.earnings);
      setPayouts(data.payouts || []);
    } catch {
      setMessage("Failed to load payout data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const requestPayout = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setRequesting(true);
    setMessage("");
    try {
      const token = getAuthToken();
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Payout processed successfully!");
        setAmount("");
        setShowForm(false);
        fetchPayouts();
      } else {
        setMessage(data.error || "Payout failed");
      }
    } catch {
      setMessage("Payout request failed");
    } finally {
      setRequesting(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-100 text-green-700",
      processing: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
      pending: "bg-gray-100 text-gray-700",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Earnings & Payouts</h1>
            <p className="text-gray-500 text-sm">Manage your store earnings</p>
          </div>
        </div>

        {/* Earnings Cards */}
        {earnings && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-green-500">
              <p className="text-xs text-gray-500 font-medium">Total Sales</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(earnings.total_sales)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-amber-500">
              <p className="text-xs text-gray-500 font-medium">Commissions</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(earnings.total_commissions)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-xs text-gray-500 font-medium">Paid Out</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(earnings.total_paid)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                <p className="text-xs text-indigo-600 font-medium">Available</p>
              </div>
              <p className="text-xl font-bold text-indigo-700 mt-1">{fmt(earnings.available_balance)}</p>
            </div>
          </div>
        )}

        {/* Request Payout */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              disabled={!earnings || earnings.available_balance <= 0}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Request Payout
            </button>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Request Payout</h3>
              <input
                type="number"
                placeholder="Amount (NLe)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={earnings?.available_balance}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {amount && parseFloat(amount) > 0 && (
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Platform fee (2%): {fmt(parseFloat(amount) * 0.02)}</p>
                  <p className="font-medium text-gray-900">
                    You receive: {fmt(parseFloat(amount) * 0.98)}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={requestPayout}
                  disabled={requesting || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Payout
                </button>
                <button
                  onClick={() => { setShowForm(false); setAmount(""); }}
                  className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {message && (
            <p className={`mt-3 text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
        </div>

        {/* Payout History */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
          </div>
          {payouts.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No payouts yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {payouts.map((payout) => (
                <div key={payout.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{payout.reference}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(payout.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{fmt(payout.net_amount)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">Fee: {fmt(payout.fee)}</span>
                      {statusBadge(payout.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
