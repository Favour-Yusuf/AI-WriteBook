// Ledgerly, an AI business assistant: a small Node server that serves the UI in
// ./public, keeps each owner's business records (ledger.mjs), and streams
// Claude's replies over Server-Sent Events. The AI can read and add to the
// records through the tools in tools.mjs.
//
// Run:  ANTHROPIC_API_KEY=sk-ant-... npm start   (then open http://localhost:3000)
// Everyone must sign in before chatting; see auth.mjs and the README for the
// sign-up settings.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createAuth } from "./auth.mjs";
import { createLedger, LedgerError, today } from "./ledger.mjs";
import { ledgerTools, runLedgerTool } from "./tools.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";

const MAX_BODY_BYTES = 200_000;
const MAX_HISTORY_MESSAGES = 40;
const MAX_MODEL_CALLS = 12; // per reply: tool calls and web-search pauses each need another call
const MAX_BAD_JSON_RETRIES = 2;
const DATA_DIR = process.env.DATA_DIR || path.join(here, "data");

const client = new Anthropic();

const auth = createAuth({
  dataDir: DATA_DIR,
  signupMode: process.env.SIGNUP === "closed" ? "closed" : "open",
  signupCode: process.env.SIGNUP_CODE || "",
  secureCookies: process.env.COOKIE_SECURE || "auto",
});
const ledger = createLedger({ dataDir: DATA_DIR });

// Stable instructions come first so they can be cached across requests.
// Per-request details (today's date, the business profile) go in a second
// block after it.
const SYSTEM_PROMPT = `You are Ledgerly, a practical business assistant for owners of small businesses: shops, salons, restaurants, online sellers, freelancers, tutors, caterers, repair services, and similar. Many of them run the business alone or with a few staff, have little time, and no specialist to ask.

How you help:
- Give advice the owner can act on this week. Prefer concrete steps, numbers, scripts and ready-to-use text over general principles.
- When you write something for them to send or post (a social media caption, a reply to a customer, a payment reminder, a WhatsApp broadcast, an email), write the finished text, ready to copy, then add at most a line or two of notes.
- When money is involved (pricing, margins, cash flow, break-even, loans), show the arithmetic in a small table or short list so they can check it, and state any assumption you made.
- Use the business profile below when it is filled in: their industry, location, currency, customers and tone. Price things in their currency. If a missing detail would change your answer a lot, ask one short question; otherwise make a sensible assumption, say what it is, and carry on.
- Match the owner's language. If they write in Pidgin, Yoruba, Hausa, Igbo, French or any other language, reply in it.
- Be honest about limits. For legal, tax, and regulatory questions give useful general guidance, then say clearly when they should confirm with an accountant, lawyer, or the relevant government agency in their country. Never invent laws, rates, or statistics. When you need current facts (prices, regulations, trends, competitors), use web search and mention where the information came from.
- Keep answers tight. Use headings and bullet points only when they make the answer easier to scan. No filler, no pep talk.

The owner's records:
- Ledgerly keeps the owner's records: sales, expenses, products (price, cost, stock) and customers (including who owes money). You can read them with your tools. Whenever a question touches their own business (how much they made, profit, best sellers, slow months, who owes them, what they spend most on, stock, a particular customer), look it up with the tools before answering. Quote the exact figures the tools return and name the period they cover. Don't do your own arithmetic on totals the tools already give you.
- If the records are empty or don't cover what was asked, say so plainly, answer as well as you can from what the owner has told you, and suggest what to start recording.
- Go beyond reading numbers back: point out what stands out (a product with a thin margin, expenses growing faster than sales, a customer with a large unpaid balance, stock about to run out) and suggest the next step.
- When the owner tells you about a sale, expense, payment, new product or customer, record it with the tools, then confirm in one line what you saved. If a detail you need is missing (for example the amount), ask before saving. Don't record hypothetical examples, and never invent entries.
- Amounts in the records are in the owner's currency. Interpret "this month", "last week" and similar relative to today's date given below.`;

function contextBlock(profile) {
  const date = new Date();
  const header = `Today is ${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${today()}).`;
  const details = profileLines(profile);
  return details ? `${header}\n\n${details}` : header;
}

