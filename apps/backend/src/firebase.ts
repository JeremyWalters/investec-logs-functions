import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.GCLOUD_PROJECT === "demo-investec-logs"
) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:28080";
}

const firebaseApp = getApps()[0] ?? initializeApp();

export const authentication = getAuth(firebaseApp);
export const database = getFirestore(firebaseApp);
