"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, CheckCircle, Clock, AlertTriangle, Printer, Smartphone } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatCurrency } from "@/utils/currency";
import { printReceipt } from "@/lib/receipt-template";

interface QrLineItem {
  product_id?: string | null;
  name?: string;
  qty?: number;
  price?: number;
}

interface Props {
  open: boolean;
  token: string | null;
  amount: number;
  lineItems?: QrLineItem[];
  storeName?: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  onPaid?: () => void;
  onClose: () => void;
}

type Phase = "creating" | "awaiting" | "paid" | "expired" | "error";

// Small QR renderer using the `qrcode` lib → data URI (same approach as the
// shop checkout page), so we don't depend on a React wrapper.
function QRImage({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QRC) =>
        QRC.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      )
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (!src) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg"
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Scan to pay" width={size} height={size} />;
}

export default function PeeapQrModal({
  open,
  token,
  amount,
  lineItems = [],
  storeName = "Store",
  storeAddress = null,
  storePhone = null,
  onPaid,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("creating");
  const [qrUrl, setQrUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const paidAtRef = useRef<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Create the session once when the modal opens.
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    setPhase("creating");
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/vendor/pos/charge/qr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount, line_items: lineItems }),
        });
        const data = await res.json();
        if (!res.ok || !data.qr_url) {
          throw new Error(data.detail || data.error || "Could not start payment");
        }
        setQrUrl(data.qr_url);
        setSessionId(data.session_id);
        setPhase("awaiting");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start payment");
        setPhase("error");
      }
    })();
  }, [open, token, amount, lineItems]);

  // Poll for completion while awaiting.
  useEffect(() => {
    if (phase !== "awaiting" || !sessionId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/vendor/pos/charge/qr/status/${encodeURIComponent(sessionId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (stopped) return;
        if (data.paid) {
          paidAtRef.current = new Date();
          stopPolling();
          setPhase("paid");
          onPaid?.();
        } else if (data.expired || data.cancelled) {
          stopPolling();
          setPhase("expired");
        }
      } catch {
        // keep polling
      }
    };

    pollRef.current = setInterval(tick, 2500);
    void tick();
    return () => {
      stopped = true;
      stopPolling();
    };
  }, [phase, sessionId, token, onPaid, stopPolling]);

  // Reset internal state whenever the modal is fully closed.
  useEffect(() => {
    if (!open) {
      stopPolling();
      startedRef.current = false;
      setPhase("creating");
      setQrUrl("");
      setSessionId("");
      setError(null);
      paidAtRef.current = null;
    }
  }, [open, stopPolling]);

  return (
    <Modal open={open} onClose={onClose} title="Charge with Peeap" size="sm">
      <div className="space-y-5">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500">Amount Due</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatCurrency(amount)}
          </p>
        </div>

        {phase === "creating" && (
          <div className="flex flex-col items-center py-8 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Generating secure QR…</p>
          </div>
        )}

        {phase === "awaiting" && qrUrl && (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-xl border-2 border-green-100">
              <QRImage value={qrUrl} size={220} />
            </div>
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
              <Smartphone className="w-4 h-4 text-green-600" />
              <span>Ask the customer to scan with their Peeap app</span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-amber-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Waiting for payment…
            </div>
          </div>
        )}

        {phase === "paid" && (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">Payment received</p>
            <p className="text-sm text-gray-500 mt-1">{formatCurrency(amount)} paid</p>

            <div className="grid grid-cols-2 gap-2 w-full mt-5">
              <button
                onClick={() =>
                  void printReceipt({
                    storeName,
                    storeAddress,
                    storePhone,
                    receiptNumber: `POS-${sessionId.slice(-10).toUpperCase()}`,
                    date: paidAtRef.current || new Date(),
                    items: lineItems
                      .filter((i) => (i.qty || 0) > 0)
                      .map((i) => ({
                        name: i.name || "Item",
                        qty: i.qty || 1,
                        unitPrice: i.price || 0,
                        total: (i.qty || 1) * (i.price || 0),
                      })),
                    subtotal: amount,
                    total: amount,
                    paymentMethod: "Peeap Wallet",
                  })
                }
                className="flex items-center justify-center gap-2 py-3 border rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                Print receipt
              </button>
              <button
                onClick={onClose}
                className="py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
              >
                New sale
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              A receipt was also sent to the customer&apos;s Peeap app as verification.
            </p>
          </div>
        )}

        {phase === "expired" && (
          <div className="flex flex-col items-center py-6 text-center">
            <Clock className="w-10 h-10 text-amber-500 mb-2" />
            <p className="font-semibold text-gray-900">QR expired or cancelled</p>
            <p className="text-sm text-gray-500 mt-1">
              No payment was taken. Start a new charge to try again.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center py-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
            <p className="font-semibold text-gray-900">Couldn&apos;t start payment</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
