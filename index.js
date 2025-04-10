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
        prompt = `You are a savage, clever, and successful stand-up comedian. Roast me with ONLY ONE meme caption (max 2 lines). Be ironic, dark, and witty — but never offensive. Make it feel like something brutally hilarious on Reddit or Twitter.

Rules:
- Use ONLY plain English (A-Z).
- NO emojis, NO foreign words, NO symbols.
- Output must look clean and human-readable.
- Only return ONE caption. No intro, no explanation.`;
    } else if (mode === "manifest") {
        prompt = `You are a legendary startup founder, known for crafting viral motivational meme captions that blend real-life pain with inspiring hustle culture. Write ONE sharp and powerful caption (max 2 lines) for someone who:

- Dreams of: ${safeFeeling}
- Is blocked by: ${safeProblem}
- Would feel: ${safeLastEnjoyed} if they succeed.

Rules:
- Use ONLY English letters (A-Z).
- No emojis, foreign characters, or weird symbols.
- No explanation. Just one clear, clever caption.`;
    } else if (mode === "classic") {
        prompt = `You are a viral meme master. Based on the mood, problem, and last joy below, write ONE clever, internet-style meme caption (max 2 lines). It should be witty, relatable, and punchy — as if it came from Instagram, Twitter, or Reddit.

- Mood: ${safeFeeling}
- Problem: ${safeProblem}
- Last thing enjoyed: ${safeLastEnjoyed}

Rules:
- Use plain English only (A-Z), no other alphabets.
- NO emojis, symbols, or foreign words.
- Output only the caption. Keep it short, human, and memeable.`;
    }

    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "meta-llama/llama-4-scout:free",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://www.aigeneratememe.com",
                    "X-Title": "AI Generate Meme"
                }
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