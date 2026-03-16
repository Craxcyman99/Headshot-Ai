# Headshot AI — Deployment Guide

## Prerequisites

- **Node.js** ≥ 18.17
- **Accounts:** Vercel, Supabase, Stripe, Replicate
- **Vercel CLI:** `npm i -g vercel`

## 1. Environment Setup

```bash
cp .env.local.template .env.local
# Fill in every value — see comments in the template for where to find each key
```

## 2. Database Setup (Prisma + Supabase)

1. In Supabase Dashboard → Project Settings → Database, copy the **connection string (URI)**
2. Use the **Transaction pooler** URI (port 6543) for `DATABASE_URL`
3. Run migrations:

```bash
npx prisma migrate deploy
```

## 3. Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create a bucket named **`headshots`** (or whatever the app expects)
3. Set bucket to **public** if generated images should be publicly accessible
4. Add RLS policies as needed (authenticated users can upload to their own folder)

## 4. Stripe Setup

1. Create a **Product** in Stripe Dashboard (e.g. "AI Headshot Pack")
2. Create a **Price** (one-time, e.g. $29) — copy the `price_xxx` ID into `STRIPE_PRICE_ID`
3. Create a **Webhook Endpoint:**
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`

## 5. Replicate Setup

1. Get your API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Set up a webhook endpoint:
   - URL: `https://your-domain.com/api/webhooks/replicate`
   - Generate a shared secret: `openssl rand -hex 32`
   - Put the secret in `REPLICATE_WEBHOOK_SECRET`

## 6. Deploy to Vercel

```bash
# Link project (first time)
vercel link

# Set environment variables
vercel env pull .env.local          # if already configured in Vercel dashboard
# OR add them one by one:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... etc for all vars in .env.local.template

# Deploy
vercel --prod
```

Or push to GitHub and connect the repo in Vercel Dashboard for automatic deploys.

## 7. Post-Deploy Verification

- [ ] Visit the deployed URL — homepage loads without errors
- [ ] Check browser console for missing env var warnings
- [ ] Test Stripe checkout flow (use test mode keys)
- [ ] Upload a test photo — confirm it reaches Supabase storage
- [ ] Trigger a generation — confirm Replicate webhook fires and results appear
- [ ] Check Vercel Functions logs for any 500s or timeouts
- [ ] Verify CSP headers aren't blocking Stripe/Supabase in production

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `prisma generate` fails on deploy | Ensure `postinstall` script exists in package.json |
| Webhook 401/403 | Check signing secrets match between provider and env vars |
| Images not loading | Verify `next.config.js` remotePatterns includes the CDN domain |
| Function timeout | Vercel Hobby plan caps at 10s; Pro plan needed for 60s functions |
| Database connection errors | Use pooled connection string (port 6543), not direct (5432) |
