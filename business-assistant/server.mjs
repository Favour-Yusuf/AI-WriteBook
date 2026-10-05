// AI Business Assistant: a small Node server that serves the chat UI in
// ./public and streams Claude's replies to it over Server-Sent Events.
//
// Run:  ANTHROPIC_API_KEY=sk-ant-... npm start   (then open http://localhost:3000)

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";

const MAX_BODY_BYTES = 200_000;
const MAX_HISTORY_MESSAGES = 40;
const MAX_PAUSE_CONTINUATIONS = 3;

const client = new Anthropic();

// Stable instructions come first so they can be cached across requests.
// Per-owner details (the business profile) go in a second block after it.
const SYSTEM_PROMPT = `You are a practical business assistant for owners of small businesses: shops, salons, restaurants, online sellers, freelancers, tutors, caterers, repair services, and similar. Many of them run the business alone or with a few staff, have little time, and no specialist to ask.

How you help:
- Give advice the owner can act on this week. Prefer concrete steps, numbers, scripts and ready-to-use text over general principles.
- When you write something for them to send or post (a social media caption, a reply to a customer, a payment reminder, a WhatsApp broadcast, an email), write the finished text, ready to copy, then add at most a line or two of notes.
- When money is involved (pricing, margins, cash flow, break-even, loans), show the arithmetic in a small table or short list so they can check it, and state any assumption you made.
- Use the business profile below when it is filled in: their industry, location, currency, customers and tone. Price things in their currency. If a missing detail would change your answer a lot, ask one short question; otherwise make a sensible assumption, say what it is, and carry on.
- Match the owner's language. If they write in Pidgin, Yoruba, Hausa, Igbo, French or any other language, reply in it.
- Be honest about limits. For legal, tax, and regulatory questions give useful general guidance, then say clearly when they should confirm with an accountant, lawyer, or the relevant government agency in their country. Never invent laws, rates, or statistics. When you need current facts (prices, regulations, trends, competitors), use web search and mention where the information came from.
- Keep answers tight. Use headings and bullet points only when they make the answer easier to scan. No filler, no pep talk.`;

function profileBlock(profile) {
  if (!profile || typeof profile !== "object") return null;
  const fields = [
    ["Business name", profile.name],
    ["What they sell / do", profile.offer],
    ["Industry", profile.industry],
    ["Location", profile.location],
    ["Currency", profile.currency],
    ["Customers", profile.customers],
    ["Team size", profile.team],
    ["Brand tone", profile.tone],
    ["Current goal or challenge", profile.goal],
  ]
    .map(([label, value]) => [label, typeof value === "string" ? value.trim().slice(0, 500) : ""])
    .filter(([, value]) => value);
  if (fields.length === 0) return null;
  return `Business profile (provided by the owner):\n${fields.map(([l, v]) => `- ${l}: ${v}`).join("\n")}`;
}

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return null;
  const cleaned = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));
  // The API needs the conversation to start with a user turn and end with one.
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") return null;
  return cleaned;
}

async function handleChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  const messages = cleanHistory(body.messages);
  if (!messages) return sendJson(res, 400, { error: "Send at least one message." });

  const system = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
  const profile = profileBlock(body.profile);
  if (profile) system.push({ type: "text", text: profile });

  const tools = body.webSearch === false ? [] : [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }];

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const conversation = [...messages];
    for (let turn = 0; turn <= MAX_PAUSE_CONTINUATIONS; turn++) {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 32000,
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system,
          tools,
          messages: conversation,
        },
        { signal: abort.signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          send({ type: "status", text: "Searching the web…" });
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ type: "text", text: event.delta.text });
        }
      }

      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        send({ type: "error", text: "The assistant couldn't help with that request. Try rephrasing it." });
        break;
      }
      if (message.stop_reason === "max_tokens") {
        send({ type: "notice", text: "The answer was cut off because it got too long. Ask it to continue." });
      }
      // A long web search can pause the turn; send the partial turn back to resume it.
      if (message.stop_reason !== "pause_turn") break;
      conversation.push({ role: "assistant", content: message.content });
    }
    send({ type: "done" });
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error(err);
      send({ type: "error", text: friendlyError(err) });
    }
  } finally {
    res.end();
  }
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The server's Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the server's internet connection.";
  if (err instanceof Anthropic.APIError && err.status >= 500) return "The AI service is having trouble. Try again in a minute.";
  return "Something went wrong while generating the answer.";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Browser libraries are served from node_modules so the app needs no CDN.
const VENDOR = {
  "/vendor/marked.js": path.join(here, "node_modules/marked/lib/marked.umd.js"),
  "/vendor/purify.js": path.join(here, "node_modules/dompurify/dist/purify.min.js"),
};

async function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return sendJson(res, 400, { error: "Bad path" });
  }
  if (VENDOR[urlPath]) {
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    return res.end(await fs.readFile(VENDOR[urlPath]));
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: "Forbidden" });
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
  if (req.method === "GET" && req.url === "/api/health") return sendJson(res, 200, { ok: true, model: MODEL });
  if (req.method === "GET") return serveStatic(req, res);
  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`AI Business Assistant running at http://localhost:${PORT}`);
});
