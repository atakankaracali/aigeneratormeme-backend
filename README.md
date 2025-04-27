# Backend - AI Meme Generator

This is the backend service powering the **AI Meme Generator**. It serves meme generation requests securely using OpenRouter AI models.

---

## Features

- Express.js REST API
- Strict rate limiting
- Input length control
- Forbidden word and pattern filtering (anti-prompt-injection)
- Prompt sanitization & normalization
- Secure AI prompt generation
- Logging (IP, UA, request info)
- CORS restriction
- Firebase Firestore integration for Emoji Reactions and Stats

---

## Requirements

- Node.js >=18.x
- OpenRouter API Key
- Firebase Project (Free Spark Plan)
- `.env` file with:
  ```env
  OPENROUTER_API_KEY=your_key
  ALLOWED_ORIGINS=https://www.aigeneratememe.com
  RATE_LIMIT_WINDOW=15
  RATE_LIMIT_MAX=100
  FIREBASE_ADMIN_KEY_BASE64=your_base64_encoded_firebase_key
  FIREBASE_PROJECT_ID=your_firebase_project_id
  ```

---

## Installation

```bash
npm install
```

## Running Locally

```bash
npm run dev
```

## Running in Production

```bash
npm run start
```

---

## API Endpoints

### `POST /generate-meme-text`

Generates a meme caption based on user input.

**Parameters:**

| Name          | Type   | Required | Description                         |
|---------------|--------|----------|-------------------------------------|
| mode          | string | yes      | "classic", "roast", or "manifest"   |
| feeling       | string | depends  | User's feeling (non-roast modes)    |
| problem       | string | depends  | User's problem (non-roast modes)    |
| lastEnjoyed   | string | depends  | Last thing user enjoyed (non-roast) |

Returns a JSON response:

```json
{
    "memeText": "Your generated meme caption."
}
```

### `GET /api/meme-count`
Returns the total number of generated memes.

```json
{
    "count": 1234
}
```

### `GET api/emoji-leaderboard`
Returns the total emoji reaction stats.

```json
  {
    "totals": {
      "😂": 10,
      "🔥": 7,
      "😢": 2
    }
  }
```

### `GET api/mode-stats`
Returns meme generation counts per mode.

```json
  {
    "modes": {
      "classic": 300,
      "roast": 250,
      "surprise": 150
    }
  }
```
---

## Security Notes

- Automatically blocks requests containing suspicious inputs.
- Rate limits apply globally per IP.
- Logs suspicious and valid requests.
- Sanitizes user inputs before sending to AI.
- CORS allows only the frontend URL
- Inputs are normalized and sanitized before sending to OpenRouter


> ✅ Injection attempts will be blocked.
> ✅ Unauthorized frontends are blocked via CORS.
> ✅ Detailed logs are saved. `/logs`.
---