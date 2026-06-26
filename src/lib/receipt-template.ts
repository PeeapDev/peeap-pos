/**
 * Shared thermal (80mm) POS receipt template.
 *
 * One source of truth for what a Peeap POS receipt looks like, used by the
 * Receipts screen and the scan-to-pay QR modal so printed receipts are
 * consistent: store header → itemised body → totals → payment → a scannable
 * QR that points at the public /receipt/{number} verifier.
 *
 * Client-only (uses the `qrcode` lib via dynamic import to render the QR as a
 * data URI before building the HTML string).
 */
import { formatCurrency } from "@/utils/currency";

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  receiptNumber: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  customerName?: string | null;
  cashierName?: string | null;
  received?: number | null;
  change?: number | null;
  /** Footer line, e.g. a custom thank-you from store settings. */
  footerNote?: string | null;
}

const RECEIPT_BASE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

/** Public URL a receipt QR points at — the verifier page. */
export function receiptVerifyUrl(receiptNumber: string): string {
  return `${RECEIPT_BASE_URL}/receipt/${encodeURIComponent(receiptNumber)}`;
}

/** QR for arbitrary text as a PNG data URI. Empty string on failure. */
export async function qrDataUri(text: string, size = 150): Promise<string> {
  try {
    const QRC = await import("qrcode");
    return await QRC.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Build the full printable receipt HTML document, with the verification QR
 * already embedded as a data URI.
 */
export async function buildReceiptHtml(data: ReceiptData): Promise<string> {
  const verifyUrl = receiptVerifyUrl(data.receiptNumber);
  const qr = await qrDataUri(verifyUrl, 150);

  const itemRows = data.items
    .filter((i) => (i.qty || 0) > 0)
    .map(
      (i) => `
        <tr>
          <td class="it">${esc(i.name)}<div class="sub">${i.qty} × ${formatCurrency(
            i.unitPrice
          )}</div></td>
          <td class="amt">${formatCurrency(i.total)}</td>
        </tr>`
    )
    .join("");

  const line = (label: string, value: string, cls = "") =>
    `<tr class="${cls}"><td>${esc(label)}</td><td class="amt">${esc(value)}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>Receipt ${esc(data.receiptNumber)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Courier New',ui-monospace,monospace;color:#000}
    body{width:280px;margin:0 auto;padding:12px}
    .c{text-align:center}.b{font-weight:bold}
    .name{font-size:17px;font-weight:bold}
    .muted{font-size:10px;color:#333}
    hr{border:none;border-top:1px dashed #000;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    td{padding:2px 0;vertical-align:top}
    .amt{text-align:right;white-space:nowrap;padding-left:8px}
    .it .sub{font-size:10px;color:#555}
    .tot td{font-size:16px;font-weight:bold;border-top:1px solid #000;padding-top:5px}
    .badge{display:inline-block;border:2px solid #000;border-radius:6px;padding:2px 12px;font-weight:bold;margin-top:6px;font-size:12px}
    .qr{margin-top:8px}.qr img{width:140px;height:140px}
    @media print{ body{width:auto} @page{margin:0;size:80mm auto} }
  </style></head><body>
    <div class="c name">${esc(data.storeName)}</div>
    ${data.storeAddress ? `<div class="c muted">${esc(data.storeAddress)}</div>` : ""}
    ${data.storePhone ? `<div class="c muted">Tel: ${esc(data.storePhone)}</div>` : ""}
    <hr/>
    <div class="muted">Receipt: ${esc(data.receiptNumber)}</div>
    <div class="muted">${esc(data.date.toLocaleString())}</div>
    ${data.cashierName ? `<div class="muted">Cashier: ${esc(data.cashierName)}</div>` : ""}
    ${data.customerName ? `<div class="muted">Customer: ${esc(data.customerName)}</div>` : ""}
    <hr/>
    <table>${itemRows || line("Sale", formatCurrency(data.total))}</table>
    <hr/>
    <table>
      ${line("Subtotal", formatCurrency(data.subtotal))}
      ${data.tax ? line("Tax", formatCurrency(data.tax)) : ""}
      ${data.discount ? line("Discount", "-" + formatCurrency(data.discount)) : ""}
      <tr class="tot"><td>TOTAL</td><td class="amt">${formatCurrency(data.total)}</td></tr>
    </table>
    <hr/>
    <table>
      ${line("Payment", data.paymentMethod)}
      ${
        typeof data.received === "number"
          ? line("Received", formatCurrency(data.received))
          : ""
      }
      ${
        typeof data.change === "number"
          ? line("Change", formatCurrency(data.change))
          : ""
      }
    </table>
    <div class="c"><span class="badge">PAID</span></div>
    ${
      qr
        ? `<div class="c qr"><img src="${qr}" alt="Verify receipt"/><div class="muted">Scan to verify this receipt</div></div>`
        : ""
    }
    <hr/>
    <div class="c muted">${data.footerNote ? esc(data.footerNote) + "<br/>" : ""}Thank you!</div>
    <div class="c muted" style="margin-top:4px">Powered by Peeap · peeap.com</div>
  </body></html>`;
}

/** Build the receipt HTML and send it to the printer via a hidden iframe. */
export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = await buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow!;
  win.onafterprint = () => setTimeout(() => document.body.removeChild(iframe), 100);
  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}
