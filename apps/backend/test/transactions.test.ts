import { describe, expect, it } from "vitest";
import type { TagDefinition } from "../src/models";
import {
  applyAutomaticTags,
  buildStoredTransaction,
  createTransactionId,
} from "../src/transactions";
import { makeTransaction } from "./fixtures";

describe("createTransactionId", () => {
  it("returns the same ID for semantically identical transactions", () => {
    const first = makeTransaction();
    const reordered = {
      ...first,
      merchant: {
        category: first.merchant.category,
        country: first.merchant.country,
        city: first.merchant.city,
        name: first.merchant.name,
      },
    };

    expect(createTransactionId(first)).toBe(createTransactionId(reordered));
  });

  it("returns a different ID when an immutable transaction field changes", () => {
    expect(createTransactionId(makeTransaction())).not.toBe(
      createTransactionId(makeTransaction({ centsAmount: 12_346 })),
    );
  });
});

describe("applyAutomaticTags", () => {
  it("applies active amount and merchant rules without duplicate tag names", () => {
    const tags: TagDefinition[] = [
      { name: "Large", applyFuture: true, centsAmount: 10_000, amountOperator: ">=" },
      { name: "Coffee", applyFuture: true, merchantName: "Example Merchant" },
      { name: "Coffee", applyFuture: true, merchantName: "Example Merchant" },
      { name: "Ignored", applyFuture: false, merchantName: "Example Merchant" },
    ];

    expect(applyAutomaticTags(makeTransaction(), tags)).toEqual(["Large", "Coffee"]);
  });

  it("uses strict equality for amount rules", () => {
    const tags: TagDefinition[] = [
      { name: "Exact", applyFuture: true, centsAmount: 12_345, amountOperator: "==" },
    ];

    expect(applyAutomaticTags(makeTransaction(), tags)).toEqual(["Exact"]);
  });
});

describe("buildStoredTransaction", () => {
  it("adds trusted metadata and never accepts client-provided tags", () => {
    const stored = buildStoredTransaction(makeTransaction(), ["Approved"]);

    expect(stored.tags).toEqual(["Approved"]);
    expect(stored.sourceHash).toBe(createTransactionId(makeTransaction()));
    expect(stored.occurredAt.toDate().toISOString()).toBe(makeTransaction().dateTime);
  });
});
