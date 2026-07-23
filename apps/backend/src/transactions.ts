import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { TagDefinition, TransactionInput } from "./models";

export interface StoredTransaction extends TransactionInput {
  tags: string[];
  occurredAt: Timestamp;
  sourceHash: string;
}

export function createTransactionId(transaction: TransactionInput): string {
  const canonicalTransaction = {
    accountNumber: transaction.accountNumber,
    dateTime: transaction.dateTime,
    centsAmount: transaction.centsAmount,
    currencyCode: transaction.currencyCode,
    type: transaction.type,
    reference: transaction.reference,
    card: {
      id: transaction.card.id,
      display: transaction.card.display,
    },
    merchant: {
      name: transaction.merchant.name,
      city: transaction.merchant.city,
      country: {
        code: transaction.merchant.country.code,
        alpha3: transaction.merchant.country.alpha3,
        name: transaction.merchant.country.name,
      },
      category: {
        code: transaction.merchant.category.code,
        key: transaction.merchant.category.key,
        name: transaction.merchant.category.name,
      },
    },
  };

  return createHash("sha256").update(JSON.stringify(canonicalTransaction)).digest("hex");
}

export function applyAutomaticTags(
  transaction: TransactionInput,
  tags: TagDefinition[],
): string[] {
  const matchesAmount = (tag: TagDefinition): boolean => {
    if (!("centsAmount" in tag) || !("amountOperator" in tag)) return false;

    const left = transaction.centsAmount;
    const right = tag.centsAmount;
    switch (tag.amountOperator) {
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case "==":
        return left === right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
    }
  };

  const applied = tags
    .filter((tag) => tag.applyFuture)
    .filter(
      (tag) =>
        matchesAmount(tag) ||
        ("merchantName" in tag && tag.merchantName === transaction.merchant.name),
    )
    .map((tag) => tag.name);

  return [...new Set(applied)];
}

export function buildStoredTransaction(
  transaction: TransactionInput,
  tags: string[],
): StoredTransaction {
  return {
    ...transaction,
    tags: [...new Set(tags)].slice(0, 20),
    occurredAt: Timestamp.fromDate(new Date(transaction.dateTime)),
    sourceHash: createTransactionId(transaction),
  };
}
