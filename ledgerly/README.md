# Ledgerly

Ledgerly helps small business owners manage their business in one place:
customers, products, orders, follow-up reminders, analytics, and an AI
assistant that knows the business.

Built with Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui and Supabase.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how everything fits
together.

## Build progress

| Step | What | Status |
|---|---|---|
| 1 | Foundation & design system | ✅ Done |
| 2 | Authentication | Next |
| 3 | Business onboarding | |
| 4 | Dashboard | |
| 5 | Customers | |
| 6 | Products | |
| 7 | Orders | |
| 8 | Follow-ups | |
| 9 | AI assistant | |
| 10 | Analytics & polish | |

## Run it on your computer

You need [Node.js](https://nodejs.org) version 20.9 or newer.

```bash
cd ledgerly
npm install        # first time only: downloads the libraries
npm run dev        # starts Ledgerly in development mode
```

Then open <http://localhost:3000> in your browser.

Useful pages while building:
- <http://localhost:3000/dashboard>: the app home
- <http://localhost:3000/design-system>: every button, card, form and state in one place

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally, reloading as you edit |
| `npm run build` | Make a production build (also catches errors) |
| `npm run start` | Run the production build |
| `npm run lint` | Check the code for common mistakes |
| `npm run typecheck` | Check TypeScript types |
| `npm run check` | Typecheck and lint together |
| `npm run format` | Tidy code formatting |

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. Supabase keys are needed
from step 2 and the OpenAI key from step 9. `.env.local` is never committed.

## Adding shadcn/ui components

Components live in `src/components/ui`. On your own machine you can add more
with the shadcn CLI, which reads `components.json`:

```bash
npx shadcn@latest add calendar
```
