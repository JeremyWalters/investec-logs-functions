import type { TransactionInput } from "./models";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});

export function summarizeByMonth(transactions: TransactionInput[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((summary, transaction) => {
    const month = monthFormatter.format(new Date(transaction.dateTime));
    summary[month] = (summary[month] ?? 0) + transaction.centsAmount;
    return summary;
  }, {});
}

export function summarizeByCategory(transactions: TransactionInput[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((summary, transaction) => {
    const category = transaction.merchant.category.name;
    summary[category] = (summary[category] ?? 0) + transaction.centsAmount;
    return summary;
  }, {});
}
