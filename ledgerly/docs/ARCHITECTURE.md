# Ledgerly architecture

Ledgerly helps small business owners run their business in one place:
customers, products, orders, follow-ups, analytics and an AI assistant that
knows the business.

This document explains how the pieces fit together. It is written so a
beginner can follow it; each section starts with the plain-language idea and
then gives the technical detail.

---

## 1. The big picture

```
 Browser (phone or laptop)
     │  pages, forms, buttons
     ▼
 Next.js app  (one project: website + backend)
     │  ├─ Pages & components      → what the owner sees
     │  ├─ Server Actions          → save/change data (forms)
     │  ├─ Route Handlers (/api)   → AI chat streaming
     │  └─ proxy.ts                → keeps the login session fresh
     ▼
 Supabase
     ├─ Auth        → sign up, sign in, sessions, password reset
     └─ PostgreSQL  → all business data, protected by Row Level Security
     
 OpenAI API  ← called only from the server, never from the browser
```

**In plain words:** the owner uses the Ledgerly website. The website is
built with Next.js, which also runs the "backend" code on the server.
Data lives in a PostgreSQL database hosted by Supabase, and Supabase also
handles logins. When the owner asks the AI assistant something, our server
talks to OpenAI on their behalf, so the secret API key never reaches the
browser.

## 2. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19** | Frontend and backend in one codebase; server components keep pages fast. |
| Language | **TypeScript** | Catches mistakes before the app runs. |
| Styling | **Tailwind CSS v4** | Consistent spacing, colours and responsive layouts. |
| Components | **shadcn/ui** (Radix UI primitives) | Accessible, good-looking building blocks we own and can restyle. Files live in `src/components/ui`. |
| Icons | **lucide-react** | Clean, consistent icon set. |
| Database | **PostgreSQL on Supabase** | Reliable relational database; the data model (customers → orders → items) is naturally relational. |
| Auth | **Supabase Auth** via `@supabase/ssr` | Proper sessions in secure HTTP-only cookies, email confirmation, password reset. |
| Validation | **Zod** | One schema checks form input on both the client and the server. |
| Notifications | **Sonner** toasts | Success and error feedback. |
| Theming | **next-themes** | Light, dark and system themes. |
| AI | **OpenAI** behind our own provider interface | Ready for OpenAI now; the interface means another provider can be added later without touching the UI. |

## 3. Folder structure

```
ledgerly/
├─ docs/ARCHITECTURE.md        ← this file
├─ supabase/migrations/        ← SQL that creates tables and security rules
├─ src/
│  ├─ app/
│  │  ├─ (auth)/               ← sign-in, sign-up, forgot password
│  │  ├─ (app)/                ← everything behind login (has the sidebar)
│  │  │  ├─ dashboard/
│  │  │  ├─ customers/
│  │  │  ├─ products/
│  │  │  ├─ orders/
│  │  │  ├─ follow-ups/
│  │  │  ├─ assistant/
│  │  │  ├─ analytics/
│  │  │  └─ settings/
│  │  ├─ onboarding/           ← create the business profile after sign-up
│  │  └─ api/ai/chat/          ← streaming AI endpoint
│  ├─ components/
│  │  ├─ ui/                   ← shadcn/ui building blocks (button, card…)
│  │  ├─ layout/               ← sidebar, top bar, command menu
│  │  └─ shared/               ← page header, empty state, stat card…
│  ├─ features/<module>/       ← per-module code: actions, queries, forms
│  ├─ lib/
│  │  ├─ supabase/             ← database clients (browser, server, proxy)
│  │  ├─ ai/                   ← AI provider interface + OpenAI adapter
│  │  └─ utils.ts, format.ts   ← helpers (class names, money, dates)
│  └─ proxy.ts                 ← refreshes the Supabase session on each request
```

Each module (customers, products, orders…) keeps its own code together in
`src/features/<module>/`, so finding things stays easy as the app grows.

## 4. Database design (PostgreSQL / Supabase)

**Multi-tenant from day one.** Every record belongs to a *business*, and
users are linked to businesses through *memberships*. Today each owner has
one business; later the same design supports staff accounts and owners with
several businesses, without a rewrite.

```
auth.users (managed by Supabase)
   │ 1
   │
   ├──── profiles            (name, avatar)
   │
   └──── business_members ───── businesses
              (role: owner / admin / staff)      │
                                                 │ every table below has business_id
                ┌──────────────┬─────────────────┼───────────────┬──────────────┐
             customers      products           orders        follow_ups    ai_conversations
                │              │                  │                              │
                │              └── order_items ───┘                         ai_messages
                └──────────────────────────────── (orders.customer_id)
```

Main tables (columns abbreviated):

