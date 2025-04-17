import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const base64 = process.env.FIREBASE_ADMIN_KEY_BASE64;
console.log("🧪 BASE64 EXISTS?", !!base64);
console.log("🧪 BASE64 LENGTH:", base64?.length || "undefined");

try {
  const decoded = Buffer.from(base64, "base64").toString("utf-8");
  const serviceAccount = JSON.parse(decoded);
  console.log("✅ Parsed service account OK");
} catch (err) {
  console.error("❌ JSON parse failed:", err.message);
}

export const db = getFirestore();
