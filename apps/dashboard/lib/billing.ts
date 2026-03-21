// ============================================================
// Agent OS — Stripe Billing Helpers
// ============================================================

import Stripe from 'stripe'
import type { Organization, Plan, PlanTier } from '@/lib/types'

// ============================================================
// Stripe client (singleton)
// ============================================================

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable')
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    })
  }
  return stripeClient
}

// ============================================================
// Plan → Stripe price ID mapping
// ============================================================

export interface PlanPriceConfig {
  monthly: string | null
  yearly: string | null
}

export function getPlanPriceIds(tier: PlanTier): PlanPriceConfig {
  switch (tier) {
    case 'free':
      return { monthly: null, yearly: null }
    case 'starter':
      return {
        monthly: process.env.STRIPE_STARTER_PRICE_ID ?? null,
        yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID ?? null,
      }
    case 'pro':
      return {
        monthly: process.env.STRIPE_PRO_PRICE_ID ?? null,
        yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? null,
      }
    case 'enterprise':
      return {
        monthly: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
        yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID ?? null,
      }
  }
}

// ============================================================
// Create a Stripe customer for a new organization
// ============================================================

export async function createStripeCustomer(
  org: Pick<Organization, 'id' | 'name' | 'billing_email'>
): Promise<Stripe.Customer> {
  const stripe = getStripe()
  return stripe.customers.create({
    name: org.name,
    email: org.billing_email ?? undefined,
    metadata: {
      organization_id: org.id,
    },
  })
}

// ============================================================
// Create a checkout session for plan upgrade
// ============================================================

export interface CreateCheckoutSessionParams {
  organization: Organization
  plan: Plan
  billingCycle: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const { organization, plan, billingCycle, successUrl, cancelUrl } = params

  const priceIds = getPlanPriceIds(plan.tier)
  const priceId = billingCycle === 'monthly' ? priceIds.monthly : priceIds.yearly

  if (!priceId) {
    throw new Error(`No Stripe price ID configured for ${plan.tier} (${billingCycle})`)
  }

  if (!organization.stripe_customer_id) {
    throw new Error('Organization does not have a Stripe customer ID')
  }

  return stripe.checkout.sessions.create({
    customer: organization.stripe_customer_id,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organization.id,
      plan_tier: plan.tier,
      billing_cycle: billingCycle,
    },
    subscription_data: {
      metadata: {
        organization_id: organization.id,
        plan_tier: plan.tier,
      },
    },
  })
}

// ============================================================
// Create a billing portal session for managing subscriptions
// ============================================================

export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
}

// ============================================================
// Cancel a subscription
// ============================================================

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  const stripe = getStripe()

  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }

  // Cancel at period end
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

// ============================================================
// Retrieve a subscription
// ============================================================

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe()
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  })
}

// ============================================================
// Get upcoming invoice
// ============================================================

export async function getUpcomingInvoice(
  customerId: string
): Promise<Stripe.UpcomingInvoice | null> {
  const stripe = getStripe()
  try {
    return await stripe.invoices.retrieveUpcoming({
      customer: customerId,
    })
  } catch {
    return null
  }
}

// ============================================================
// List invoices for a customer
// ============================================================

export async function listInvoices(
  customerId: string,
  limit = 10
): Promise<Stripe.Invoice[]> {
  const stripe = getStripe()
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  })
  return invoices.data
}

// ============================================================
// Stripe webhook signature verification
// ============================================================

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
  }
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

// ============================================================
// Map Stripe subscription status to our type
// ============================================================

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): Organization['subscription_status'] {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
      return 'unpaid'
    default:
      return null
  }
}

// ============================================================
// Calculate usage-based billing amount
// ============================================================

export interface UsageBillingCalculation {
  base_amount_cents: number
  usage_amount_cents: number
  total_amount_cents: number
  breakdown: {
    tokens_used: number
    tokens_included: number
    tokens_overage: number
    overage_rate_per_million: number
    compute_hours_used: number
    compute_hours_included: number
    compute_hours_overage: number
    compute_overage_rate_per_hour: number
  }
}

export function calculateUsageBilling(
  plan: Plan,
  tokensUsed: number,
  computeHoursUsed: number
): UsageBillingCalculation {
  const tokensIncluded = plan.token_budget_millions * 1_000_000
  const computeHoursIncluded = plan.compute_hours_included

  const tokensOverage = Math.max(0, tokensUsed - tokensIncluded)
  const computeOverage = Math.max(0, computeHoursUsed - computeHoursIncluded)

  // Overage rates (cents per unit)
  const tokenOverageRatePerMillion = 200   // $2.00 per million tokens overage
  const computeOverageRatePerHour = 50     // $0.50 per compute hour overage

  const tokenOverageCents = Math.ceil((tokensOverage / 1_000_000) * tokenOverageRatePerMillion)
  const computeOverageCents = Math.ceil(computeOverage * computeOverageRatePerHour)

  const baseAmountCents = Math.round(plan.price_monthly * 100)
  const usageAmountCents = tokenOverageCents + computeOverageCents

  return {
    base_amount_cents: baseAmountCents,
    usage_amount_cents: usageAmountCents,
    total_amount_cents: baseAmountCents + usageAmountCents,
    breakdown: {
      tokens_used: tokensUsed,
      tokens_included: tokensIncluded,
      tokens_overage: tokensOverage,
      overage_rate_per_million: tokenOverageRatePerMillion / 100,
      compute_hours_used: computeHoursUsed,
      compute_hours_included: computeHoursIncluded,
      compute_hours_overage: computeOverage,
      compute_overage_rate_per_hour: computeOverageRatePerHour / 100,
    },
  }
}
