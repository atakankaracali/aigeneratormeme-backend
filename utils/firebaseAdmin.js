import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const base64 = process.env.FIREBASE_ADMIN_KEY_BASE64;

console.log("🧪 BASE64 EXISTS?", !!base64);
console.log("🧪 BASE64 LENGTH:", base64?.length);

let decoded = "";
try {
  decoded = Buffer.from(base64, "base64").toString("utf-8");
  console.log("🧪 DECODED PREVIEW:", decoded.substring(0, 100));
} catch (e) {
  console.error("❌ DECODE FAILED:", e.message);
}

let serviceAccount = {};
try {
  serviceAccount = JSON.parse(decoded);
} catch (e) {
  console.error("❌ JSON parse failed:", e.message);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const db = getFirestore();