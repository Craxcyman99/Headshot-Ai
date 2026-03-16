# Headshot AI

Professional AI headshots from selfies. Upload photos → Get professional headshots in 2 minutes.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Next.js 14** — App Router, Server Actions, API Routes
- **Tailwind CSS** — Dark mode design system
- **Framer Motion** — Smooth animations
- **Replicate (Flux)** — AI image generation
- **Stripe** — Payment processing
- **Supabase** — Auth + storage

## Architecture

```
User uploads selfies
    ↓
/api/upload → saves to disk (or Supabase Storage)
    ↓
/api/generate → Replicate Flux API
    ↓
Results page → user selects & downloads
```

## AI Generation

Uses **Flux 1.1 Pro** via Replicate for:
- High-quality photorealistic output
- Face preservation from reference images
- Multiple style variations
- Custom backgrounds

**Cost:** ~$0.05-0.10 per image on Replicate

## Pricing Strategy

| Plan | Price | What You Get |
|------|-------|--------------|
| Free | $0 | 1 headshot (watermarked) |
| Basic | $9.99 | 10 headshots, 2 styles |
| Pro | $19.99 | 20 headshots, 4 styles, HD |
| Team | $49.99 | 50 headshots, all styles, priority |

## MVP Launch Checklist

- [ ] Landing page (✅ Done)
- [ ] Upload flow (✅ Done)
- [ ] AI generation (✅ Done)
- [ ] Results page (✅ Done)
- [ ] Stripe checkout
- [ ] Email delivery
- [ ] Supabase auth
- [ ] Deploy to Vercel
- [ ] Custom domain
- [ ] Analytics (Plausible)
- [ ] OG images

## Content Strategy

**TikTok Ideas:**
- "I got a professional headshot from this selfie" → show transformation
- "Spent $300 on a photographer OR $19 on AI" → side by side
- "POV: You need a LinkedIn photo at 2am" → upload selfie, get headshot
- "My company wanted professional headshots for 50 people" → show bulk result

**Viral Hooks:**
- "This AI makes you look like a CEO"
- "I haven't been to a photographer in 2 years thanks to this"
- "HR thought I hired a professional photographer"
