/**
 * Upload API Route
 * Handles photo uploads with full security: auth, rate limiting,
 * magic byte validation, input validation, and CSRF protection.
 * Files are stored in Supabase Storage for persistence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateImageFile } from '@/lib/file-security';
import { validateStyle, validateBackground } from '@/lib/validation';
import { requireAuth } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { uploadImage, createSupabaseAdminClient } from '@/lib/supabase';
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
    const { user } = authResult;

    // Rate limiting (20 uploads per minute)
    const clientIp = getClientIp(req);
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

    const formData = await req.formData();
    const photos = formData.getAll('photos') as File[];
    const styleRaw = (formData.get('style') as string) || 'professional';
    const backgroundRaw = (formData.get('background') as string) || 'white';

    // Validate style and background
    const styleResult = validateStyle(styleRaw);
    if (!styleResult.valid) {
      return NextResponse.json({ error: styleResult.error }, { status: 400 });
    }

    const bgResult = validateBackground(backgroundRaw);
    if (!bgResult.valid) {
      return NextResponse.json({ error: bgResult.error }, { status: 400 });
    }

    if (photos.length < 5) {
      return NextResponse.json({ error: 'Please upload at least 5 photos' }, { status: 400 });
    }

    if (photos.length > 15) {
      return NextResponse.json({ error: 'Maximum 15 photos allowed' }, { status: 400 });
    }

    // Validate each file with magic byte checking
    for (const photo of photos) {
      if (!(photo instanceof File)) {
        return NextResponse.json({ error: 'Invalid file upload' }, { status: 400 });
      }
      const validation = await validateImageFile(photo);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid file "${photo.name}": ${validation.error}` },
          { status: 400 }
        );
      }
    }

    // Create job
    const jobId = randomUUID();

    // Upload all files to Supabase Storage
    const supabaseUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const buffer = Buffer.from(await photo.arrayBuffer());

      // Detect MIME type from buffer
      const validation = await validateImageFile(new File([buffer], 'check'));
      const detectedMime = validation.detectedMime || 'image/jpeg';
      const ext =
        detectedMime === 'image/jpeg'
          ? 'jpg'
          : detectedMime === 'image/png'
            ? 'png'
            : detectedMime === 'image/webp'
              ? 'webp'
              : 'jpg';

      const storagePath = `${user.id}/${jobId}/input_${i}.${ext}`;
      const blob = new Blob([buffer], { type: detectedMime });
      const publicUrl = await uploadImage(blob as any, storagePath, 'uploads');
      supabaseUrls.push(publicUrl);
    }

    // Persist job metadata to database via Prisma
    await prisma.job.create({
      data: {
        id: jobId,
        user_id: user.id,
        status: 'pending',
        style: styleResult.value,
        background: bgResult.value,
        input_image_url: supabaseUrls[0] || null,
        output_image_urls: supabaseUrls,
      },
    });

    return NextResponse.json({ jobId, status: 'uploaded', photoCount: photos.length });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
