import { logger } from "firebase-functions";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { assertSharedLedgerAccess, loadAccessProfile } from "./access";
import { summarizeByCategory, summarizeByMonth } from "./aggregations";
import { app } from "./http";
import { transactionInputSchema } from "./models";
import { listTransactions, upsertCategory } from "./repository";

setGlobalOptions({
  region: "africa-south1",
  minInstances: 0,
  maxInstances: 3,
  memory: "256MiB",
});

async function authorizeMember(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  assertSharedLedgerAccess(await loadAccessProfile(uid));
}

export const webApi = onRequest({ concurrency: 20 }, app);

export const getSpendingByMonth = onCall({ concurrency: 20 }, async (request) => {
  await authorizeMember(request.auth?.uid);
  return summarizeByMonth(await listTransactions());
});

export const getSpendingByCategory = onCall({ concurrency: 20 }, async (request) => {
  await authorizeMember(request.auth?.uid);
  return summarizeByCategory(await listTransactions());
});

export const onNewTransaction = onDocumentCreated(
  "transactions/{transactionId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const transaction = transactionInputSchema.safeParse(snapshot.data());
    if (!transaction.success) {
      logger.warn("Created transaction is invalid", {
        transactionId: event.params.transactionId,
      });
      return;
    }

    await upsertCategory(transaction.data.merchant.category);
  },
);

export { app };
