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
- **Accounts**: email and password sign-up and login. Chatting requires being logged in, and each account keeps its own conversations and profile.
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
| `SIGNUP` | `open` | Set to `closed` to stop new accounts being created. |
| `SIGNUP_CODE` | (none) | If set, people need this code to create an account. Share it only with people you invite. |
| `DATA_DIR` | `./data` | Where accounts and sessions are stored. |
| `COOKIE_SECURE` | `auto` | `auto` marks the login cookie Secure when the request came over HTTPS; `true` forces it on. |

## Accounts and login

The first screen is a login page with a link to create an account. A common setup:

1. Start the server with `SIGNUP_CODE=pick-a-code` and give the code only to the business owners you want to let in.
2. Once everyone is signed up, restart with `SIGNUP=closed` if you want no more accounts created.

How it's secured:

- Passwords are hashed with scrypt and a per-user salt. The plain password is never stored.
- Login sets a random session token in an `HttpOnly`, `SameSite=Lax` cookie that lasts 30 days. The server stores only a hash of the token, and logging out deletes it.
- After 10 failed logins for one email from one address, further attempts are blocked for 15 minutes.
- API requests must be JSON, so other websites can't send requests with a signed-in user's cookie.
- Accounts are saved in `data/users.json` and sessions in `data/sessions.json` (git-ignored). Back up the `data` folder and run a single server process, because two processes would overwrite each other's files.

There is no "forgot password" email yet. To reset someone's password, delete their entry from `data/users.json` while the server is stopped and have them sign up again.

## How it works

- `auth.mjs`: accounts, password hashing, sessions and login rate limiting.
- `server.mjs`: a dependency-light Node server. It serves `public/`, handles `/api/signup`, `/api/login`, `/api/logout` and `/api/me`, and `POST /api/chat` (signed-in users only) calls the Claude Messages API with the system prompt, the owner's profile and the conversation, then streams the reply back as Server-Sent Events. Refused requests fall back to another model automatically (`fallbacks: "default"`), and long web searches that pause are resumed.
- `public/index.html`: the whole UI in one file, including the login screen. Conversations and the profile are kept in the browser's `localStorage`, separately for each account.

The assistant's behaviour lives in `SYSTEM_PROMPT` at the top of `server.mjs`. Edit it to change tone, focus or rules.

## Deploying

Any host that runs Node works (Render, Railway, Fly.io, a VPS). Set `ANTHROPIC_API_KEY` (and `SIGNUP_CODE` or `SIGNUP=closed`) in the host's environment settings, serve it over HTTPS, and point `DATA_DIR` at a persistent disk so accounts survive redeploys. With sign-up left fully open, anyone who finds the URL can create an account and use your API credit; there is no per-user usage limit yet.
