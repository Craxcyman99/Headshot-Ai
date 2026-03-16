# Headshot AI - Build Notes

## Build Status: ✅ PASSES

**Date:** 2026-03-13

---

## Files Created

### Config Files
- `.gitignore` — Node, Next.js, env files, uploads, prisma
- `postcss.config.js` — Tailwind + Autoprefixer
- `tsconfig.json` — Strict mode, bundler resolution, `@/*` path alias
- `.env.local` — Placeholder env vars for build

### New Source Files
- `src/lib/config.ts` — Centralized env variable validation
- `src/lib/stripe.ts` — Stripe client setup (apiVersion `2023-10-16`)
- `src/app/api/checkout/route.ts` — Stripe Checkout session creation ($19 one-time)
- `src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler (checkout.completed, etc.)

### Fixed
- `src/app/results/[jobId]/page.tsx` — Proper typing for Next.js 14 params (plain object, not Promise)

---

## Build Fixes Applied

1. **`src/lib/replicate.ts:106`** — `Replicate.Prediction` is invalid (class isn't a namespace). Fixed by importing `Prediction` type directly: `import Replicate, { Prediction } from "replicate"`.

2. **`src/lib/stripe.ts:5`** — API version `2024-06-20` doesn't exist in stripe@14.25.0. Changed to `2023-10-16` (the version this package supports).

---

## Stripe Integration Notes

- Checkout creates a one-time payment session via `POST /api/checkout`
- Webhook at `POST /api/webhooks/stripe` handles `checkout.session.completed`, `checkout.session.expired`, and `payment_intent.payment_failed`
- Success URL redirects to `/results/{jobId}?payment=success`
- Cancel URL redirects to `/dashboard?payment=cancelled`
- To create a real product/price: `stripe prices create --unit-amount 1900 --currency usd --product-data name="Professional Pack"` (one-time)
- Set `STRIPE_PRICE_ID` in `.env.local` with the real price ID

---

## Warnings (Non-blocking)

- `metadataBase` not set for OG image resolution — uses `http://localhost:3000` by default. Set in layout.tsx metadata for production.

---

## Routes Summary

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static | Landing page |
| `/dashboard` | Static | Upload + style + generate flow |
| `/results/[jobId]` | Dynamic | Polling results page |
| `/api/checkout` | API | Create Stripe checkout session |
| `/api/upload` | API | Upload photos |
| `/api/generate` | API | Trigger / poll AI generation |
| `/api/webhooks/stripe` | API | Stripe payment webhooks |

---

## Next Steps (not done)
- Set real Stripe price ID and API keys
- Wire checkout into dashboard flow (pay before generate)
- Connect to Supabase for auth + persistent storage
- Deploy to Vercel
