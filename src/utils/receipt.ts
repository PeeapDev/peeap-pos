import { formatCurrency } from "./currency";

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export function generateReceiptText(
  sale: {
    sale_number: string;
    total_amount: number;
    discount_amount: number;
    tax_amount: number;
    payment_method: string;
    created_at: string;
    items?: ReceiptItem[];
  },
  businessName: string,
  phone?: string
): string {
  const lines: string[] = [];
  const w = 32;

  lines.push(businessName.toUpperCase().padStart((w + businessName.length) / 2));
  if (phone) lines.push(phone.padStart((w + phone.length) / 2));
  lines.push("-".repeat(w));
  lines.push(`Receipt: ${sale.sale_number}`);
  lines.push(`Date: ${new Date(sale.created_at).toLocaleString()}`);
  lines.push("-".repeat(w));

  if (sale.items) {
    for (const item of sale.items) {
      lines.push(`${item.product_name}`);
      lines.push(
        `  ${item.quantity} x ${formatCurrency(item.unit_price)}  ${formatCurrency(item.total_price)}`
      );
    }
  }

  lines.push("-".repeat(w));
  if (sale.discount_amount > 0) {
    lines.push(`Discount: -${formatCurrency(sale.discount_amount)}`);
  }
  if (sale.tax_amount > 0) {
    lines.push(`Tax: ${formatCurrency(sale.tax_amount)}`);
  }
  lines.push(`TOTAL: ${formatCurrency(sale.total_amount)}`);
  lines.push(`Paid by: ${sale.payment_method.replace(/_/g, " ")}`);
  lines.push("-".repeat(w));
  lines.push("Thank you for your purchase!");

  return lines.join("\n");
}
