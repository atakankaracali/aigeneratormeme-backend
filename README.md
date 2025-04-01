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

---

## Requirements

- Node.js >=18.x
- OpenRouter API Key
- `.env` file with:
  ```env
  OPENROUTER_API_KEY=your_key
  ALLOWED_ORIGINS=https://www.aigeneratememe.com
  RATE_LIMIT_WINDOW=15
  RATE_LIMIT_MAX=100
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

---

## Security Notes

- Automatically blocks requests containing suspicious inputs.
- Rate limits apply globally per IP.
- Logs suspicious and valid requests.
- Sanitizes user inputs before sending to AI.

> ✅ Injection attempts will be blocked.
> ✅ CORS will block unauthorized frontends.
> ✅ Logs are stored daily under `/logs`.

---