- **businesses**: name, industry, country, currency, timezone, phone, email, address, logo.
- **business_members**: business_id, user_id, role.
- **customers**: name, email, phone, address, notes, tags, status (active / inactive / lead).
- **products**: name, SKU, description, category, price, cost, stock quantity, low-stock threshold, unit, active flag.
- **orders**: order number (per business), customer, status (draft → pending → confirmed → completed / cancelled), payment status (unpaid / partial / paid), subtotal, discount, total, amount paid, order date, due date, notes.
- **order_items**: product, name and price *snapshot* (so old orders don't change when a price changes), quantity, line total.
- **follow_ups**: title, notes, due date/time, priority, status (pending / done / cancelled), linked customer and/or order.
- **ai_conversations / ai_messages**: chat history with the assistant.

Rules kept inside the database (not just in the UI):
- Money is stored as `numeric(12,2)`, never floating point.
- Creating an order and its items, numbering it, and reducing product
  stock happen in **one database function** (a transaction), so stock can
  never get out of step with orders.
- `created_at` / `updated_at` are set automatically by triggers.
- Indexes on `business_id` plus the columns we search and sort by.

**Migrations.** Every change to the database is a numbered SQL file in
`supabase/migrations/`. Running them in order recreates the database
exactly, on your machine or in production.

## 5. Security

1. **Authentication (who are you?)** is handled by Supabase Auth. Passwords
   are hashed by Supabase; the session lives in secure, HTTP-only cookies that
   page scripts cannot read. `proxy.ts` refreshes the session on every
   request.
2. **Authorization (what may you see?)** is enforced by PostgreSQL **Row
   Level Security (RLS)**. Every table has policies like *"you can read a
   customer only if you are a member of that customer's business"*. Even if
   there were a bug in our code, the database itself refuses to return
   another business's data.
3. **Server-side checks.** Pages behind login check the user on the server
   (not only in `proxy.ts`), as the Next.js docs recommend.
4. **Validation.** Every form is validated with Zod on the server before
   anything is written.
5. **Secrets.** The OpenAI key and the Supabase *service role* key are
   server-only environment variables. Only the public Supabase URL and
   *anon* key are sent to the browser, and they are safe because RLS
   protects the data.

## 6. Backend / API architecture

Next.js lets us write backend code in the same project. We use three kinds:

| Kind | Used for | Example |
|---|---|---|
| **Server Components** | Reading data to show a page | The customers list queries Supabase on the server and sends finished HTML. |
| **Server Actions** | Creating, updating, deleting | `createCustomer(formData)` validates with Zod, inserts, then refreshes the page. |
| **Route Handlers** (`/api/...`) | Things that need streaming or external callers | `POST /api/ai/chat` streams the AI reply. |

Each module follows the same pattern:

```
features/customers/
  ├─ schema.ts    Zod schemas + TypeScript types
  ├─ queries.ts   read functions (list, search, filter, get one)
  ├─ actions.ts   server actions (create, update, delete)
  └─ components/  forms, tables, dialogs for this module
```

All queries go through the Supabase server client, which carries the signed-in
user's session, so RLS applies automatically. The powerful *service role*
key is used only for rare admin tasks, never for normal requests.

**Search and filtering** happen in the database (`ilike` search on names,
emails, phone numbers and SKUs; filters by status, date range and payment
status; pagination with `range()`), so they stay fast as data grows. The
current search and filters live in the URL (`?q=ada&status=unpaid`), so a
filtered view can be bookmarked and the back button works.

## 7. AI assistant architecture (prepared for OpenAI)

```
Assistant page (chat UI)
   │ POST /api/ai/chat  (message + conversation id)
   ▼
Route handler
   ├─ checks the user is signed in and gets their business
   ├─ builds the system prompt: business profile + today's date
   ├─ calls  AIProvider.streamChat(...)         ← src/lib/ai/provider.ts
   │            └─ OpenAIProvider (default)       ← src/lib/ai/openai.ts
   ├─ runs tool calls the model makes:
   │     get_business_summary, search_customers, list_low_stock,
   │     list_unpaid_orders, list_due_follow_ups, create_follow_up …
   │     (each tool is a normal database query through RLS)
   └─ streams the answer back and saves it to ai_messages
```

- **Provider interface.** The app talks to a small `AIProvider` interface,
  not to OpenAI directly. `OpenAIProvider` implements it with the official
  `openai` SDK. Switching or adding a provider means writing one new adapter.
- **Grounded answers.** The model gets facts through *tools* that query the
  owner's own data, and totals are computed in SQL, so the figures it quotes
  are exact.
- **Safe actions.** Tools that change data (like creating a follow-up)
  are limited to low-risk actions and are always confirmed in the chat.
- **Configuration.** `OPENAI_API_KEY` and `OPENAI_MODEL` are environment
  variables. Without a key, the assistant page explains how to set one
  instead of failing.

## 8. Design system

- **Brand:** Ledgerly's own identity: a deep emerald primary colour
  (growth, money, trust), neutral slate surfaces, the Geist typeface and a
  custom "L" ledger mark.
- **Tokens:** colours, radius and shadows are CSS variables in
  `src/app/globals.css`, with a matching dark theme. Components never use
  raw colours, so the whole app can be re-themed in one place.
- **States:** every data screen has a loading state (skeletons), an empty
  state (what to do next), an error state (what went wrong and a retry), and
  success feedback (toasts).
- **Responsive:** sidebar on desktop, slide-out menu on mobile; tables
  become cards on small screens.
- **Motion:** short, subtle transitions (150–250 ms), and reduced for users
  who ask their device for less motion.

## 9. Build plan

1. **Foundation & design system**: project setup, theme, components, app shell.
2. **Authentication**: sign up, sign in, sign out, password reset, protected pages.
3. **Business onboarding**: create the business profile after sign-up.
4. **Dashboard**: key numbers, recent orders, due follow-ups.
5. **Customers**: add, edit, view, delete, search, filter.
6. **Products**: same, plus stock and low-stock alerts.
7. **Orders**: create orders with items, payments, statuses.
8. **Follow-ups**: reminders linked to customers and orders.
9. **AI assistant**: chat grounded in the business data.
10. **Analytics & polish**: charts, reports, settings, final touches.

## 10. Environment variables

| Name | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | no (protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, admin tasks | **yes** |
| `OPENAI_API_KEY` | server only | **yes** |
| `OPENAI_MODEL` | server only | no |
| `NEXT_PUBLIC_SITE_URL` | auth email links | no |
