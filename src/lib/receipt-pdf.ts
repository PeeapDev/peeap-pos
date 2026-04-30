/**
 * Receipt PDF Generator — Creates professional, printable receipt PDFs using jsPDF.
 * Includes: store logo, product images, QR code, VAT breakdown, totals.
 * Designed for 80mm thermal printer width, also looks good on A4/mobile.
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  tax_rate?: number;
  tax_amount?: number;
}

export interface ReceiptData {
  order_number: string;
  store_name: string;
  customer_name: string;
  items: ReceiptItem[];
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  order_type: string;
  delivery_address?: string;
  created_at?: string;
  // New fields for rich receipt
  store_logo_url?: string | null;
  store_address?: string | null;
  store_phone?: string | null;
  tracking_url?: string | null;
  currency?: string;
}

function fmtAmount(amount: number, currency = "NLe"): string {
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);
  const [int, dec] = fixed.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${amount < 0 ? "-" : ""}${withCommas}.${dec}`;
}

/** Fetch an image URL and return base64 data URI. Returns null on failure. */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Generate QR code as base64 data URI */
async function generateQRDataUri(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

export async function generateReceiptPDF(data: ReceiptData): Promise<ArrayBuffer> {
  const pw = 80; // page width in mm
  const m = 5;   // margin
  const right = pw - m;
  const cw = pw - 2 * m; // content width
  const currency = data.currency || "NLe";

  // Pre-fetch images in parallel
  const [logoBase64, qrBase64, ...itemImages] = await Promise.all([
    data.store_logo_url ? fetchImageAsBase64(data.store_logo_url) : null,
    generateQRDataUri(
      data.tracking_url || `https://store.peeap.com/order/${data.order_number}`
    ),
    ...data.items.slice(0, 10).map((item) =>
      item.image_url ? fetchImageAsBase64(item.image_url) : Promise.resolve(null)
    ),
  ]);

  // Calculate VAT breakdown per rate
  const vatRates = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const item of data.items) {
    const rate = item.tax_rate || 0;
    if (rate > 0) {
      const existing = vatRates.get(rate) || { rate, taxable: 0, tax: 0 };
      existing.taxable += item.unit_price * item.quantity;
      existing.tax += item.tax_amount || (item.unit_price * item.quantity * rate / 100);
      vatRates.set(rate, existing);
    }
  }

  // Estimate page height
  const hasLogo = !!logoBase64;
  const hasQR = !!qrBase64;
  const hasImages = itemImages.some(Boolean);
  const itemCount = data.items.length;
  const lineHeight = hasImages ? 14 : 4; // taller rows if images
  const headerHeight = hasLogo ? 30 : 15;
  const qrHeight = hasQR ? 35 : 0;
  const vatLines = vatRates.size;
  const pageHeight = Math.max(
    headerHeight + 40 + itemCount * lineHeight + vatLines * 4 + qrHeight + 50,
    120
  );

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pw, pageHeight],
  });

  let y = 6;

  // ── STORE LOGO ──
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", pw / 2 - 8, y, 16, 16);
      y += 18;
    } catch {
      // Logo load failed, skip
    }
  }

  // ── STORE NAME ──
  doc.setFontSize(hasLogo ? 11 : 13);
  doc.setFont("helvetica", "bold");
  doc.text(data.store_name, pw / 2, y, { align: "center" });
  y += 4;

  // Store address and phone
  if (data.store_address || data.store_phone) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (data.store_address) {
      const addr = data.store_address.length > 45
        ? data.store_address.slice(0, 42) + "..."
        : data.store_address;
      doc.text(addr, pw / 2, y, { align: "center" });
      y += 3;
    }
    if (data.store_phone) {
      doc.text(data.store_phone, pw / 2, y, { align: "center" });
      y += 3;
    }
    doc.setTextColor(0);
  }

  y += 1;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ORDER RECEIPT", pw / 2, y, { align: "center" });
  y += 4;

  // ── Separator ──
  drawDottedLine(doc, m, y, right);
  y += 4;

  // ── ORDER INFO ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Order #${data.order_number}`, m, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  const date = data.created_at ? new Date(data.created_at) : new Date();
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Date: ${dateStr}, ${timeStr}`, m, y);
  y += 4;

  doc.text(`Customer: ${data.customer_name}`, m, y);
  y += 4;

  if (data.order_type) {
    const label = data.order_type === "delivery" ? "Delivery"
      : data.order_type === "pickup" ? "Pickup" : "Online";
    doc.text(`Type: ${label}`, m, y);
    y += 4;
  }

  if (data.delivery_address) {
    const addr = data.delivery_address.length > 38
      ? data.delivery_address.slice(0, 35) + "..."
      : data.delivery_address;
    doc.text(`Ship to: ${addr}`, m, y);
    y += 4;
  }

  // ── ITEMS HEADER ──
  y += 1;
  drawDottedLine(doc, m, y, right);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ITEM", m, y);
  doc.text("QTY", pw / 2 + 4, y, { align: "center" });
  doc.text("AMOUNT", right, y, { align: "right" });
  y += 1;
  drawDottedLine(doc, m, y, right);
  y += 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  // ── ITEMS WITH OPTIONAL IMAGES ──
  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const imgBase64 = idx < itemImages.length ? itemImages[idx] : null;

    if (imgBase64) {
      // Row with product image
      const imgSize = 10;
      try {
        doc.addImage(imgBase64, "JPEG", m, y - 2, imgSize, imgSize);
      } catch { /* skip image */ }

      const textX = m + imgSize + 2;
      const name = item.product_name.length > 18
        ? item.product_name.slice(0, 15) + "..."
        : item.product_name;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(name, textX, y + 1);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text(`${item.quantity} x ${fmtAmount(item.unit_price, currency)}`, textX, y + 5);
      if (item.tax_rate && item.tax_rate > 0) {
        doc.text(`VAT ${item.tax_rate}%`, textX, y + 8);
      }
      doc.setTextColor(0);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(fmtAmount(item.total_price, currency), right, y + 3, { align: "right" });

      doc.setFont("helvetica", "normal");
      y += imgSize + 2;
    } else {
      // Text-only row
      const name = item.product_name.length > 26
        ? item.product_name.slice(0, 23) + "..."
        : item.product_name;
      doc.text(name, m, y);
      doc.text(`${item.quantity}`, pw / 2 + 4, y, { align: "center" });
      doc.text(fmtAmount(item.total_price, currency), right, y, { align: "right" });
      y += 4;

      if (item.quantity > 1 || (item.tax_rate && item.tax_rate > 0)) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        let detail = `  ${item.quantity} x ${fmtAmount(item.unit_price, currency)}`;
        if (item.tax_rate && item.tax_rate > 0) {
          detail += ` (VAT ${item.tax_rate}%)`;
        }
        doc.text(detail, m, y);
        doc.setFontSize(8);
        doc.setTextColor(0);
        y += 4;
      }
    }
  }

  // ── TOTALS ──
  y += 1;
  drawDottedLine(doc, m, y, right);
  y += 4;

  doc.text("Subtotal:", m, y);
  doc.text(fmtAmount(data.subtotal, currency), right, y, { align: "right" });
  y += 4;

  // VAT breakdown by rate
  if (vatRates.size > 0) {
    for (const [rate, vat] of vatRates) {
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text(`VAT ${rate}% (on ${fmtAmount(vat.taxable, currency)}):`, m, y);
      doc.text(fmtAmount(vat.tax, currency), right, y, { align: "right" });
      doc.setFontSize(8);
      doc.setTextColor(0);
      y += 4;
    }
  } else if (data.tax_amount > 0) {
    doc.text("Tax:", m, y);
    doc.text(fmtAmount(data.tax_amount, currency), right, y, { align: "right" });
    y += 4;
  }

  if (data.delivery_fee > 0) {
    doc.text("Delivery:", m, y);
    doc.text(fmtAmount(data.delivery_fee, currency), right, y, { align: "right" });
    y += 4;
  }

  // ── GRAND TOTAL ──
  y += 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(m, y, right, y);
  y += 5;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", m, y);
  doc.text(fmtAmount(data.total_amount, currency), right, y, { align: "right" });
  y += 5;

  // ── PAYMENT METHOD ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const payLabel = data.payment_method
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  doc.text(`Paid by: ${payLabel}`, m, y);
  y += 5;

  // ── QR CODE ──
  if (qrBase64) {
    drawDottedLine(doc, m, y, right);
    y += 3;

    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text("Scan to track your order", pw / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 2;

    try {
      const qrSize = 22;
      doc.addImage(qrBase64, "PNG", pw / 2 - qrSize / 2, y, qrSize, qrSize);
      y += qrSize + 2;
    } catch {
      // QR generation failed, skip
    }
  }

  // ── FOOTER ──
  drawDottedLine(doc, m, y, right);
  y += 4;

  doc.setFontSize(7.5);
  doc.text("Thank you for your order!", pw / 2, y, { align: "center" });
  y += 3;
  doc.setFontSize(6.5);
  doc.setTextColor(130);
  doc.text("Powered by Peeap  |  peeap.com", pw / 2, y, { align: "center" });

  return doc.output("arraybuffer");
}

/** Draw a dotted/dashed separator line */
function drawDottedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  const gap = 1.5;
  for (let x = x1; x < x2; x += gap * 2) {
    doc.line(x, y, Math.min(x + gap, x2), y);
  }
}
