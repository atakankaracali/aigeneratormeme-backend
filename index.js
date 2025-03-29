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
    prompt = `Roast me. Make it brutally funny in 1-2 lines.`;
  } else if (mode === "hr") {
    prompt = `You're an AI comedian for corporate satire. Create a darkly funny meme based on this HR profile:\nMood: ${feeling}, Problem: ${problem}, Last Enjoyed: ${lastEnjoyed}.`;
  } else {
    prompt = `Today's mood: ${feeling}. Biggest problem: ${problem}. Last enjoyed: ${lastEnjoyed}. Give me a funny meme text.`;
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
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
          "Content-Type": "application/json"
        },
      }
    );    

    res.json({ memeText: response.data.choices[0].message.content });
  } catch (error) {
    console.error("❌ Backend AI Error:", error);
    res.status(500).json({ error: "AI failed to generate a response." });
  }
});


app.get("/", (req, res) => {
  res.send("🚀 Backend Working! API is active.");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🔥 Backend running: http://localhost:${PORT}`));
