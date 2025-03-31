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

const forbiddenPatterns = JSON.parse(fs.readFileSync("./regex.json", "utf8")).map(p => new RegExp(p));

const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET || null;

function hasInjection(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    if (forbiddenWords.some(word => lowerText.includes(word))) return true;
    if (forbiddenPatterns.some(pattern => pattern.test(text))) return true;
    return false;
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

    const ua = req.headers['user-agent'] || "";
    if (!ua || ua.length < 10) {
        logToFile(ip, { alert: "Suspicious User-Agent detected", ua });
        return res.status(403).json({ error: "Suspicious client detected." });
    }

    if (SIGNATURE_SECRET) {
        if (req.headers['x-api-signature'] !== SIGNATURE_SECRET) {
            logToFile(ip, { alert: "Invalid Signature", ua });
            return res.status(403).json({ error: "Invalid signature." });
        }
    }

    logToFile(ip, { mode, feeling, problem, lastEnjoyed });

    if (!mode) {
        return res.status(400).json({ error: "Missing mode parameter" });
    }

    if (mode !== "roast" && (!feeling || !problem || !lastEnjoyed)) {
        return res.status(400).json({ error: "Missing parameters for non-roast mode" });
    }

    if ([feeling, problem, lastEnjoyed].some(str => isTooLong(str))) {
        logToFile(ip, { warning: "Input too long detected" });
        return res.status(400).json({ error: "Input too long" });
    }

    if ([feeling, problem, lastEnjoyed, mode].some(field => hasInjection(field))) {
        logToFile(ip, { alert: "Prompt injection attempt detected" });
        return res.status(400).json({ error: "Potential prompt injection detected" });
    }

    let prompt = "";

    if (mode === "roast") {
        prompt = `Roast me with ONLY ONE (1) brutally funny and short meme caption. DO NOT give multiple alternatives. Max 2 lines.`;
    } else if (mode === "manifest") {
        prompt = `Create ONLY ONE (1) motivational meme caption (max 2 lines) for someone who:
- Dreams of: ${feeling}
- Feels blocked by: ${problem}
- Would feel: ${lastEnjoyed} if it came true.

DO NOT give multiple alternatives. Return ONLY ONE meme text.`;
    } else if (mode === "classic") {
        prompt = `Today's mood: ${feeling}. Biggest problem: ${problem}. Last enjoyed: ${lastEnjoyed}. Create ONLY ONE short and funny meme caption (max 2 lines). DO NOT give multiple alternatives.`;
    } else {
        return res.status(400).json({ error: "Invalid mode." });
    }

    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "mistralai/mistral-small-3.1-24b-instruct:free",
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
