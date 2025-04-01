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
        if (allowedOrigins.includes(origin) || /^https?:\/\/(www\\.)?aigeneratememe\\.com$/.test(origin)) {
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
        prompt = `Roast me with ONLY ONE (1) brutally funny and short meme caption. DO NOT give multiple alternatives. Max 2 lines.`;
    } else if (mode === "manifest") {
        prompt = `Create ONLY ONE (1) motivational meme caption (max 2 lines) for someone who:\n- Dreams of: ${feeling}\n- Feels blocked by: ${problem}\n- Would feel: ${lastEnjoyed} if it came true.\n\nDO NOT give multiple alternatives. Return ONLY ONE meme text.`;
    } else if (mode === "classic") {
        prompt = `Today's mood: ${feeling}. Biggest problem: ${problem}. Last enjoyed: ${lastEnjoyed}. Create ONLY ONE short and funny meme caption (max 2 lines). DO NOT give multiple alternatives.`;
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