// Each account's business records: sales, expenses, products and customers.
//
// Stored as one JSON file per user under DATA_DIR/books. All totals are
// computed here, in code, so the AI reports exact figures instead of doing
// arithmetic itself.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const LOW_STOCK_AT = 5;
const MAX_ITEMS = 20000;

export class LedgerError extends Error {}

export function createLedger({ dataDir }) {
  const dir = path.join(dataDir, "books");
  const cache = new Map(); // userId -> book
  const chains = new Map(); // userId -> pending write

  async function load(userId) {
    if (cache.has(userId)) return cache.get(userId);
    await fs.mkdir(dir, { recursive: true });
    let book;
    try {
      book = JSON.parse(await fs.readFile(fileFor(userId), "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      book = {};
    }
    book = { profile: {}, entries: [], products: [], customers: [], ...book };
    cache.set(userId, book);
    return book;
  }

  function fileFor(userId) {
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("Bad user id");
    return path.join(dir, `${userId}.json`);
  }

  function persist(userId) {
    const book = cache.get(userId);
    const next = (chains.get(userId) || Promise.resolve())
      .then(async () => {
        const file = fileFor(userId);
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(book), { mode: 0o600 });
        await fs.rename(tmp, file);
      })
      .catch((err) => console.error("Ledger save failed:", err));
    chains.set(userId, next);
    return next;
  }

  // ---- Customers & products -------------------------------------------------

  function findByName(list, name) {
    const key = norm(name);
    return key ? list.find((x) => norm(x.name) === key) || null : null;
  }

  function ensureCustomer(book, name) {
    if (!name) return null;
    let c = findByName(book.customers, name);
    if (!c) {
      c = { id: newId(), name: name.trim(), phone: "", notes: "", created: now() };
      book.customers.push(c);
    }
    return c;
  }

  async function saveCustomer(userId, input, id) {
    const book = await load(userId);
    const fields = pick(input, { name: str(80), phone: str(40), notes: str(500) });
    let c = id ? book.customers.find((x) => x.id === id) : findByName(book.customers, fields.name);
    if (id && !c) throw new LedgerError("Customer not found.");
    if (!c) {
      if (!fields.name) throw new LedgerError("A customer needs a name.");
      limit(book.customers);
      c = { id: newId(), name: "", phone: "", notes: "", created: now() };
      book.customers.push(c);
    } else if (fields.name && fields.name !== c.name && findByName(book.customers, fields.name)) {
      throw new LedgerError("Another customer already has that name.");
    }
    if (fields.name && c.name && fields.name !== c.name) renameRefs(book.entries, "customer", c.name, fields.name);
    Object.assign(c, fields);
    await persist(userId);
    return c;
  }

  async function saveProduct(userId, input, id) {
    const book = await load(userId);
    const fields = pick(input, { name: str(80), price: money, cost: money, stock: num, unit: str(20) });
    let p = id ? book.products.find((x) => x.id === id) : findByName(book.products, fields.name);
    if (id && !p) throw new LedgerError("Product not found.");
    if (!p) {
      if (!fields.name) throw new LedgerError("A product needs a name.");
      limit(book.products);
      p = { id: newId(), name: "", price: 0, cost: 0, stock: null, unit: "", created: now() };
      book.products.push(p);
    } else if (fields.name && fields.name !== p.name && findByName(book.products, fields.name)) {
      throw new LedgerError("Another product already has that name.");
    }
    if (fields.name && p.name && fields.name !== p.name) renameRefs(book.entries, "product", p.name, fields.name);
    Object.assign(p, fields);
    await persist(userId);
    return p;
  }

  async function remove(userId, kind, id) {
    const book = await load(userId);
    const list = book[kind];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) throw new LedgerError("Not found.");
    const [item] = list.splice(i, 1);
    // Taking a sale out puts its items back in stock.
    if (kind === "entries") adjustStock(book, item, +1);
    await persist(userId);
    return item;
  }

  // ---- Sales & expenses -----------------------------------------------------

  function adjustStock(book, entry, direction) {
    if (entry.type !== "sale" || !entry.product || !entry.quantity) return;
    const p = findByName(book.products, entry.product);
    if (p && typeof p.stock === "number") p.stock = round(p.stock + direction * entry.quantity);
  }

  async function addEntry(userId, input) {
    const book = await load(userId);
    const e = validateEntry(input, false);
    limit(book.entries);
    // Sales of a known product with no amount use the product's price.
    const product = e.product ? findByName(book.products, e.product) : null;
    if (product) e.product = product.name;
    if (e.amount == null && product && e.quantity) e.amount = round(product.price * e.quantity);
    if (e.amount == null) throw new LedgerError("Give an amount.");
    if (e.customer) e.customer = ensureCustomer(book, e.customer).name;
    const entry = {
      id: newId(),
      date: e.date || today(),
      type: e.type,
      amount: e.amount,
      description: e.description || (product ? product.name : ""),
      category: e.category || "",
      customer: e.customer || "",
      product: e.product || "",
      quantity: e.quantity ?? null,
      status: e.status || "paid",
      dueDate: e.dueDate || "",
      created: now(),
    };
    book.entries.push(entry);
    adjustStock(book, entry, -1);
    await persist(userId);
    return entry;
  }

  async function updateEntry(userId, id, input) {
    const book = await load(userId);
    const entry = book.entries.find((x) => x.id === id);
    if (!entry) throw new LedgerError("Entry not found.");
    const patch = validateEntry(input, true);
    adjustStock(book, entry, +1);
    if (patch.customer) patch.customer = ensureCustomer(book, patch.customer).name;
    Object.assign(entry, patch);
    adjustStock(book, entry, -1);
    await persist(userId);
    return entry;
  }

  function validateEntry(input, partial) {
    const e = pick(input, {
      type: oneOf(["sale", "expense"]),
      amount: money,
      date: dateStr,
      description: str(200),
      category: str(60),
      customer: str(80),
      product: str(80),
      quantity: num,
      status: oneOf(["paid", "unpaid"]),
      dueDate: dateStr,
    });
    if (!partial && !e.type) throw new LedgerError("Say whether this is a sale or an expense.");
    if (e.quantity != null && e.quantity <= 0) throw new LedgerError("Quantity must be more than zero.");
    return e;
  }

  // ---- Business profile -----------------------------------------------------

  const PROFILE_FIELDS = ["name", "offer", "industry", "location", "currency", "customers", "team", "tone", "goal"];

  async function saveProfile(userId, input) {
    const book = await load(userId);
    if (!input || typeof input !== "object") throw new LedgerError("Missing details.");
    const profile = {};
    for (const key of PROFILE_FIELDS) {
      const v = input[key];
      if (typeof v === "string" && v.trim()) profile[key] = v.trim().slice(0, 500);
    }
    book.profile = profile;
    await persist(userId);
    return profile;
  }

  // ---- Reports --------------------------------------------------------------

  async function getBook(userId) {
    return load(userId);
  }

  function summarize(book, { from, to } = {}) {
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);
    const entries = book.entries.filter((e) => inRange(e.date));
    const sales = entries.filter((e) => e.type === "sale");
    const expenses = entries.filter((e) => e.type === "expense");
    const sum = (list) => round(list.reduce((t, e) => t + e.amount, 0));

    const byKey = (list, key) => {
      const map = new Map();
      for (const e of list) {
        const k = e[key] || "(none)";
        const row = map.get(k) || { name: k, amount: 0, count: 0, quantity: 0 };
        row.amount = round(row.amount + e.amount);
        row.count++;
        row.quantity = round(row.quantity + (e.quantity || 0));
        map.set(k, row);
      }
      return [...map.values()].sort((a, b) => b.amount - a.amount);
    };

    const totalSales = sum(sales);
    const totalExpenses = sum(expenses);
    return {
      period: { from: from || "beginning", to: to || "today" },
      sales: totalSales,
      salesCount: sales.length,
      collected: sum(sales.filter((e) => e.status === "paid")),
      expenses: totalExpenses,
      profit: round(totalSales - totalExpenses),
      profitMargin: totalSales ? round(((totalSales - totalExpenses) / totalSales) * 100) : null,
      averageSale: sales.length ? round(totalSales / sales.length) : null,
      expensesByCategory: byKey(expenses, "category").slice(0, 10),
      salesByProduct: byKey(sales, "product").slice(0, 10),
      topCustomers: byKey(sales.filter((e) => e.customer), "customer").slice(0, 10),
      // Debts are reported across all dates, since an old debt is still owed.
      owedToYou: sum(book.entries.filter((e) => e.type === "sale" && e.status === "unpaid")),
      youOwe: sum(book.entries.filter((e) => e.type === "expense" && e.status === "unpaid")),
      lowStock: book.products
        .filter((p) => typeof p.stock === "number" && p.stock <= LOW_STOCK_AT)
        .map((p) => ({ name: p.name, stock: p.stock })),
      recordCounts: { entries: book.entries.length, products: book.products.length, customers: book.customers.length },
    };
  }

  function customerStats(book) {
    return book.customers.map((c) => {
      const mine = book.entries.filter((e) => e.type === "sale" && norm(e.customer) === norm(c.name));
      const last = mine.reduce((d, e) => (e.date > d ? e.date : d), "");
      return {
        ...c,
        totalBought: round(mine.reduce((t, e) => t + e.amount, 0)),
        owes: round(mine.filter((e) => e.status === "unpaid").reduce((t, e) => t + e.amount, 0)),
        purchases: mine.length,
        lastPurchase: last || null,
      };
    });
  }

  function findEntries(book, f = {}) {
    const text = norm(f.search);
    let list = book.entries.filter(
      (e) =>
        (!f.type || e.type === f.type) &&
        (!f.from || e.date >= f.from) &&
        (!f.to || e.date <= f.to) &&
        (!f.status || e.status === f.status) &&
        (!f.customer || norm(e.customer).includes(norm(f.customer))) &&
        (!f.product || norm(e.product).includes(norm(f.product))) &&
        (!f.category || norm(e.category).includes(norm(f.category))) &&
        (!text || norm(`${e.description} ${e.customer} ${e.product} ${e.category}`).includes(text)),
    );
    list = list.sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
    return { total: list.length, entries: list.slice(0, Math.min(Math.max(f.limit || 50, 1), 200)) };
  }

  return {
    getBook,
    saveProfile,
    summarize,
    customerStats,
    findEntries,
    addEntry,
    updateEntry,
    saveProduct,
    saveCustomer,
    remove,
  };
}

