"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Printer,
  Loader2,
  Search,
  Eye,
  Share2,
  Receipt,
  X,
  Calendar,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";
import {
  printReceipt,
  qrDataUri,
  receiptVerifyUrl,
  type ReceiptData,
} from "@/lib/receipt-template";

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
}

interface Sale {
  id: string;
  sale_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_details: Record<string, unknown> | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  cashier_name: string | null;
  notes: string | null;
  created_at: string;
  items: SaleItem[];
}

export default function ReceiptsPage() {
  const { token } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [store, setStore] = useState<{
    name?: string;
    address?: string;
    phone?: string;
  } | null>(null);
  const [previewQr, setPreviewQr] = useState<string>("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchSales = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sales?limit=100&status=completed", {
        headers,
      });
      const data = await res.json();
      setSales(data.sales || []);
    } catch (err) {
      console.error("Failed to load sales:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Store profile for the receipt header (name / address / phone).
  useEffect(() => {
    if (!token) return;
    fetch("/api/stores", { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { store?: { name?: string; address?: string; phone?: string } }) => {
        if (d?.store) {
          setStore({
            name: d.store.name,
            address: d.store.address,
            phone: d.store.phone,
          });
        }
      })
      .catch(() => {});
  }, [token, headers]);

  // Render the verification QR for the on-screen preview.
  useEffect(() => {
    if (!selectedSale) {
      setPreviewQr("");
      return;
    }
    let alive = true;
    qrDataUri(receiptVerifyUrl(selectedSale.sale_number), 160).then((uri) => {
      if (alive) setPreviewQr(uri);
    });
    return () => {
      alive = false;
    };
  }, [selectedSale]);

  const saleToReceipt = useCallback(
    (sale: Sale): ReceiptData => ({
      storeName: store?.name || "Peeap Store",
      storeAddress: store?.address || null,
      storePhone: store?.phone || null,
      receiptNumber: sale.sale_number,
      date: new Date(sale.created_at),
      items: sale.items.map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        unitPrice: i.unit_price,
        total: i.total_price,
      })),
      subtotal: sale.subtotal,
      tax: sale.tax_amount || undefined,
      discount: sale.discount_amount || undefined,
      total: sale.total_amount,
      paymentMethod: sale.payment_method
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      customerName: sale.customer_name,
      cashierName: sale.cashier_name,
      received:
        typeof sale.payment_details?.received === "number"
          ? (sale.payment_details.received as number)
          : null,
      change:
        typeof sale.payment_details?.change === "number"
          ? (sale.payment_details.change as number)
          : null,
    }),
    [store]
  );

  const filteredSales = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.customer_phone && s.customer_phone.includes(q))
    );
  }, [sales, search]);

  const handlePrint = (sale: Sale) => {
    void printReceipt(saleToReceipt(sale));
  };

  const handleWhatsAppShare = (sale: Sale) => {
    const lines = [
      `*Receipt - ${sale.sale_number}*`,
      `Date: ${new Date(sale.created_at).toLocaleString()}`,
      "",
      ...sale.items.map(
        (item) =>
          `${item.quantity}x ${item.product_name} - ${formatCurrency(
            item.total_price
          )}`
      ),
      "",
      `Subtotal: ${formatCurrency(sale.subtotal)}`,
    ];

    if (sale.tax_amount > 0) {
      lines.push(`Tax: ${formatCurrency(sale.tax_amount)}`);
    }
    if (sale.discount_amount > 0) {
      lines.push(`Discount: -${formatCurrency(sale.discount_amount)}`);
    }
    lines.push(`*Total: ${formatCurrency(sale.total_amount)}*`);
    lines.push(`Payment: ${sale.payment_method.replace(/_/g, " ")}`);
    lines.push("", "Thank you for your purchase!");

    const text = encodeURIComponent(lines.join("\n"));
    const phone = sale.customer_phone
      ? `&phone=${sale.customer_phone.replace(/\D/g, "")}`
      : "";
    window.open(`https://wa.me/?text=${text}${phone}`, "_blank");
  };

  const formatPaymentMethod = (method: string) => {
    return method
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            Receipts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {sales.length} completed sales
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by sale number, customer name, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No receipts found</p>
            <p className="text-sm mt-1">
              {search
                ? "Try a different search"
                : "Completed sales will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {sale.sale_number}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(sale.created_at).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {formatPaymentMethod(sale.payment_method)}
                      </span>
                      {sale.customer_name && (
                        <span className="text-xs text-gray-500">
                          {sale.customer_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(sale.total_amount)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {sale.items.length} item
                      {sale.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="View Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePrint(sale)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleWhatsAppShare(sale)}
                      className="p-2 hover:bg-green-50 rounded-lg text-gray-500 hover:text-green-600"
                      title="Share via WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      <Modal
        open={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title="Receipt Preview"
        size="sm"
      >
        {selectedSale && (
          <div>
            {/* Receipt Content */}
            <div className="bg-white border rounded-lg p-6 font-mono text-sm">
              {/* Header */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold">{store?.name || "Peeap Store"}</h3>
                {store?.address && (
                  <p className="text-[11px] text-gray-500">{store.address}</p>
                )}
                {store?.phone && (
                  <p className="text-[11px] text-gray-500">Tel: {store.phone}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Receipt #{selectedSale.sale_number}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedSale.created_at).toLocaleString()}
                </p>
              </div>

              <div className="border-t border-dashed pt-3 mb-3" />

              {/* Items */}
              <div className="space-y-2">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-gray-500">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.total_price)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed my-3" />

              {/* Totals */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(selectedSale.tax_amount)}</span>
                  </div>
                )}
                {selectedSale.discount_amount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount</span>
                    <span>
                      -{formatCurrency(selectedSale.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(selectedSale.total_amount)}</span>
                </div>
              </div>

              <div className="border-t border-dashed my-3" />

              {/* Payment info */}
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span>
                    {formatPaymentMethod(selectedSale.payment_method)}
                  </span>
                </div>
                {selectedSale.payment_details &&
                  typeof selectedSale.payment_details.received === "number" && (
                  <>
                    <div className="flex justify-between">
                      <span>Received</span>
                      <span>
                        {formatCurrency(
                          selectedSale.payment_details.received as number
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Change</span>
                      <span>
                        {formatCurrency(
                          (selectedSale.payment_details.change as number) || 0
                        )}
                      </span>
                    </div>
                  </>
                )}
                {selectedSale.customer_name && (
                  <div className="flex justify-between">
                    <span>Customer</span>
                    <span>{selectedSale.customer_name}</span>
                  </div>
                )}
                {selectedSale.cashier_name && (
                  <div className="flex justify-between">
                    <span>Cashier</span>
                    <span>{selectedSale.cashier_name}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed my-3" />

              {/* Verification QR */}
              {previewQr && (
                <div className="flex flex-col items-center mt-1 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewQr} alt="Verify receipt" className="w-32 h-32" />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Scan to verify this receipt
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-gray-500">
                <p>Thank you for your purchase!</p>
                <p className="mt-1">Powered by Peeap</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handlePrint(selectedSale)}
                className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => handleWhatsAppShare(selectedSale)}
                className="flex-1 py-2.5 bg-[#25D366] text-white font-medium rounded-lg hover:bg-[#1fb855] transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
