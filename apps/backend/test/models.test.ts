import { describe, expect, it } from "vitest";
import { accessProfileSchema, transactionRequestSchema } from "../src/models";
import { makeTransaction } from "./fixtures";

describe("transactionRequestSchema", () => {
  it("accepts a valid Investec transaction and strips unknown fields", () => {
    const parsed = transactionRequestSchema.parse({
      transaction: {
        ...makeTransaction(),
        unexpectedBankField: "discard me",
      },
      unexpectedEnvelopeField: true,
    });

    expect(parsed.transaction).toEqual(makeTransaction());
    expect(parsed).not.toHaveProperty("unexpectedEnvelopeField");
    expect(parsed.transaction).not.toHaveProperty("unexpectedBankField");
  });

  it("rejects an impossible transaction date", () => {
    const result = transactionRequestSchema.safeParse({
      transaction: makeTransaction({ dateTime: "2026-02-31T10:15:30.000Z" }),
    });

    expect(result.success).toBe(false);
  });

  it("rejects transaction strings that exceed storage limits", () => {
    const result = transactionRequestSchema.safeParse({
      transaction: makeTransaction({ reference: "x".repeat(257) }),
    });

    expect(result.success).toBe(false);
  });
});

describe("accessProfileSchema", () => {
  it("accepts an active shared-ledger member", () => {
    const result = accessProfileSchema.parse({
      active: true,
      role: "member",
      transactionScope: {
        mode: "all",
        accountNumbers: [],
        cardIds: [],
      },
    });

    expect(result.role).toBe("member");
  });

  it("rejects a restricted profile with no account or card assignments", () => {
    const result = accessProfileSchema.safeParse({
      active: true,
      role: "member",
      transactionScope: {
        mode: "restricted",
        accountNumbers: [],
        cardIds: [],
      },
    });

    expect(result.success).toBe(false);
  });
});
