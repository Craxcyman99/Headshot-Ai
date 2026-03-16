/**
 * Upload API Route
 * Accepts photo URLs (already uploaded to Supabase Storage from the client)
 * and creates a job record.
 *
 * Photos are uploaded directly from the browser to Supabase Storage to avoid
 * Vercel's 4.5MB serverless function body size limit.
 *
 * Security: auth required, rate limited, CSRF protected, input validated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateStyle, validateBackground } from '@/lib/validation';
import { requireAuth, applyAuthCookies } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 });
    }

    // Authentication required
    const authResult = await requireAuth(req);
    if ('error' in authResult) return authResult.error;
    const { user, cookieUpdates } = authResult;

    // Rate limiting (20 requests per minute)
    const rlKey = `upload:${user.id}`;
    const rl = checkRateLimit(rlKey, { maxRequests: 20 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
        }
      );
    }

    const body = await req.json();
    const { photoUrls, style: styleRaw, background: backgroundRaw } = body;

    // Validate photo URLs
    if (!Array.isArray(photoUrls) || photoUrls.length < 5) {
      return NextResponse.json({ error: 'Please upload at least 5 photos' }, { status: 400 });
    }

    if (photoUrls.length > 15) {
      return NextResponse.json({ error: 'Maximum 15 photos allowed' }, { status: 400 });
    }

    // Validate all URLs are from our Supabase storage and belong to this user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    for (const url of photoUrls) {
      if (typeof url !== 'string' || !url.startsWith(`${supabaseUrl}/storage/`)) {
        return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
      }
      if (!url.includes(`/${user.id}/`)) {
        return NextResponse.json({ error: 'Unauthorized photo URL' }, { status: 403 });
      }
    }

    // Validate style and background
    const styleResult = validateStyle(styleRaw || 'professional');
    if (!styleResult.valid) {
      return NextResponse.json({ error: styleResult.error }, { status: 400 });
    }

    const bgResult = validateBackground(backgroundRaw || 'white');
    if (!bgResult.valid) {
      return NextResponse.json({ error: bgResult.error }, { status: 400 });
    }

    // Create job
    const jobId = randomUUID();

    await prisma.job.create({
      data: {
        id: jobId,
        user_id: user.id,
        status: 'pending',
        style: styleResult.value,
        background: bgResult.value,
        input_image_url: photoUrls[0] || null,
      },
    });

    const response = NextResponse.json({ jobId, status: 'uploaded', photoCount: photoUrls.length });
    applyAuthCookies(response, cookieUpdates);
    return response;
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || 'Upload failed' },
      { status: 500 }
    );
  }
}
