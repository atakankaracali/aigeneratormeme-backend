import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";

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

const forbiddenWords = process.env.FORBIDDEN_WORDS
    ? process.env.FORBIDDEN_WORDS.split(",").map(w => w.trim().toLowerCase())
    : [];

function hasInjection(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return forbiddenWords.some(word => lowerText.includes(word));
}

function isTooLong(text, max = 100) {
    return text.length > max;
}

function logToFile(ip, data) {
    const date = new Date().toISOString().split('T')[0];
    const logLine = `[${new Date().toISOString()}] [${ip}] ${JSON.stringify(data)}\n`;
    const logPath = path.join("logs", `${date}.txt`);
    fs.appendFileSync(logPath, logLine);
}

app.post("/generate-meme-text", async (req, res) => {
    const { feeling, problem, lastEnjoyed, mode } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "unknown";

    if (!mode) {
        return res.status(400).json({ error: "Missing mode parameter" });
    }

    if (mode !== "roast" && (!feeling || !problem || !lastEnjoyed)) {
        return res.status(400).json({ error: "Missing parameters for non-roast mode" });
    }

    if ([feeling, problem, lastEnjoyed].some(str => isTooLong(str))) {
        return res.status(400).json({ error: "Input too long" });
    }

    if ([feeling, problem, lastEnjoyed, mode].some(field => hasInjection(field))) {
        return res.status(400).json({ error: "Potential prompt injection detected" });
    }

    let prompt = "";

    if (mode === "roast") {
        prompt = `You are a savage and success stand-up comedian. Roast me HARD but FUNNY with ONLY ONE (1) short, brutally honest meme caption. It should be sarcastic, a little dark, but never offensive or disrespectful. Make sure it sounds like a viral roast meme on the internet. Create a meme that is really CLEAVER, FUNNY, and gives the reader a little surprise and a lot of fun. Max 2 lines. NO multiple versions, only ONE.`;
    } else if (mode === "manifest") {
        prompt = `You are a successful startup founder giving advice on Twitter as a meme. Create ONLY ONE (1) motivational, clever, and meme-worthy caption (max 2 lines) for someone who:\n- Dreams of: ${feeling}\n- Feels blocked by: ${problem}\n- Would feel: ${lastEnjoyed} if it came true.\n\nMake it sound like real advice from a self-made entrepreneur who understands struggles and dreams. Mix slight sarcasm with powerful motivation. The meme should be modern and feel like it belongs on Twitter's business meme space. Only ONE caption, no alternatives.`;
    } else if (mode === "classic") {
        prompt = `You are a professional funny meme creator. Analyze the following situation carefully and create ONLY ONE (1) extremely funny, extra clever, and internet-style meme caption (max 2 lines):\n\n- Mood: ${feeling}\n- Problem: ${problem}\n- Last thing they enjoyed: ${lastEnjoyed}\n\nThe meme should feel relatable, modern, and perfect for Instagram, Twitter, or Reddit. Use irony, sarcasm, and unexpected humor. Avoid clichés and make sure it would actually make people laugh a lot. DO NOT give multiple options.`;
    } else {
        return res.status(400).json({ error: "Invalid mode." });
    }

    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openchat/openchat-7b:free",
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
        logToFile(ip, { error: error.response?.data || error.message });
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