// ---- Field validation helpers ----------------------------------------------

function pick(input, spec) {
  if (!input || typeof input !== "object") throw new LedgerError("Missing details.");
  const out = {};
  for (const [key, check] of Object.entries(spec)) {
    const v = input[key];
    if (v === undefined || v === null || v === "") continue;
    out[key] = check(v, key);
  }
  return out;
}

const str = (max) => (v, key) => {
  if (typeof v !== "string") throw new LedgerError(`${key} must be text.`);
  return v.trim().slice(0, max);
};
const num = (v, key) => {
  const n = typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new LedgerError(`${key} must be a number.`);
  return round(n);
};
const money = (v, key) => {
  const n = num(v, key);
  if (n < 0) throw new LedgerError(`${key} can't be negative.`);
  return n;
};
const oneOf = (options) => (v, key) => {
  if (!options.includes(v)) throw new LedgerError(`${key} must be one of: ${options.join(", ")}.`);
  return v;
};
const dateStr = (v, key) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new LedgerError(`${key} must be a date like 2026-10-05.`);
  }
  return v;
};

function renameRefs(entries, field, from, to) {
  for (const e of entries) if (norm(e[field]) === norm(from)) e[field] = to;
}
function limit(list) {
  if (list.length >= MAX_ITEMS) throw new LedgerError("This account has reached its record limit.");
}
const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const round = (n) => Math.round(n * 100) / 100;
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
// Local date on the server (set the TZ environment variable to change it).
export const today = () => new Date().toLocaleDateString("en-CA");
