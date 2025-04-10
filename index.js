import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { sanitizeInput, hasAdvancedInjection, isTooLong } from "./utils/secureInput.js";

dotenv.config();

const app = express();

if (!fs.existsSync("logs")) {
    fs.mkdirSync("logs");
}

app.use(helmet());
app.use(express.json());

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "Invalid JSON" });
    }
    next();
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || /^https?:\/\/(www\.)?aigeneratememe\.com$/.test(origin)) {
            return callback(null, true);
        }
        callback(new Error("CORS not allowed"));
    },
    optionsSuccessStatus: 200
}));

const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    keyGenerator: (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
    message: "❌ Too many requests from this IP, slow down."
});
app.use(limiter);

function logToFile(ip, data, ua = "") {
    const date = new Date().toISOString().split('T')[0];
    const logLine = `[${new Date().toISOString()}] [${ip}] [${ua}] ${JSON.stringify(data)}\n`;
    const logPath = path.join("logs", `${date}.txt`);
    fs.appendFileSync(logPath, logLine);
}

app.post("/generate-meme-text", async (req, res) => {
    const { feeling, problem, lastEnjoyed, mode } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "unknown";
    const ua = req.headers['user-agent'] || "unknown";

    const allowedModes = ["classic", "roast", "manifest"];
    if (!allowedModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode." });
    }

    if (mode !== "roast" && (!feeling || !problem || !lastEnjoyed)) {
        return res.status(400).json({ error: "Missing parameters for non-roast mode" });
    }

    if ([feeling, problem, lastEnjoyed].some(str => isTooLong(str))) {
        return res.status(400).json({ error: "Input too long" });
    }

    if ([feeling, problem, lastEnjoyed, mode].some(field => hasAdvancedInjection(field))) {
        logToFile(ip, { warning: "Injection attempt blocked", body: req.body }, ua);
        return res.status(400).json({ error: "Potential prompt injection detected" });
    }

    const safeFeeling = sanitizeInput(feeling);
    const safeProblem = sanitizeInput(problem);
    const safeLastEnjoyed = sanitizeInput(lastEnjoyed);

    let prompt = "";

    if (mode === "roast") {
        prompt = `You are a savage, clever, and successful stand-up comedian. Your job is to roast me with ONLY ONE (1) short meme caption (max 2 lines). The roast must be dark, ironic, savage, and FUNNY — but never offensive. Surprise the reader with unexpected humor and internet meme culture.
    
    ⚠️ Very Important Rules:
    - Only use standard Latin alphabet (A-Z, a-z) and common English punctuation.
    - Do NOT include emojis, special symbols, or any non-English characters (e.g., Chinese, Japanese, Cyrillic, etc.).
    - NO emojis, NO foreign languages, NO weird unicode — or your output gets deleted.
    
    Output Format: A clean, sharp, and punchy English sentence — meme-style, maximum 2 lines.`;
    } else if (mode === "manifest") {
        prompt = `You are a successful startup founder, known for viral, brutally honest motivational memes. Write ONLY ONE (1) meme-worthy caption (max 2 lines) for someone who:
    - Dreams of: ${safeFeeling}
    - Is blocked by: ${safeProblem}
    - Would feel: ${safeLastEnjoyed} if they succeed.
    
    Make the caption feel like real-life founder wisdom blended with internet humor. Add a touch of irony, inspiration, and practicality.
    
    ⚠️ Very Important Rules:
    - Text must be in English and use only standard Latin alphabet characters.
    - Do NOT use emojis, non-English scripts, symbols, or fancy characters.
    - This will be displayed on a professional meme platform — weird outputs will be rejected.
    
    Output Format: 1 clean English caption. Max 2 lines. No formatting.`;
    } else if (mode === "classic") {
        prompt = `You are a professional meme creator. Based on the user's situation, write ONLY ONE (1) funny and original meme caption (max 2 lines):
    - Mood: ${safeFeeling}
    - Problem: ${safeProblem}
    - Last thing enjoyed: ${safeLastEnjoyed}
    
    The caption must feel like something you'd see on Reddit or Twitter — relatable, ironic, clever, and surprising. Use real internet humor. Don't just copy the input — create a new, witty scenario based on it.
    
    ⚠️ STRICT RULES:
    - Use ONLY English with standard Latin characters (A-Z).
    - No foreign scripts, no emojis, no weird symbols, no formatting tricks.
    - Keep it clean, readable, and hilarious.
    
    Output: One single meme caption. Max 2 lines. Pure English only.`;
    }
    
    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "bytedance-research/ui-tars-72b:free",
                messages: [{ role: "user", content: prompt }],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const memeText = response.data.choices?.[0]?.message?.content?.trim();
        const firstValidLine = memeText
            ?.split('\n')
            .map(line => line.trim())
            .find(line => line.length > 0);

        if (!firstValidLine) throw new Error("AI response missing or invalid");

        res.json({ memeText: firstValidLine });

    } catch (error) {
        logToFile(ip, { error: error.response?.data || error.message }, ua);
        res.status(500).json({ error: "AI failed to generate a meme." });
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