function profileLines(profile) {
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
  const user = await auth.currentUser(req);
  if (!user) return sendJson(res, 401, { error: "Please log in again." });

  const body = await readJsonBody(req, res);
  if (!body) return;

  const messages = cleanHistory(body.messages);
  if (!messages) return sendJson(res, 400, { error: "Send at least one message." });

  const system = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextBlock((await ledger.getBook(user.id)).profile) },
  ];

  const tools = [...ledgerTools];
  if (body.webSearch !== false) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });

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
    let sentText = false;
    let badJsonRetries = 0;

    for (let call = 0; call < MAX_MODEL_CALLS; call++) {
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

      // Separate text from different steps of the same reply with a blank line.
      let newStep = sentText;
      let message;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block.type === "server_tool_use") send({ type: "status", text: "Searching the web…" });
            else if (block.type === "tool_use") send({ type: "status", text: toolStatus(block.name) });
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            if (newStep) {
              send({ type: "text", text: "\n\n" });
              newStep = false;
            }
            send({ type: "text", text: event.delta.text });
            sentText = true;
          }
        }
        message = await stream.finalMessage();
        badJsonRetries = 0;
      } catch (err) {
        // Tool inputs are streamed unvalidated, so the SDK can fail to parse one.
        // Retry that step; let API errors and aborts through.
        if (err instanceof Anthropic.APIError || abort.signal.aborted || badJsonRetries++ >= MAX_BAD_JSON_RETRIES) throw err;
        console.warn("Unparseable tool input; retrying step:", err.message);
        continue;
      }

      if (message.stop_reason === "refusal") {
        send({ type: "error", text: "Ledgerly couldn't help with that request. Try rephrasing it." });
        break;
      }
      // A long web search can pause the turn; send the partial turn back to resume it.
      if (message.stop_reason === "pause_turn") {
        conversation.push({ role: "assistant", content: message.content });
        continue;
      }

      const toolCalls = message.content.filter((b) => b.type === "tool_use");
      if (message.stop_reason === "max_tokens") {
        // A tool input cut off here may look complete, so never run it.
        send({ type: "notice", text: "The answer was cut off because it got too long. Ask Ledgerly to continue." });
        break;
      }
      if (message.stop_reason !== "tool_use" || toolCalls.length === 0) break;

      conversation.push({ role: "assistant", content: message.content });
      const results = [];
      for (const toolCall of toolCalls) {
        const out = await runLedgerTool(ledger, user.id, toolCall.name, toolCall.input);
        if (out.action) send({ type: "action", text: out.action });
        results.push({ type: "tool_result", tool_use_id: toolCall.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
      }
      conversation.push({ role: "user", content: results });
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

function toolStatus(name) {
  if (["record_entry", "update_entry", "save_product", "save_customer"].includes(name)) return "Updating your records…";
  return "Checking your records…";
}

// ---- Records API (used by the Records page) ---------------------------------

async function handleProfile(req, res) {
  const user = await auth.currentUser(req);
  if (!user) return sendJson(res, 401, { error: "Please log in again." });
  if (req.method === "GET") return sendJson(res, 200, { profile: (await ledger.getBook(user.id)).profile });
  if (req.method !== "PUT") return sendJson(res, 405, { error: "Method not allowed" });
  const body = await readJsonBody(req, res);
  if (!body) return;
  try {
    sendJson(res, 200, { profile: await ledger.saveProfile(user.id, body) });
  } catch (err) {
    if (err instanceof LedgerError) return sendJson(res, 400, { error: err.message });
    throw err;
  }
}

const LEDGER_KINDS = { entries: "entries", products: "products", customers: "customers" };

async function handleLedger(req, res, url) {
  const user = await auth.currentUser(req);
  if (!user) return sendJson(res, 401, { error: "Please log in again." });

  const [, , , kind, id] = url.pathname.split("/"); // /api/ledger/<kind>/<id>
  try {
    if (req.method === "GET" && !kind) {
      const book = await ledger.getBook(user.id);
      const from = url.searchParams.get("from") || undefined;
      const to = url.searchParams.get("to") || undefined;
      return sendJson(res, 200, {
        today: today(),
        summary: ledger.summarize(book, { from, to }),
        entries: ledger.findEntries(book, { from, to, limit: 200 }).entries,
        products: book.products,
        customers: ledger.customerStats(book),
      });
    }
    if (!LEDGER_KINDS[kind]) return sendJson(res, 404, { error: "Not found" });

    if (req.method === "DELETE" && id) {
      await ledger.remove(user.id, kind, id);
      return sendJson(res, 200, { ok: true });
    }
    if ((req.method === "POST" && !id) || (req.method === "PATCH" && id)) {
      const body = await readJsonBody(req, res);
      if (!body) return;
      let item;
      if (kind === "entries") item = id ? await ledger.updateEntry(user.id, id, body) : await ledger.addEntry(user.id, body);
      else if (kind === "products") item = await ledger.saveProduct(user.id, body, id);
      else item = await ledger.saveCustomer(user.id, body, id);
      return sendJson(res, id ? 200 : 201, { item });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    if (err instanceof LedgerError) return sendJson(res, 400, { error: err.message });
    throw err;
  }
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The server's Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the server's internet connection.";
  if (err instanceof Anthropic.APIError && err.status >= 500) return "The AI service is having trouble. Try again in a minute.";
  return "Something went wrong while generating the answer.";
}

// Parses a JSON request body, or answers 400/415 itself and returns null.
// Requiring application/json also stops other sites from posting here with
// the user's cookie, because browsers won't send that type cross-site
// without a CORS preflight, which this server never approves.
async function readJsonBody(req, res) {
  if (!(req.headers["content-type"] || "").startsWith("application/json")) {
    sendJson(res, 415, { error: "Send JSON." });
    return null;
  }
  try {
    const body = JSON.parse(await readBody(req));
    if (body && typeof body === "object") return body;
  } catch {}
  sendJson(res, 400, { error: "Invalid request body." });
  return null;
}

async function handleAuth(req, res, action) {
  const body = action === "logout" ? {} : await readJsonBody(req, res);
  if (!body) return;
  const [status, data] = await auth[action](req, res, body);
  sendJson(res, status, data);
}

async function handleMe(req, res) {
  const user = await auth.currentUser(req);
  sendJson(res, user ? 200 : 401, { user: user ? auth.publicUser(user) : null, ...auth.config() });
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

const AUTH_ROUTES = { "/api/signup": "signup", "/api/login": "login", "/api/logout": "logout" };

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: "Something went wrong." });
    else res.end();
  }
});

async function route(req, res) {
  if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
  if (req.method === "POST" && AUTH_ROUTES[req.url]) return handleAuth(req, res, AUTH_ROUTES[req.url]);
  if (req.method === "GET" && req.url === "/api/me") return handleMe(req, res);
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/profile") return handleProfile(req, res);
  if (url.pathname === "/api/ledger" || url.pathname.startsWith("/api/ledger/")) return handleLedger(req, res, url);
  if (req.method === "GET" && req.url === "/api/health") return sendJson(res, 200, { ok: true, model: MODEL });
  if (req.method === "GET") return serveStatic(req, res);
  sendJson(res, 405, { error: "Method not allowed" });
}

server.listen(PORT, () => {
  console.log(`Ledgerly running at http://localhost:${PORT}`);
});
