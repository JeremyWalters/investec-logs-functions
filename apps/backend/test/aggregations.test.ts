import { describe, expect, it } from "vitest";
import { summarizeByCategory, summarizeByMonth } from "../src/aggregations";
import { makeTransaction } from "./fixtures";

describe("summarizeByMonth", () => {
  it("groups dates using the Africa/Johannesburg calendar month", () => {
    const result = summarizeByMonth([
      makeTransaction({ dateTime: "2026-06-30T22:30:00.000Z", centsAmount: 100 }),
      makeTransaction({ dateTime: "2026-07-15T12:00:00.000Z", centsAmount: 250 }),
    ]);

    expect(result).toEqual({ "Jul 2026": 350 });
  });
});

describe("summarizeByCategory", () => {
  it("totals cents by merchant category name", () => {
    const result = summarizeByCategory([
      makeTransaction({ centsAmount: 100 }),
      makeTransaction({ centsAmount: 250 }),
      makeTransaction({
        centsAmount: 80,
        merchant: {
          ...makeTransaction().merchant,
          category: { code: "5411", key: "groceries", name: "Groceries" },
        },
      }),
    ]);

    expect(result).toEqual({ Restaurants: 350, Groceries: 80 });
  });
});
