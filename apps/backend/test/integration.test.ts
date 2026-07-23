import { getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
} from "firebase/auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTransaction } from "./fixtures";

const projectId = "demo-investec-logs";
const clientApp = initializeClientApp({ apiKey: "demo-api-key", projectId }, "integration-client");
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, "http://127.0.0.1:19099", { disableWarnings: true });

const adminApp = getApps()[0] ?? initializeAdminApp({ projectId });
const adminFirestore = getAdminFirestore(adminApp);
const endpoint = "http://127.0.0.1:15000/api/v1/transactions";

let ingestorToken: string;
let memberToken: string;

async function clearFirestore(): Promise<void> {
  const collections = await adminFirestore.listCollections();
  await Promise.all(
    collections.map(async (entry) => {
      const documents = await entry.listDocuments();
      await Promise.all(documents.map((document) => document.delete()));
    }),
  );
}

beforeAll(async () => {
  await clearFirestore();

  const ingestor = await createUserWithEmailAndPassword(
    clientAuth,
    "ingestor@example.test",
    "correct-horse-battery-staple",
  );
  ingestorToken = await getIdToken(ingestor.user);

  const member = await createUserWithEmailAndPassword(
    clientAuth,
    "member@example.test",
    "correct-horse-battery-staple",
  );
  memberToken = await getIdToken(member.user);

  await Promise.all([
    adminFirestore.collection("accessProfiles").doc(ingestor.user.uid).set({
      active: true,
      role: "ingestor",
      transactionScope: { mode: "all", accountNumbers: [], cardIds: [] },
    }),
    adminFirestore.collection("accessProfiles").doc(member.user.uid).set({
      active: true,
      role: "member",
      transactionScope: { mode: "all", accountNumbers: [], cardIds: [] },
    }),
  ]);
});

afterAll(async () => {
  await clearFirestore();
});

describe("POST /api/v1/transactions", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transaction: makeTransaction() }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects an authenticated member without the ingestor role", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ transaction: makeTransaction() }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a transaction once and treats an exact retry as a duplicate", async () => {
    const request = () =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${ingestorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ transaction: makeTransaction() }),
      });

    const created = await request();
    const duplicate = await request();
    const snapshot = await adminFirestore.collection("transactions").get();

    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(200);
    expect(snapshot.size).toBe(1);
  });

  it("rejects invalid transaction payloads without writing data", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ingestorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ transaction: makeTransaction({ dateTime: "not-a-date" }) }),
    });

    expect(response.status).toBe(400);
  });
});
