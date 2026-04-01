"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Star,
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  Loader2,
} from "lucide-react";

interface Review {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  customer_name: string;
  rating: number;
  review_text: string | null;
  is_approved: boolean;
  created_at: string;
}

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("auth_token="));
  return match ? match.split("=")[1] : null;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/reviews/moderate?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [tab]);

  const moderate = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      const token = getAuthToken();
      await fetch("/api/reviews/moderate", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, action }),
      });
      fetchReviews();
    } catch {
      // fail silently
    } finally {
      setProcessing(null);
    }
  };

  const Stars = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Moderation</h1>
            <p className="text-gray-500 text-sm">Manage product reviews</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
          {(["pending", "approved", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No {tab === "all" ? "" : tab} reviews</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start gap-4">
                  {/* Product Image */}
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {review.product_image ? (
                      <img
                        src={review.product_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {review.product_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={review.rating} />
                      <span className="text-xs text-gray-500">
                        by {review.customer_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-gray-600 mt-2">{review.review_text}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!review.is_approved && tab !== "approved" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => moderate(review.id, "approve")}
                        disabled={processing === review.id}
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                        title="Approve"
                      >
                        {processing === review.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => moderate(review.id, "reject")}
                        disabled={processing === review.id}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
