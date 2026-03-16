/**
 * POST /api/webhooks/replicate
 * Handles Replicate prediction completion webhooks.
 * Authenticated via secret token in the request header or query param.
 * Job is identified via the jobId query parameter passed in the webhook URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Webhook authentication — check secret token
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token =
        req.headers.get('authorization')?.replace('Bearer ', '') ||
        req.nextUrl.searchParams.get('secret');

      if (token !== webhookSecret) {
        console.warn('Replicate webhook: invalid secret token');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { id: predictionId, status, output, error: predictionError } = body;

    console.log(
      `Replicate webhook: prediction=${predictionId} status=${status}`
    );

    if (!predictionId) {
      return NextResponse.json(
        { error: 'Missing prediction ID' },
        { status: 400 }
      );
    }

    // Get jobId from the webhook URL query parameter
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      console.warn('Replicate webhook: missing jobId query parameter');
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      console.warn(`Replicate webhook: job ${jobId} not found`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (status === 'succeeded') {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          output_image_urls: output || [],
          completed_at: new Date(),
        },
      });
      console.log(`Updated job ${jobId} → completed`);
    } else if (status === 'failed' || status === 'canceled') {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completed_at: new Date(),
        },
      });
      console.log(`Updated job ${jobId} → failed (${predictionError || status})`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Replicate webhook error:', err);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
