import express from "express";
import { db } from "./utils/firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

router.post("/api/react", async (req, res) => {
  const { text, emoji } = req.body;

  if (!text || !emoji) {
    return res.status(400).json({ error: "Missing text or emoji." });
  }

  try {
    const collection = db.collection("emojiReactions");

    await collection.add({
      text,
      emoji,
      timestamp: FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("🔥 Firebase reaction save error:", err.message);
    res.status(500).json({ error: "Failed to save emoji reaction." });
  }
});

export default router;
