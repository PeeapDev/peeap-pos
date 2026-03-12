export function formatCurrency(amount: number | string, currency = "NLe"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
}
