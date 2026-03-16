# Headshot AI - Setup Instructions

## Prerequisites

- Node.js 20+ and npm
- Git
- Accounts: Supabase, Replicate, Stripe

## Quick Start

### 1. Clone & Install

```bash
cd /home/reece/.openclaw/workspace/software-studio/projects/headshot-ai
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your actual keys
```

### 3. Supabase Setup

Create project at [supabase.com/dashboard](https://supabase.com/dashboard), then:

```bash
# Apply database schema via SQL Editor in Supabase Dashboard
# Copy contents of prisma/migrations/001_initial_schema.sql

# Or use Prisma (requires DATABASE_URL from Supabase):
npx prisma db push
```

**Create Storage Buckets** (via Dashboard > Storage):
- `uploads` — public, 10MB limit, JPEG/PNG/WebP
- `results` — public, 10MB limit, WebP/JPEG/PNG

**Enable Auth** (via Dashboard > Authentication > Providers):
- Enable Email provider
- Set Site URL to your domain
- Add redirect URL: `{YOUR_DOMAIN}/auth/callback`

### 4. Replicate Setup

1. Get API token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Add to `.env.local`: `REPLICATE_API_TOKEN=r8_...`
3. Model used: `black-forest-labs/flux-dev-lora` (no setup needed, runs on Replicate)

### 5. Stripe Setup

1. Get API keys at [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Create webhook endpoint pointing to `{YOUR_DOMAIN}/api/webhooks/stripe`
3. Add all keys to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
headshot-ai/
├── prisma/
│   ├── schema.prisma                    # Prisma schema
│   └── migrations/
│       └── 001_initial_schema.sql       # Raw SQL migration (with RLS)
├── src/
│   ├── lib/
│   │   ├── supabase.ts                  # Supabase client + auth + storage
│   │   └── replicate.ts                 # Replicate client + generation logic
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx                 # Admin dashboard
│   │   ├── api/
│   │   │   ├── admin/stats/route.ts     # Admin stats API
│   │   │   ├── generate/route.ts        # Generation API (existing)
│   │   │   └── upload/route.ts          # Upload API (existing)
│   │   ├── dashboard/
│   │   │   └── page.tsx                 # User dashboard (existing)
│   │   ├── results/[jobId]/page.tsx     # Results page (existing)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                     # Landing page (existing)
│   └── ...
├── DEPLOY.md                            # Full deployment guide
├── SETUP.md                             # This file
├── .env.example                         # Environment template
└── package.json
```

## Key Files

### `src/lib/supabase.ts`
- `createSupabaseBrowserClient()` — browser client (RLS-enforced)
- `createSupabaseAdminClient()` — server client (bypasses RLS)
- `uploadImage()` / `uploadImages()` — storage helpers
- `signInWithEmail()` / `signOut()` — auth helpers
- `ensureBuckets()` — creates storage buckets if missing

### `src/lib/replicate.ts`
- `generateHeadshots()` — main generation function
- 8 style presets: professional, casual, creative, executive, linkedin, tech, medical, legal
- 7 background options: neutral, white, office, outdoor, dark, studio, city
- Built-in retry logic (3 attempts with exponential backoff)
- Async polling for prediction completion

### `src/app/admin/page.tsx`
- Displays total jobs, total revenue, recent job list
- Fetches from `/api/admin/stats`
- Auto-refreshable

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/generate` | POST | Start headshot generation |
| `/api/upload` | POST | Upload source photos |
| `/api/admin/stats` | GET | Admin dashboard stats |
| `/api/webhooks/stripe` | POST | Stripe payment webhook |
| `/api/webhooks/replicate` | POST | Replicate completion webhook |

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push Prisma schema to DB
npm run db:studio    # Open Prisma Studio (DB GUI)
```

## Testing

1. **Auth flow:** Sign up → check email → land on dashboard
2. **Upload:** Drop photos → verify in Supabase Storage
3. **Generation:** Select style → trigger → poll for results
4. **Payment:** Checkout session → Stripe webhook → payment record
5. **Admin:** Visit `/admin` → verify stats load
