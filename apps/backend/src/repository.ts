import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { database } from "./firebase";
import {
  categorySchema,
  tagDefinitionSchema,
  transactionInputSchema,
  type Category,
  type TagDefinition,
  type TransactionInput,
} from "./models";
import {
  applyAutomaticTags,
  buildStoredTransaction,
  createTransactionId,
} from "./transactions";

export const TRANSACTIONS_COLLECTION = "transactions";
export const CATEGORIES_COLLECTION = "categories";
export const TAGS_COLLECTION = "tags";

export async function listTagDefinitions(
  firestore: Firestore = database,
): Promise<TagDefinition[]> {
  const snapshot = await firestore.collection(TAGS_COLLECTION).get();
  return snapshot.docs.flatMap((document) => {
    const parsed = tagDefinitionSchema.safeParse(document.data());
    if (parsed.success) return [parsed.data];

    logger.warn("Ignoring invalid tag definition", { tagId: document.id });
    return [];
  });
}

export async function createTransaction(
  transaction: TransactionInput,
  firestore: Firestore = database,
): Promise<{ id: string; created: boolean }> {
  const id = createTransactionId(transaction);
  const tags = await listTagDefinitions(firestore);
  const storedTransaction = buildStoredTransaction(
    transaction,
    applyAutomaticTags(transaction, tags),
  );

  try {
    await firestore
      .collection(TRANSACTIONS_COLLECTION)
      .doc(id)
      .create({ ...storedTransaction, createdAt: FieldValue.serverTimestamp() });
    return { id, created: true };
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    if (code === "6" || code === "already-exists") return { id, created: false };
    throw error;
  }
}

export async function listTransactions(
  firestore: Firestore = database,
): Promise<TransactionInput[]> {
  const snapshot = await firestore
    .collection(TRANSACTIONS_COLLECTION)
    .orderBy("occurredAt", "asc")
    .get();

  return snapshot.docs.flatMap((document) => {
    const parsed = transactionInputSchema.safeParse(document.data());
    if (parsed.success) return [parsed.data];

    logger.warn("Ignoring invalid transaction", { transactionId: document.id });
    return [];
  });
}

export async function upsertCategory(
  category: Category,
  firestore: Firestore = database,
): Promise<void> {
  const validatedCategory = categorySchema.parse(category);
  await firestore
    .collection(CATEGORIES_COLLECTION)
    .doc(validatedCategory.key)
    .set(validatedCategory, { merge: true });
}
