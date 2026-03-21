// ============================================================
// POST /api/billing/webhook — Stripe webhook handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'
import { constructWebhookEvent, mapStripeSubscriptionStatus } from '@/lib/billing'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdminClient() as any

  try {
    switch (event.type) {
      // --------------------------------------------------------
      // Subscription created or updated
      // --------------------------------------------------------
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as {
          id: string;
          customer: string;
          status: string;
          items: { data: Array<{ price: { id: string; product: string } }> };
          current_period_end: number;
        }

        const customerId = subscription.customer as string
        const status = mapStripeSubscriptionStatus(subscription.status as Parameters<typeof mapStripeSubscriptionStatus>[0])

        // Find organization by Stripe customer ID
        const { data: org } = await supabase
          .from('organizations')
          .select('id, plan_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          await supabase
            .from('organizations')
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', (org as { id: string }).id)
        }
        break
      }

      // --------------------------------------------------------
      // Subscription deleted / canceled
      // --------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as { id: string; customer: string }
        const customerId = subscription.customer as string

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          await supabase
            .from('organizations')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', (org as { id: string }).id)
        }
        break
      }

      // --------------------------------------------------------
      // Invoice payment succeeded
      // --------------------------------------------------------
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as {
          customer: string;
          amount_paid: number;
          period_start: number;
          period_end: number;
          subscription: string | null;
        }

        const customerId = invoice.customer as string

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          // Reset monthly cost tracking at billing period start
          await supabase
            .from('workspaces')
            .update({
              api_cost_this_month: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('organization_id', (org as { id: string }).id)

          // Log the payment event
          console.log(
            `[Billing] Invoice paid for org ${(org as { id: string }).id}: $${(invoice.amount_paid / 100).toFixed(2)}`
          )
        }
        break
      }

      // --------------------------------------------------------
      // Invoice payment failed
      // --------------------------------------------------------
      case 'invoice.payment_failed': {
        const invoice = event.data.object as { customer: string }
        const customerId = invoice.customer as string

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          await supabase
            .from('organizations')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', (org as { id: string }).id)
        }
        break
      }

      // --------------------------------------------------------
      // Checkout session completed (new subscriber)
      // --------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as {
          customer: string;
          subscription: string | null;
          metadata: Record<string, string>;
        }

        const orgId = session.metadata?.organization_id
        const subscriptionId = session.subscription

        if (orgId && subscriptionId) {
          await supabase
            .from('organizations')
            .update({
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId)
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error processing event ${event.type}:`, err)
    return NextResponse.json(
      { error: `Failed to process webhook: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
