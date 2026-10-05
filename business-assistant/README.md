# Business Assistant

An AI assistant for small business owners, powered by Claude. It writes social
media posts and customer replies, works out prices and margins, chases late
payments, reviews cash flow, and drafts growth plans, all tailored to the
owner's business profile.

## Features

- **Chat** with streamed answers, rendered as formatted text and tables, with a copy button on every reply.
- **Quick tasks**: one-click starters for social posts, customer replies, pricing, payment reminders, cash flow checks, customer growth plans, business plans and promo broadcasts.
- **Business profile**: name, offer, location, currency, customers, tone and current goal. Sent with every request so answers fit the business (and use the right currency).
- **Web search** (toggle): lets the assistant look up current prices, regulations and trends.
- **Saved conversations** in the browser, light and dark themes, works on phones.

## Run it

Needs Node 18+ and an Anthropic API key.

```bash
cd business-assistant
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open http://localhost:3000.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key. Stays on the server; the browser never sees it. |
| `PORT` | `3000` | Port to listen on. |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude model to use. |

## How it works

- `server.mjs`: a dependency-light Node server. It serves `public/`, and `POST /api/chat` calls the Claude Messages API with the system prompt, the owner's profile and the conversation, then streams the reply back as Server-Sent Events. Refused requests fall back to another model automatically (`fallbacks: "default"`), and long web searches that pause are resumed.
- `public/index.html`: the whole UI in one file. Conversations and the profile are kept in the browser's `localStorage`.

The assistant's behaviour lives in `SYSTEM_PROMPT` at the top of `server.mjs`. Edit it to change tone, focus or rules.

## Deploying

Any host that runs Node works (Render, Railway, Fly.io, a VPS). Set `ANTHROPIC_API_KEY` in the host's environment settings. The server has no login or rate limiting, so add those before sharing the URL publicly, or anyone with the link can spend your API credit.
