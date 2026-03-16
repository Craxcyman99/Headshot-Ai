/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (payment success, failure, etc.)
 */
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { config } from '@/lib/config';
import { createSupabaseAdminClient } from '@/lib/supabase';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      const userId = session.metadata?.userId;

      console.log(`✅ Payment succeeded for job: ${jobId}`);

      if (jobId && userId) {
        const supabase = createSupabaseAdminClient();

        // Upsert payment record
        const { error: upsertError } = await supabase
          .from('payments')
          .upsert({
            job_id: jobId,
            user_id: userId,
            stripe_session_id: session.id,
            amount: session.amount_total || 0,
            status: 'completed',
          }, {
            onConflict: 'stripe_session_id',
          });

        if (upsertError) {
          console.error('Failed to record payment:', upsertError);
        } else {
          console.log(`Payment recorded for job ${jobId}`);
        }
      }

      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      console.log(`⏰ Checkout expired for job: ${jobId}`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
