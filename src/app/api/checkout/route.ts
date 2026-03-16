/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the $19 one-time payment.
 *
 * Security: auth required, rate limited, CSRF protected, input validated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { config } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { validateUUID } from '@/lib/validation';
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

    // Rate limiting: 20 requests per minute per user
    const rlKey = `checkout:${user.id}`;
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
    const jobIdValidation = validateUUID(body.jobId);
    if (!jobIdValidation.valid) {
      return NextResponse.json({ error: jobIdValidation.error }, { status: 400 });
    }
    const jobId = jobIdValidation.value;

    // Verify the job belongs to the authenticated user
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: config.stripe.priceId,
          quantity: 1,
        },
      ],
      success_url: `${config.app.url}/results/${jobId}?payment=success`,
      cancel_url: `${config.app.url}/dashboard?payment=cancelled`,
      metadata: {
        jobId,
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError = message.includes('did not match') ||
                        message.includes('is not a function') ||
                        message.includes('Cannot read prop');
    return NextResponse.json(
      { error: isAuthError ? 'Session expired. Please sign in again.' : (message || 'Checkout failed') },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
