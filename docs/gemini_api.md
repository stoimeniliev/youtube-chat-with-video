# Gemini 2.0 Flash Lite API (Placeholder)

Endpoint used in extension:
`POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=API_KEY`

Example request body:
```json
{
  "contents": [
    { "role": "user", "parts": [{ "text": "Your prompt here" }] }
  ]
}
```

Response contains `choices[0].message.content` with model answer. 