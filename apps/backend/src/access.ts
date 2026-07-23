import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { database } from "./firebase";
import type { AccessProfile } from "./models";
import { accessProfileSchema } from "./models";

export const ACCESS_PROFILES_COLLECTION = "accessProfiles";

export function assertActiveRole(
  profile: AccessProfile | undefined,
  requiredRole: AccessProfile["role"],
): asserts profile is AccessProfile {
  if (!profile?.active || profile.role !== requiredRole) {
    throw new HttpsError("permission-denied", "The authenticated user is not authorized.");
  }
}

export function assertSharedLedgerAccess(profile: AccessProfile | undefined): void {
  assertActiveRole(profile, "member");
  if (profile.transactionScope.mode !== "all") {
    throw new HttpsError(
      "permission-denied",
      "Restricted transaction access is not available yet.",
    );
  }
}

export async function loadAccessProfile(
  uid: string,
  firestore: Firestore = database,
): Promise<AccessProfile | undefined> {
  const snapshot = await firestore.collection(ACCESS_PROFILES_COLLECTION).doc(uid).get();
  if (!snapshot.exists) return undefined;

  const parsed = accessProfileSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : undefined;
}
