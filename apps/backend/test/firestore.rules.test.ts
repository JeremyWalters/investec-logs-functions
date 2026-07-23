import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-investec-logs";
let testEnvironment: RulesTestEnvironment;

const allScope = { mode: "all", accountNumbers: [], cardIds: [] };
const transaction = {
  accountNumber: "10000000001",
  dateTime: "2026-07-22T10:15:30.000Z",
  centsAmount: 12_345,
  currencyCode: "zar",
  type: "card",
  reference: "purchase-123",
  card: { id: "card-1", display: "Business card" },
  merchant: {
    name: "Example Merchant",
    city: "Cape Town",
    country: { code: "ZA", alpha3: "ZAR", name: "South Africa" },
    category: { code: "5812", key: "restaurants", name: "Restaurants" },
  },
  tags: [],
  occurredAt: Timestamp.fromDate(new Date("2026-07-22T10:15:30.000Z")),
  sourceHash: "a".repeat(64),
};

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, "../../../firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all([
      setDoc(doc(firestore, "accessProfiles/member"), {
        active: true,
        role: "member",
        transactionScope: allScope,
      }),
      setDoc(doc(firestore, "accessProfiles/inactive"), {
        active: false,
        role: "member",
        transactionScope: allScope,
      }),
      setDoc(doc(firestore, "accessProfiles/ingestor"), {
        active: true,
        role: "ingestor",
        transactionScope: allScope,
      }),
      setDoc(doc(firestore, "transactions/transaction-1"), transaction),
      setDoc(doc(firestore, "categories/restaurants"), transaction.merchant.category),
      setDoc(doc(firestore, "tags/coffee"), {
        name: "Coffee",
        applyFuture: true,
        merchantName: "Example Merchant",
      }),
    ]);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("company membership", () => {
  it("allows active members to read the shared collections", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertSucceeds(getDocs(collection(firestore, "transactions")));
    await assertSucceeds(getDocs(collection(firestore, "categories")));
    await assertSucceeds(getDocs(collection(firestore, "tags")));
  });

  it("denies unauthenticated, unknown, inactive, and ingestor ledger reads", async () => {
    const contexts = [
      testEnvironment.unauthenticatedContext(),
      testEnvironment.authenticatedContext("unknown"),
      testEnvironment.authenticatedContext("inactive"),
      testEnvironment.authenticatedContext("ingestor"),
    ];

    for (const context of contexts) {
      await assertFails(getDoc(doc(context.firestore(), "transactions/transaction-1")));
    }
  });

  it("allows users to read only their own access profile", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertSucceeds(getDoc(doc(firestore, "accessProfiles/member")));
    await assertFails(getDoc(doc(firestore, "accessProfiles/ingestor")));
    await assertFails(getDocs(collection(firestore, "accessProfiles")));
  });

  it("denies every client write to access profiles", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertFails(updateDoc(doc(firestore, "accessProfiles/member"), { role: "ingestor" }));
    await assertFails(
      setDoc(doc(firestore, "accessProfiles/new-member"), {
        active: true,
        role: "member",
        transactionScope: allScope,
      }),
    );
  });
});

describe("transaction integrity", () => {
  it("allows a member to update only a valid tag list", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertSucceeds(
      updateDoc(doc(firestore, "transactions/transaction-1"), { tags: ["Coffee"] }),
    );
  });

  it("denies transaction creation, deletion, and banking-field changes", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertFails(setDoc(doc(firestore, "transactions/new"), transaction));
    await assertFails(deleteDoc(doc(firestore, "transactions/transaction-1")));
    await assertFails(
      updateDoc(doc(firestore, "transactions/transaction-1"), { centsAmount: 1 }),
    );
  });

  it("denies invalid, duplicate, oversized, or non-string tag values", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    const reference = doc(firestore, "transactions/transaction-1");
    await assertFails(updateDoc(reference, { tags: ["Coffee", "Coffee"] }));
    await assertFails(updateDoc(reference, { tags: ["x".repeat(65)] }));
    await assertFails(updateDoc(reference, { tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) }));
    await assertFails(updateDoc(reference, { tags: [42] }));
  });
});

describe("tag definitions and server-owned categories", () => {
  it("allows members to manage valid tag definitions", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    const reference = doc(firestore, "tags/large");
    await assertSucceeds(
      setDoc(reference, {
        name: "Large",
        applyFuture: true,
        centsAmount: 10_000,
        amountOperator: ">=",
      }),
    );
    await assertSucceeds(deleteDoc(reference));
  });

  it("denies invalid tag definitions and all client category writes", async () => {
    const firestore = testEnvironment.authenticatedContext("member").firestore();
    await assertFails(
      setDoc(doc(firestore, "tags/invalid"), {
        name: "Invalid",
        applyFuture: true,
        merchantName: "Merchant",
        centsAmount: 100,
        amountOperator: ">",
      }),
    );
    await assertFails(
      updateDoc(doc(firestore, "categories/restaurants"), { name: "Changed" }),
    );
  });
});
