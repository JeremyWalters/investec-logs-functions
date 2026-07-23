import { describe, expect, it } from "vitest";
import type { AccessProfile } from "../src/models";
import { assertActiveRole, assertSharedLedgerAccess } from "../src/access";

const memberProfile: AccessProfile = {
  active: true,
  role: "member",
  transactionScope: { mode: "all", accountNumbers: [], cardIds: [] },
};

describe("assertActiveRole", () => {
  it("allows an active profile with the required role", () => {
    expect(() => assertActiveRole(memberProfile, "member")).not.toThrow();
  });

  it("denies a disabled profile", () => {
    expect(() => assertActiveRole({ ...memberProfile, active: false }, "member")).toThrowError(
      expect.objectContaining({ code: "permission-denied" }),
    );
  });

  it("denies a profile with the wrong role", () => {
    expect(() => assertActiveRole(memberProfile, "ingestor")).toThrowError(
      expect.objectContaining({ code: "permission-denied" }),
    );
  });

  it("denies a missing or invalid profile", () => {
    expect(() => assertActiveRole(undefined, "member")).toThrowError(
      expect.objectContaining({ code: "permission-denied" }),
    );
  });
});

describe("assertSharedLedgerAccess", () => {
  it("allows an active member with company-wide access", () => {
    expect(() => assertSharedLedgerAccess(memberProfile)).not.toThrow();
  });

  it("fails closed for future restricted profiles", () => {
    expect(() =>
      assertSharedLedgerAccess({
        ...memberProfile,
        transactionScope: {
          mode: "restricted",
          accountNumbers: ["10000000001"],
          cardIds: [],
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "permission-denied" }));
  });
});
