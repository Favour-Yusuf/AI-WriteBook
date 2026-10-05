// Tools that let Ledgerly's AI read and update the owner's records.
//
// Requests are streamed with eager_input_streaming on, so the API does not
// validate tool inputs; every input is checked against its schema here
// before the tool runs, and the ledger validates field values again.

import { LedgerError, today } from "./ledger.mjs";

const DATE = { type: "string", description: "Date as YYYY-MM-DD." };

const TOOL_DEFS = [
  {
    name: "get_business_summary",
    description:
      "Totals for a date range from the owner's records: sales, money collected, expenses, profit and margin, average sale, expenses by category, sales by product, top customers, plus all-time money owed to and by the business and low-stock products. Use this first for any question about how the business is doing. Leave both dates out for all time.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { ...DATE, description: "First day to include, YYYY-MM-DD." },
        end_date: { ...DATE, description: "Last day to include, YYYY-MM-DD." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_entries",
    description:
      "Search individual sales and expense entries, newest first. Use for questions about specific transactions, a customer's history, unpaid invoices, or anything the summary doesn't break down.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["sale", "expense"] },
        start_date: DATE,
        end_date: DATE,
        status: { type: "string", enum: ["paid", "unpaid"], description: "unpaid sales are money customers owe; unpaid expenses are bills the business owes." },
        customer: { type: "string", description: "Part of a customer's name." },
        product: { type: "string", description: "Part of a product's name." },
        category: { type: "string", description: "Part of an expense category." },
        search: { type: "string", description: "Words to look for in description, customer, product or category." },
        limit: { type: "integer", description: "Maximum entries to return (default 50, max 200)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_products",
    description: "All products and services with selling price, unit cost, margin and stock left.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_customers",
    description: "All customers with phone, notes, total bought, amount they still owe, number of purchases and last purchase date.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "record_entry",
    description:
      "Add a sale or expense to the owner's records. Only use when the owner clearly tells you about a sale or expense that happened, or asks you to record one. If the amount is missing for a sale of a known product, give product and quantity and the product's price is used. Selling a product with a quantity reduces its stock.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["sale", "expense"] },
        amount: { type: "number", description: "Total amount in the owner's currency." },
        description: { type: "string" },
        date: { ...DATE, description: "When it happened, YYYY-MM-DD. Defaults to today." },
        category: { type: "string", description: "For expenses, e.g. Rent, Ingredients, Transport, Salaries, Marketing, Utilities." },
        customer: { type: "string", description: "Customer name for a sale. New names are added to the customer list." },
        product: { type: "string", description: "Product or service sold." },
        quantity: { type: "number" },
        status: { type: "string", enum: ["paid", "unpaid"], description: "unpaid if the customer will pay later, or the bill isn't settled yet. Defaults to paid." },
        due_date: { ...DATE, description: "When an unpaid amount is due." },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "update_entry",
    description: "Change an existing entry, for example mark a sale as paid. Get the entry id from find_entries first.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["paid", "unpaid"] },
        amount: { type: "number" },
        date: DATE,
        description: { type: "string" },
        category: { type: "string" },
        customer: { type: "string" },
        due_date: DATE,
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "save_product",
    description: "Add a product or service, or update one with the same name (price, cost, stock).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        price: { type: "number", description: "Selling price per unit." },
        cost: { type: "number", description: "What one unit costs the business to make or buy." },
        stock: { type: "number", description: "Units in stock now. Leave out for services." },
        unit: { type: "string", description: "e.g. pcs, kg, tray, hour." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "save_customer",
    description: "Add a customer, or update one with the same name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

export const ledgerTools = TOOL_DEFS.map((t) => ({ ...t, eager_input_streaming: true }));

const WRITE_TOOLS = new Set(["record_entry", "update_entry", "save_product", "save_customer"]);

// Runs one tool call. Returns { content, isError, action } where action is a
// short human-readable note for the chat when the call changed the records.
export async function runLedgerTool(ledger, userId, name, input) {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) return { content: `Unknown tool ${name}.`, isError: true };
  const problem = checkSchema(def.input_schema, input);
  if (problem) return { content: JSON.stringify({ INVALID_INPUT: problem, received: input }), isError: true };

  try {
    const book = await ledger.getBook(userId);
    let result;
    let action = null;
    switch (name) {
      case "get_business_summary":
        result = ledger.summarize(book, { from: input.start_date, to: input.end_date });
        break;
      case "find_entries":
        result = ledger.findEntries(book, {
          type: input.type,
          from: input.start_date,
          to: input.end_date,
          status: input.status,
          customer: input.customer,
          product: input.product,
          category: input.category,
          search: input.search,
          limit: input.limit,
        });
        break;
      case "list_products":
        result = book.products.map((p) => ({
          ...p,
          marginPerUnit: p.price && p.cost ? Math.round((p.price - p.cost) * 100) / 100 : null,
        }));
        break;
      case "list_customers":
        result = ledger.customerStats(book);
        break;
      case "record_entry": {
        const { due_date, ...rest } = input;
        result = await ledger.addEntry(userId, { ...rest, dueDate: due_date });
        action = `Recorded ${result.type}: ${result.description || result.product || result.category || "entry"}, ${result.amount}${result.status === "unpaid" ? " (unpaid)" : ""}`;
        break;
      }
      case "update_entry": {
        const { id, due_date, ...rest } = input;
        result = await ledger.updateEntry(userId, id, { ...rest, dueDate: due_date });
        action = `Updated ${result.type}: ${result.description || result.product || "entry"}${input.status ? `, now ${result.status}` : ""}`;
        break;
      }
      case "save_product":
        result = await ledger.saveProduct(userId, input);
        action = `Saved product: ${result.name}`;
        break;
      case "save_customer":
        result = await ledger.saveCustomer(userId, input);
        action = `Saved customer: ${result.name}`;
        break;
    }
    return { content: JSON.stringify({ today: today(), result }), isError: false, action: WRITE_TOOLS.has(name) ? action : null };
  } catch (err) {
    if (err instanceof LedgerError) return { content: err.message, isError: true };
    throw err;
  }
}

// Minimal JSON-schema check covering the shapes used above.
function checkSchema(schema, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Input must be an object.";
  for (const key of schema.required || []) {
    if (value[key] === undefined) return `Missing required field "${key}".`;
  }
  for (const [key, v] of Object.entries(value)) {
    const prop = schema.properties[key];
    if (!prop) return `Unknown field "${key}".`;
    if (v === null) continue;
    if (prop.type === "string" && typeof v !== "string") return `"${key}" must be a string.`;
    if (prop.type === "number" && (typeof v !== "number" || !Number.isFinite(v))) return `"${key}" must be a number.`;
    if (prop.type === "integer" && !Number.isInteger(v)) return `"${key}" must be a whole number.`;
    if (prop.enum && !prop.enum.includes(v)) return `"${key}" must be one of ${prop.enum.join(", ")}.`;
  }
  return null;
}
