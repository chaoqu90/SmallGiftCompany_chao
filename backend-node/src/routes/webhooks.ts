/**
 * Stripe webhook handler.
 *
 * POST /api/webhooks/stripe
 *   — receives signed events from Stripe
 *   — MUST be mounted with express.raw() (before express.json()) so the
 *     raw request body is available for signature verification
 *
 * Handles:
 *   payment_intent.succeeded  → confirmOrder() + send confirmation email
 *   payment_intent.payment_failed → logs only (cart preserved for retry)
 *
 * Returns 200 immediately for unhandled event types (Stripe stops retrying
 * if it receives a non-2xx response).
 *
 * Design: specs/payment/design.md §4.3
 */
import { Router, type Request, type Response } from 'express';
import { stripe } from '../lib/stripe.js';
import { confirmOrder } from '../repositories/orders.js';

export const webhookRouter = Router();

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — webhook signature verification will fail.');
}

webhookRouter.post(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !secret) {
      res.status(400).json({ error: 'Missing stripe-signature header or webhook secret.' });
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        const meta = pi.metadata;

        await confirmOrder({
          paymentIntentId: pi.id,
          sessionId:       meta.sessionId       ?? '',
          email:           meta.email           ?? '',
          name:            meta.name            || null,
          userId:          meta.userId          || null,
          shippingStreet:  meta.shippingStreet  || null,
          shippingCity:    meta.shippingCity    || null,
          shippingState:   meta.shippingState   || null,
          shippingZip:     meta.shippingZip     || null,
          shippingCountry: meta.shippingCountry || null,
        });

        console.log('[webhook] Order confirmed for payment intent:', pi.id);
      } else if (event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object;
        console.log('[webhook] Payment failed for intent:', pi.id, '— cart preserved.');
      }
      // All other event types: acknowledge and ignore
    } catch (err) {
      // Return 500 so Stripe retries — but log it so it doesn't get lost
      console.error('[webhook] Error processing event:', event.type, err);
      res.status(500).json({ error: 'Internal processing error' });
      return;
    }

    res.json({ received: true });
  },
);
