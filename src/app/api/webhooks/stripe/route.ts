import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

async function syncSubscription(
  userId: string,
  stripeSub: Stripe.Subscription,
  customerId: string
) {
  const db = getAdminDb();

  const sub = {
    plan: 'pro' as const,
    status: stripeSub.status as 'active' | 'trialing' | 'past_due' | 'canceled',
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    currentPeriodEnd: new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000),
    ocrUsedThisMonth: 0,
    ocrResetAt: new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000),
  };

  await db.collection('users').doc(userId).update({ subscription: sub });
}

async function cancelSubscription(userId: string) {
  const db = getAdminDb();
  await db.collection('users').doc(userId).update({
    'subscription.plan': 'free',
    'subscription.status': 'canceled',
    'subscription.stripeSubscriptionId': null,
    'subscription.currentPeriodEnd': null,
  });
}

async function getUserIdByCustomer(customerId: string): Promise<string | null> {
  const db = getAdminDb();
  const snap = await db.collection('users')
    .where('subscription.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id;
        if (!userId || !session.subscription) break;

        const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(userId, stripeSub, session.customer as string);
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdByCustomer(stripeSub.customer as string);
        if (!userId) break;
        await syncSubscription(userId, stripeSub, stripeSub.customer as string);
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdByCustomer(stripeSub.customer as string);
        if (!userId) break;
        await cancelSubscription(userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await getUserIdByCustomer(invoice.customer as string);
        if (!userId) break;
        const db = getAdminDb();
        await db.collection('users').doc(userId).update({ 'subscription.status': 'past_due' });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
