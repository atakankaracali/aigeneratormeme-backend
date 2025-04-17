import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const base64 = process.env.FIREBASE_ADMIN_KEY_BASE64;
console.log("🧪 BASE64 EXISTS?", !!base64);
console.log("🧪 BASE64 LENGTH:", base64?.length);
console.log("🧪 DECODED PREVIEW:", decoded?.substring?.(0, 100));

try {
  const decoded = Buffer.from(base64, "base64").toString("utf-8");
  console.log("🧪 DECODED PREVIEW:", decoded.slice(0, 50));
  const serviceAccount = JSON.parse(decoded);
  console.log("✅ Parsed service account OK");

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
} catch (err) {
  console.error("❌ JSON parse failed:", err.message);
}


export const db = getFirestore();
