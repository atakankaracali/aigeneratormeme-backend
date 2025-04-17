import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const base64 = process.env.FIREBASE_ADMIN_KEY_BASE64;
const decoded = Buffer.from(base64, "base64").toString("utf-8");
const serviceAccount = JSON.parse(decoded);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const db = getFirestore();
