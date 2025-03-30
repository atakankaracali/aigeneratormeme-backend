import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.post("/generate-meme-text", async (req, res) => {
  const { feeling, problem, lastEnjoyed, mode } = req.body;

  let prompt = "";

  if (mode === "roast") {
    prompt = `Roast me in a brutally funny and short meme caption. Max 2 lines.`;
  } else if (mode === "manifest") {
    prompt = `Create exactly ONE (1) motivational meme caption (max 2 lines) for someone who:
- Dreams of: ${feeling}
- Feels blocked by: ${problem}
- Would feel: ${lastEnjoyed} if it came true.

Do NOT give multiple alternatives. Return only ONE meme text. Make it short, modern, and in meme style.`;
  } else {
    prompt = `Today's mood: ${feeling}. Biggest problem: ${problem}. Last enjoyed: ${lastEnjoyed}. Create a short and funny meme caption (max 2 lines).`;
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-small-3.1-24b-instruct:free",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const memeText = response.data.choices?.[0]?.message?.content?.trim();

    if (!memeText) throw new Error("AI response missing or invalid");

    res.json({ memeText });
  } catch (error) {
    console.error("❌ Backend AI Error:", error.response?.data || error.message);
    res.status(500).json({ error: "AI failed to generate a meme." });
  }
});


app.get("/", (req, res) => {
  res.send("🚀 Backend Working! API is active.");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🔥 Backend running: http://localhost:${PORT}`));
