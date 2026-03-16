/**
 * POST /api/generate
 * Starts headshot generation asynchronously via Replicate.
 * Returns immediately with { status: 'generating', jobId }.
 * The Replicate webhook updates the job when complete.
 * GET  /api/generate?jobId=xxx — poll job status.
 *
 * Security: auth required, rate limited, CSRF protected, input validated.
 */
import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { STYLE_PROMPTS, BACKGROUND_DESCRIPTIONS } from '@/lib/replicate';
import { createSupabaseAdminClient, toSignedUrl } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireAuth, applyAuthCookies } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { validateUUID } from '@/lib/validation';
import { prisma } from '@/lib/prisma';

const MODEL = 'black-forest-labs/flux-dev-lora';

export const dynamic = 'force-dynamic';

// ---------- POST — start generation ----------
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

    // Rate limiting: 10 requests per minute per user
    const rlKey = `generate:${user.id}`;
    const rl = checkRateLimit(rlKey, { maxRequests: 10 });
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
    const jobIdValidation = validateUUID(body.jobId);
    if (!jobIdValidation.valid) {
      return NextResponse.json({ error: jobIdValidation.error }, { status: 400 });
    }
    const jobId = jobIdValidation.value;

    // Look up job in database
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Skip if already generating or completed
    if (job.status === 'processing' || job.status === 'completed') {
      return NextResponse.json({
        jobId,
        status: job.status,
        results: (job.output_image_urls as string[]) || [],
      });
    }

    // Verify payment before generating
    const supabase = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('status', 'completed')
      .maybeSingle();

    if (paymentError) {
      console.error('Payment check error:', paymentError);
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment required. Please complete checkout before generating.' },
        { status: 402 }
      );
    }

    // Mark as processing
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    if (
      process.env.REPLICATE_API_TOKEN &&
      process.env.REPLICATE_API_TOKEN !== 'replicate_placeholder'
    ) {
      // Get input image from the job record
      const primaryImage = job.input_image_url;

      if (!primaryImage) {
        return NextResponse.json({ error: 'No input image found for job' }, { status: 400 });
      }

      // Start prediction without polling (async)
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

      const promptTemplate =
        STYLE_PROMPTS[job.style || 'professional'] || STYLE_PROMPTS.professional;
      const bgDescription =
        BACKGROUND_DESCRIPTIONS[job.background || 'neutral'] || job.background || 'neutral';
      const prompt = promptTemplate.replace('{background}', bgDescription);

      // Generate a signed URL so Replicate can fetch the image from our private bucket
      const signedImageUrl = await toSignedUrl(primaryImage, 3600); // 1 hour expiry

      // Pass jobId via webhook URL query param so the webhook can look up the job directly
      const webhookBase = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`
        : undefined;
      const webhookUrl = webhookBase
        ? `${webhookBase}?jobId=${jobId}`
        : undefined;

      const prediction = await replicate.predictions.create({
        model: MODEL,
        input: {
          prompt,
          image: signedImageUrl,
          num_outputs: 5,
          guidance_scale: 3.5,
          num_inference_steps: 28,
          seed: Math.floor(Math.random() * 2147483647),
          lora_scale: 0.9,
          output_format: 'webp',
          output_quality: 90,
        },
        ...(webhookUrl && {
          webhook: webhookUrl,
          webhook_events_filter: ['completed'],
        }),
      });

      console.log(`Prediction started: ${prediction.id} for job ${jobId}`);

      const resp = NextResponse.json({ jobId, status: 'processing', predictionId: prediction.id });
      applyAuthCookies(resp, cookieUpdates);
      return resp;
    } else {
      // Mock for dev / no API key — complete immediately
      console.log('⚠️  No Replicate token — returning mock images');
      const mockUrls = Array.from({ length: 5 }, (_, i) =>
        `https://placehold.co/1024x1024/1e293b/d946ef?text=Headshot+${i + 1}`
      );

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          output_image_urls: mockUrls,
          completed_at: new Date(),
        },
      });

      const resp = NextResponse.json({
        jobId,
        status: 'completed',
        count: mockUrls.length,
        images: mockUrls,
      });
      applyAuthCookies(resp, cookieUpdates);
      return resp;
    }
  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    );
  }
}

// ---------- GET — poll status ----------
export async function GET(req: NextRequest) {
  const jobIdRaw = req.nextUrl.searchParams.get('jobId');
  const jobIdValidation = validateUUID(jobIdRaw);
  if (!jobIdValidation.valid) {
    return NextResponse.json({ error: jobIdValidation.error }, { status: 400 });
  }
  const jobId = jobIdValidation.value;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    results: (job.output_image_urls as string[]) || [],
    createdAt: job.created_at.toISOString(),
    completedAt: job.completed_at?.toISOString() || null,
  });
}
