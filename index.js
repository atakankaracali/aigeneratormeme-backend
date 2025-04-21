import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { sanitizeInput, hasAdvancedInjection, isTooLong } from "./utils/secureInput.js";
import { db } from "./utils/firebaseAdmin.js";
import emojiRouter from "./emojiRoute.js";

dotenv.config();
const app = express();

if (!fs.existsSync("logs")) fs.mkdirSync("logs");

app.use(helmet());
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(www\.)?aigeneratememe\.com$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("CORS not allowed"));
    },
    optionsSuccessStatus: 200,
  })
);

const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  keyGenerator: (req) =>
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
  message: "❌ Too many requests from this IP, slow down.",
});
app.use(limiter);
app.use(emojiRouter);

function logToFile(ip, data, ua = "") {
  const date = new Date().toISOString().split("T")[0];
  const logLine = `[${new Date().toISOString()}] [${ip}] [${ua}] ${JSON.stringify(data)}\n`;
  const logPath = path.join("logs", `${date}.txt`);
  fs.appendFileSync(logPath, logLine);
}

app.post("/generate-meme-text", async (req, res) => {
  const { feeling, problem, lastEnjoyed, mode } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "unknown";

  const allowedModes = ["classic", "roast", "manifest", "surprise", "fortune"];
  if (!allowedModes.includes(mode)) {
    return res.status(400).json({ error: "Invalid mode." });
  }

  if (!["roast", "surprise", "fortune"].includes(mode) && (!feeling || !problem || !lastEnjoyed)) {
    return res.status(400).json({ error: "Missing parameters for this mode" });
  }

  if ([feeling, problem, lastEnjoyed].some((str) => isTooLong(str))) {
    return res.status(400).json({ error: "Input too long" });
  }

  if ([feeling, problem, lastEnjoyed, mode].some((field) => hasAdvancedInjection(field))) {
    logToFile(ip, { warning: "Injection attempt blocked", body: req.body }, ua);
    return res.status(400).json({ error: "Potential prompt injection detected" });
  }

  const safeFeeling = sanitizeInput(feeling);
  const safeProblem = sanitizeInput(problem);
  const safeLastEnjoyed = sanitizeInput(lastEnjoyed);

  let prompt = "";

  if (mode === "roast") {
    const flavors = [
      "short and brutal",
      "short and sharp",
      "a sarcastic genius voice",
      "dry and dark Reddit-style wit",
      "savage but clever",
      "savage but witty",
      "Gen Z internet humor",
      "internet Gen Z humor style",
      "roast style like a viral tweet",
      "ghost of Twitter 2012",
      "ironic and absurd",
      "weird and unhinged",
      "weird but brilliant like Tumblr in 2014",
      "unexpectedly deep and chaotic"
    ];
    const randomFlavor = flavors[Math.floor(Math.random() * flavors.length)];

    prompt = `You're a ruthless internet comedian with viral-level roast skills. Your job is to write ONE roast meme caption (max 2 lines) that:

    - Hits with clever sarcasm  
    - Feels like something from Reddit roast threads or Twitter dark humor  
    - Makes people laugh out loud, not just smile  
    - Uses real internet wit, not dad jokes  
    - No weak wordplay or puns  
    - Clever and creative  
    - Avoid generic tech jokes like “software updates” or “404 errors.”  
    - The person who reads it should be shocked and laugh a lot
    - Not do everytime this joke: "you're like a"

    Additional Style Instruction: Use the flavor "${randomFlavor}" in tone and delivery.
    
    Rules:  
    - No offensive, racist, sexist, or political content  
    - Use plain English only (A-Z), no emojis or symbols  
    - Be smart, bold, and funny  
    - Return just the one roast caption. No explanation, no intro.`;
  } else if (mode === "manifest") {
    prompt = `You're a startup founder known for creating meme-style motivational quotes that are equal parts hilarious and real. Write ONE caption (max 2 lines) for a hustler who:
- Dreams of: ${safeFeeling}
- Is blocked by: ${safeProblem}
- Would feel: ${safeLastEnjoyed} if they succeed

Style:
- Blend startup pain with hopeful sarcasm
- Use dry humor, internet wisdom, and surprise
- No toxic hustle, just relatable honesty
- Clever and creative.

Rules:
- English only (A-Z), no emojis or symbols
- Output just the meme caption. No extra content.`;
  } else if (mode === "classic") {
    prompt = `You're a master of meme culture. Based on the user's vibe, write ONE short and funny meme caption (max 2 lines) using:
- Mood: ${safeFeeling}
- Problem: ${safeProblem}
- Last thing enjoyed: ${safeLastEnjoyed}

Style:
- Make it relatable
- Add an unexpected twist
- Think Twitter, Tumblr, Reddit humor (clever, ironic, subtle chaos)
- Clever and creative.

Rules:
- English (A-Z only), no emojis or formatting
- No edgy/offensive content
- Just return one witty caption.`;
  } else if (mode === "surprise") {
    prompt = `You are a chaotic creative AI who writes wild and weird meme captions. 
  Your job is to generate ONE short and unexpected meme caption (max 2 lines) that:
  - Makes people say “what the heck did I just read” but still smile
  - Sounds like Gen Z humor or absurd Twitter humor
  - Is witty, ironic, or surreal
  - Doesn not follow meme templates, but surprises with randomness
  
  Rules:
  - No offensive, political, or inappropriate content
  - No emojis or symbols
  - English only (A-Z)
  - Output only the caption.`;

  } else if (mode === "fortune") {
    prompt = `You are a digital fortune cookie with meme energy.
  Write ONE short fortune-style sentence (1 line only) that:
  - Sounds like a daily wisdom, spiritual advice, or funny truth bomb
  - Has a mysterious, optimistic, or cryptic tone
  - Feels like a message from the universe or horoscope but not cheesy
  
  Examples:
  - “Sometimes, doing nothing is the bravest thing.”
  - “Today you might discover you have always been enough.”
  - “Don't trust the quiet ones. They know too much.”
  
  Rules:
  - No emojis or symbols
  - No explanation or fluff
  - English only (A-Z)
  - Output one single-line caption.`;
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        temperature: 1.3,
        top_p: 0.95,
        presence_penalty: 0.5,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.aigeneratememe.com",
          "X-Title": "AI Generate Meme",
        },
      }
    );

    const memeText = response.data.choices?.[0]?.message?.content?.trim();
    const firstValidLine = memeText
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!firstValidLine) throw new Error("AI response missing or invalid");

    const counterRef = db.collection("counters").doc("memes");
    await db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const current = doc.exists && doc.data()?.count ? doc.data().count : 0;
      t.set(counterRef, { count: current + 1 }, { merge: true });
    });

    res.json({ memeText: firstValidLine });
  } catch (error) {
    const detailedError = {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    };

    console.error("❌ OpenRouter Error:", JSON.stringify(detailedError, null, 2));
    res.status(500).json({ error: "AI failed to generate a meme." });
  }
});

app.get("/api/meme-count", async (req, res) => {
  try {
    const counterRef = db.collection("counters").doc("memes");
    const doc = await counterRef.get();
    const count = doc.exists ? doc.data().count : 0;
    res.json({ count });
  } catch (error) {
    console.error("Meme count read error:", error);
    res.status(500).json({ error: "Unable to get meme count." });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Backend Working! API is active.");
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🔥 Backend running: http://0.0.0.0:${PORT}`));