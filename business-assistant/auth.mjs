// Accounts and sessions for the Business Assistant.
//
// Users and sessions live in JSON files under DATA_DIR. Passwords are hashed
// with scrypt; the browser holds only a random session token in an HttpOnly
// cookie, and the server stores just a SHA-256 hash of that token.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const COOKIE_NAME = "ba_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const MIN_PASSWORD_LENGTH = 8;

export function createAuth({ dataDir, signupMode = "open", signupCode = "", secureCookies = "auto" }) {
  const usersFile = path.join(dataDir, "users.json");
  const sessionsFile = path.join(dataDir, "sessions.json");

  let users = null; // { [id]: { id, email, name, salt, hash, created } }
  let sessions = null; // { [tokenHash]: { userId, expires } }
  const failedLogins = new Map(); // key -> { count, first }

  async function load() {
    if (users) return;
    await fs.mkdir(dataDir, { recursive: true });
    users = await readJson(usersFile, {});
    sessions = await readJson(sessionsFile, {});
    const now = Date.now();
    for (const [k, s] of Object.entries(sessions)) if (s.expires < now) delete sessions[k];
  }

  // Writes are chained so two requests never write the same file at once.
  let writeChain = Promise.resolve();
  function persist(file, data) {
    writeChain = writeChain.then(() => writeJsonAtomic(file, data)).catch((err) => console.error("Save failed:", err));
    return writeChain;
  }

  const findByEmail = (email) => Object.values(users).find((u) => u.email === email) || null;
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

  async function hashPassword(password, salt) {
    return (await scrypt(password, salt, 64)).toString("hex");
  }

  async function startSession(res, req, userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    sessions[sha256(token)] = { userId, expires: Date.now() + SESSION_TTL_MS };
    await persist(sessionsFile, sessions);
    setCookie(res, req, token, SESSION_TTL_MS / 1000);
  }

  function setCookie(res, req, value, maxAgeSeconds) {
    const secure =
      secureCookies === "true" ||
      (secureCookies === "auto" && (req.socket.encrypted || req.headers["x-forwarded-proto"] === "https"));
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`,
    );
  }

  function tokenFrom(req) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === COOKIE_NAME) return v.join("=");
    }
    return null;
  }

  // Returns the signed-in user for this request, or null.
  async function currentUser(req) {
    await load();
    const token = tokenFrom(req);
    if (!token) return null;
    const key = sha256(token);
    const session = sessions[key];
    if (!session) return null;
    if (session.expires < Date.now()) {
      delete sessions[key];
      persist(sessionsFile, sessions);
      return null;
    }
    return users[session.userId] || null;
  }

  function tooManyAttempts(key) {
    const entry = failedLogins.get(key);
    if (!entry) return false;
    if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
      failedLogins.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILED_LOGINS;
  }
  function recordFailure(key) {
    const entry = failedLogins.get(key);
    if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) failedLogins.set(key, { count: 1, first: Date.now() });
    else entry.count++;
  }

  async function signup(req, res, body) {
    await load();
    if (signupMode === "closed") return [403, { error: "New sign-ups are turned off. Ask the owner for an account." }];

    const email = normEmail(body.email);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (signupCode && !safeEqual(String(body.code || "").trim(), signupCode)) {
      return [403, { error: "That sign-up code isn't right." }];
    }
    if (!email) return [400, { error: "Enter a valid email address." }];
    if (password.length < MIN_PASSWORD_LENGTH) {
      return [400, { error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` }];
    }
    if (password.length > 200) return [400, { error: "That password is too long." }];
    if (findByEmail(email)) return [409, { error: "An account with this email already exists. Log in instead." }];

    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      salt,
      hash: await hashPassword(password, salt),
      created: new Date().toISOString(),
    };
    users[user.id] = user;
    await persist(usersFile, users);
    await startSession(res, req, user.id);
    return [201, { user: publicUser(user) }];
  }

  async function login(req, res, body) {
    await load();
    const email = normEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const key = `${req.socket.remoteAddress}|${email}`;

    if (tooManyAttempts(key)) {
      return [429, { error: "Too many failed attempts. Wait 15 minutes and try again." }];
    }
    const user = email && findByEmail(email);
    // Hash even when the user doesn't exist so timing doesn't reveal which emails are registered.
    const hash = await hashPassword(password.slice(0, 200), user ? user.salt : "0".repeat(32));
    if (!user || !safeEqual(hash, user.hash)) {
      recordFailure(key);
      return [401, { error: "Wrong email or password." }];
    }
    failedLogins.delete(key);
    await startSession(res, req, user.id);
    return [200, { user: publicUser(user) }];
  }

  async function logout(req, res) {
    await load();
    const token = tokenFrom(req);
    if (token && sessions[sha256(token)]) {
      delete sessions[sha256(token)];
      await persist(sessionsFile, sessions);
    }
    setCookie(res, req, "", 0);
    return [200, { ok: true }];
  }

  return {
    currentUser,
    publicUser,
    signup,
    login,
    logout,
    config: () => ({ signup: signupMode !== "closed", signupCode: Boolean(signupCode) }),
  };
}

function normEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}
