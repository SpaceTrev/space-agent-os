// ============================================================
// Automation Marketplace — Seed Data
// ============================================================

import type { MarketplaceItem, AgentTemplate } from './marketplace-types'

export const MARKETPLACE_ITEMS: (MarketplaceItem | AgentTemplate)[] = [
  // ── Agent Templates ────────────────────────────────────────
  {
    id: 'agent-marketing-manager',
    name: 'Marketing Manager',
    description:
      'Full-stack marketing agent that manages social channels, writes content, runs campaigns, and reports on performance.',
    longDescription:
      'The Marketing Manager agent is a senior-level AI that owns your entire content and campaign pipeline. It drafts social posts, schedules them across platforms, monitors engagement metrics, identifies top-performing content patterns, and generates weekly performance reports. Preconfigured with brand voice guidelines and campaign calendar awareness.',
    category: 'agent-template',
    persona:
      'You are a senior marketing manager with 10+ years of experience in B2B SaaS. You are data-driven, creative, and obsessed with conversion metrics. You write in a professional but approachable tone.',
    includedSkills: [
      'social-content-generator',
      'campaign-planner',
      'performance-reporter',
      'seo-keyword-researcher',
    ],
    includedTools: ['gmail', 'google-analytics', 'buffer', 'canva', 'notion'],
    brainContext: ['marketing/brand-guidelines', 'marketing/campaign-calendar', 'marketing/competitor-research'],
    tier: 'primary',
    tags: ['marketing', 'social-media', 'content', 'campaigns', 'analytics'],
    author: 'Space Agent OS',
    version: '1.2.0',
    rating: 4.8,
    installCount: 2341,
    pricing: { model: 'free' },
    icon: '📣',
    includedComponents: [
      'Social content generator skill',
      'Campaign planner skill',
      'Performance reporter skill',
      'SEO keyword researcher skill',
      'Gmail, Google Analytics, Buffer, Canva integrations',
      'Brand guidelines brain context',
    ],
    requirements: ['Anthropic API key', 'Google Analytics access', 'Buffer account'],
  } satisfies AgentTemplate,

  {
    id: 'agent-customer-support-bilingual',
    name: 'Customer Support (Bilingual ES/EN)',
    description:
      'Handles support tickets in Spanish and English. Drafts replies, escalates edge cases, and keeps CSAT scores high.',
    longDescription:
      'A bilingual Customer Support agent fluent in both Spanish and English. It triages incoming tickets, drafts empathetic replies following your brand tone, escalates complex technical issues to the right team members, and tracks resolution metrics. Trained on your product documentation and common support patterns.',
    category: 'agent-template',
    persona:
      'Eres un agente de soporte al cliente empático, profesional y eficiente. You switch seamlessly between Spanish and English based on the customer\'s language. You prioritize customer satisfaction and swift resolution.',
    includedSkills: ['ticket-triager', 'reply-drafter', 'escalation-router', 'csat-tracker'],
    includedTools: ['zendesk', 'intercom', 'notion', 'slack'],
    brainContext: ['support/product-docs', 'support/faq', 'support/escalation-matrix'],
    tier: 'primary',
    tags: ['customer-support', 'bilingual', 'spanish', 'zendesk', 'tickets', 'csat'],
    author: 'Space Agent OS',
    version: '2.0.1',
    rating: 4.9,
    installCount: 3891,
    pricing: { model: 'free' },
    icon: '🎧',
    includedComponents: [
      'Ticket triage skill',
      'Bilingual reply drafter skill',
      'Escalation router skill',
      'Zendesk + Intercom integration',
      'Product docs brain context',
    ],
    requirements: ['Anthropic API key', 'Zendesk or Intercom account'],
  } satisfies AgentTemplate,

  {
    id: 'agent-bookkeeper-sat-cfdi',
    name: 'Bookkeeper (SAT / CFDI)',
    description:
      'Mexican tax-compliant bookkeeper. Processes CFDI invoices, reconciles accounts, and generates SAT-ready reports.',
    longDescription:
      'A specialized bookkeeper agent designed for Mexican businesses operating under SAT regulations. It ingests CFDI XML files, categorizes expenses, reconciles bank statements, flags VAT discrepancies, and produces monthly financial summaries ready for your contador. Supports RFC validation and complemento de pago tracking.',
    category: 'agent-template',
    persona:
      'Eres un contador público certificado con especialidad en cumplimiento fiscal mexicano (SAT, CFDI 4.0, IVA, ISR). Eres meticuloso, preciso y conoces a fondo el Código Fiscal de la Federación.',
    includedSkills: ['cfdi-parser', 'bank-reconciler', 'tax-categorizer', 'sat-report-generator'],
    includedTools: ['sat-portal', 'quickbooks', 'google-sheets', 'gmail'],
    brainContext: ['finance/chart-of-accounts', 'finance/sat-guidelines', 'finance/vendor-list'],
    tier: 'secondary',
    tags: ['accounting', 'mexico', 'sat', 'cfdi', 'tax', 'bookkeeping', 'iva'],
    author: 'Space Agent OS',
    version: '1.0.3',
    rating: 4.7,
    installCount: 1204,
    pricing: { model: 'subscription', price: 2900, interval: 'month' },
    icon: '📒',
    includedComponents: [
      'CFDI 4.0 XML parser skill',
      'Bank reconciliation skill',
      'SAT tax categorizer skill',
      'Monthly SAT report generator',
      'RFC validator',
    ],
    requirements: ['Google Gemini API key', 'SAT portal credentials', 'QuickBooks account (optional)'],
  } satisfies AgentTemplate,

  {
    id: 'agent-sdr-sales-development',
    name: 'Sales Development Rep (SDR)',
    description:
      'Prospecting and outreach agent. Enriches leads, writes personalized cold emails, tracks replies, and books meetings.',
    longDescription:
      'An AI SDR that works your pipeline around the clock. It pulls leads from your CRM, enriches them with company and contact data, writes hyper-personalized cold emails, sends follow-up sequences, monitors for replies, and automatically books discovery calls on your calendar. Built-in A/B testing for subject lines.',
    category: 'agent-template',
    persona:
      'You are an elite SDR with a 35% reply rate. You write emails that feel personal, not automated. You lead with value, not features. You are persistent but never pushy.',
    includedSkills: ['lead-enricher', 'email-writer', 'sequence-manager', 'meeting-booker'],
    includedTools: ['apollo', 'hubspot', 'gmail', 'cal-com', 'slack'],
    brainContext: ['sales/icp-profile', 'sales/email-templates', 'sales/objection-handling'],
    tier: 'primary',
    tags: ['sales', 'outreach', 'lead-gen', 'cold-email', 'crm', 'sdr'],
    author: 'Space Agent OS',
    version: '1.4.2',
    rating: 4.6,
    installCount: 5120,
    pricing: { model: 'subscription', price: 4900, interval: 'month' },
    icon: '📬',
    includedComponents: [
      'Lead enrichment skill',
      'Personalized email writer skill',
      'Multi-step sequence manager',
      'Calendar booking integration',
      'A/B subject line tester',
    ],
    requirements: ['Anthropic API key', 'Apollo.io or HubSpot', 'Gmail + Cal.com'],
  } satisfies AgentTemplate,

  // ── Skills ─────────────────────────────────────────────────
  {
    id: 'skill-social-content-generator',
    name: 'Social Media Content Generator',
    description:
      'Generates platform-optimized posts for Twitter/X, LinkedIn, and Instagram from a single brief.',
    longDescription:
      'Give this skill a topic, tone, and target audience — it outputs ready-to-publish posts for Twitter/X (thread format supported), LinkedIn (professional long-form), and Instagram (caption + hashtag suggestions). Trained on high-performing content patterns across B2B and B2C verticals.',
    category: 'skill',
    tags: ['social-media', 'content', 'twitter', 'linkedin', 'instagram', 'copywriting'],
    author: 'Space Agent OS',
    version: '1.1.0',
    rating: 4.7,
    installCount: 8934,
    pricing: { model: 'free' },
    icon: '✍️',
    includedComponents: [
      'Twitter/X thread generator',
      'LinkedIn post writer',
      'Instagram caption + hashtag generator',
      'Tone adapter (professional / casual / bold)',
    ],
    requirements: ['Any LLM provider configured'],
  },

  {
    id: 'skill-lead-enrichment',
    name: 'Lead Enrichment',
    description:
      'Enriches contact records with company data, tech stack, LinkedIn profile, and intent signals.',
    longDescription:
      'Drop in an email address or company domain and this skill returns a fully enriched contact record: company size, industry, tech stack (via BuiltWith), LinkedIn profile URL, funding status, estimated ARR, and recent news mentions. Output is structured JSON ready to push to your CRM.',
    category: 'skill',
    tags: ['sales', 'lead-gen', 'enrichment', 'crm', 'data', 'prospecting'],
    author: 'Space Agent OS',
    version: '2.1.0',
    rating: 4.5,
    installCount: 6203,
    pricing: { model: 'one-time', price: 1900 },
    icon: '🔍',
    includedComponents: [
      'Company data lookup',
      'Tech stack detector',
      'LinkedIn profile resolver',
      'Funding & revenue estimator',
      'Recent news fetcher',
    ],
    requirements: ['Apollo.io API key or Clearbit API key'],
  },

  {
    id: 'skill-invoice-generator',
    name: 'Invoice Generator (PDF)',
    description: 'Generates professional PDF invoices from structured data. Supports multi-currency and tax.',
    longDescription:
      'Pass invoice data (client info, line items, tax rates, currency) and receive a beautifully formatted PDF invoice. Supports USD, MXN, EUR, GBP. Handles multiple tax types (IVA, VAT, GST). Outputs to Google Drive or S3. Optional CFDI XML generation for Mexican businesses.',
    category: 'skill',
    tags: ['invoicing', 'pdf', 'billing', 'finance', 'multi-currency'],
    author: 'Community',
    version: '1.0.5',
    rating: 4.4,
    installCount: 3421,
    pricing: { model: 'free' },
    icon: '🧾',
    includedComponents: [
      'PDF template engine',
      'Multi-currency formatter',
      'Tax calculator (IVA / VAT / GST)',
      'Google Drive + S3 uploader',
      'CFDI XML generator (MX)',
    ],
    requirements: ['Google Drive or AWS S3 credentials'],
  },

  // ── Playwright Scripts ──────────────────────────────────────
  {
    id: 'playwright-competitor-pricing',
    name: 'Competitor Pricing Scraper',
    description:
      'Scrapes pricing pages of up to 10 competitors daily and surfaces changes in a Slack digest.',
    longDescription:
      'Configure a list of competitor URLs and pricing selectors. This Playwright script runs on a schedule, extracts current pricing tiers and feature lists, compares against the previous snapshot, and posts a structured diff to your Slack channel. Detects plan additions, removals, and price changes.',
    category: 'playwright-script',
    tags: ['competitor-intel', 'pricing', 'scraping', 'slack', 'monitoring'],
    author: 'Space Agent OS',
    version: '1.0.2',
    rating: 4.6,
    installCount: 1892,
    pricing: { model: 'free' },
    icon: '🕵️',
    includedComponents: [
      'Playwright scraper engine',
      'Pricing diff detector',
      'Slack notification formatter',
      'Snapshot storage (JSON)',
    ],
    requirements: ['Node.js 18+', 'Playwright installed', 'Slack webhook URL'],
  },

  {
    id: 'playwright-social-auto-post',
    name: 'Auto-Post to Social Media',
    description:
      'Automatically publishes scheduled posts to Twitter/X and LinkedIn via browser automation.',
    longDescription:
      'A Playwright-powered script that reads from a Google Sheets content calendar and publishes posts at scheduled times. Handles image attachments, thread creation on X, and multi-image carousels on LinkedIn. Falls back to Buffer API when available.',
    category: 'playwright-script',
    tags: ['social-media', 'automation', 'twitter', 'linkedin', 'scheduling'],
    author: 'Community',
    version: '2.3.1',
    rating: 4.3,
    installCount: 4102,
    pricing: { model: 'free' },
    icon: '📅',
    includedComponents: [
      'Google Sheets content calendar reader',
      'Twitter/X post + thread publisher',
      'LinkedIn post publisher',
      'Image upload handler',
    ],
    requirements: ['Node.js 18+', 'Playwright', 'Google Sheets API', 'Social media credentials'],
  },

  {
    id: 'playwright-review-monitor',
    name: 'Review Monitor',
    description:
      'Monitors Google Reviews and Yelp for new reviews. Sends alerts and drafts response suggestions.',
    longDescription:
      'Checks your Google Business Profile and Yelp listing daily for new reviews. For each new review, it generates a suggested response (personalized, not templated) using your brand voice guidelines and sends it via email or Slack for human approval before posting.',
    category: 'playwright-script',
    tags: ['reputation', 'reviews', 'google', 'yelp', 'monitoring', 'local-seo'],
    author: 'Space Agent OS',
    version: '1.1.4',
    rating: 4.5,
    installCount: 2744,
    pricing: { model: 'one-time', price: 4900 },
    icon: '⭐',
    includedComponents: [
      'Google Reviews scraper',
      'Yelp reviews scraper',
      'AI response drafter',
      'Slack / email alerter',
      'Review sentiment analyzer',
    ],
    requirements: ['Node.js 18+', 'Playwright', 'Google Business Profile access', 'Anthropic API key'],
  },

  // ── MCP Integrations ────────────────────────────────────────
  {
    id: 'mcp-whatsapp-business',
    name: 'WhatsApp Business MCP',
    description:
      'MCP server that gives agents full access to WhatsApp Business API: send messages, media, templates.',
    longDescription:
      'Expose WhatsApp Business Cloud API as MCP tools. Agents can send text messages, images, documents, and template messages to individual contacts or broadcasts. Includes incoming message webhook listener with real-time delivery to agent context. Supports multiple WA Business accounts.',
    category: 'mcp-integration',
    tags: ['whatsapp', 'messaging', 'mcp', 'api', 'notifications', 'customer-comms'],
    author: 'Space Agent OS',
    version: '1.0.0',
    rating: 4.8,
    installCount: 3201,
    pricing: { model: 'free' },
    icon: '💬',
    includedComponents: [
      'send_message tool',
      'send_media tool',
      'send_template tool',
      'list_conversations tool',
      'Webhook listener for incoming messages',
    ],
    requirements: ['WhatsApp Business Cloud API access', 'Meta Developer account', 'Node.js 18+'],
  },

  {
    id: 'mcp-shopify',
    name: 'Shopify MCP',
    description:
      'Full Shopify Admin API access via MCP. Manage products, orders, inventory, and customers from agents.',
    longDescription:
      'A comprehensive MCP server wrapping the Shopify Admin GraphQL API. Gives agents the ability to query and mutate products, variants, orders, customers, discounts, and inventory levels. Supports both REST and GraphQL endpoints. Handles pagination and rate limiting automatically.',
    category: 'mcp-integration',
    tags: ['shopify', 'ecommerce', 'mcp', 'products', 'orders', 'inventory'],
    author: 'Community',
    version: '2.0.0',
    rating: 4.6,
    installCount: 5890,
    pricing: { model: 'free' },
    icon: '🛍️',
    includedComponents: [
      'list_products / get_product tools',
      'list_orders / get_order tools',
      'update_inventory tool',
      'get_customer / update_customer tools',
      'create_discount tool',
    ],
    requirements: ['Shopify store with Admin API access', 'Private app or custom app credentials'],
  },

  // ── n8n Workflows ───────────────────────────────────────────
  {
    id: 'workflow-lead-capture-funnel',
    name: 'Lead Capture Funnel',
    description:
      'End-to-end n8n workflow: form submission → enrichment → CRM entry → welcome email sequence.',
    longDescription:
      'A complete lead capture automation built in n8n. When a lead fills out your Typeform/Webflow form, the workflow enriches the contact, creates a CRM record in HubSpot, assigns it to the right sales rep based on ICP scoring, and triggers a personalized 5-email welcome sequence via SendGrid. Includes Slack notification for high-score leads.',
    category: 'workflow',
    tags: ['lead-gen', 'n8n', 'crm', 'email', 'hubspot', 'typeform', 'automation'],
    author: 'Space Agent OS',
    version: '1.3.0',
    rating: 4.7,
    installCount: 7231,
    pricing: { model: 'free' },
    icon: '🔀',
    includedComponents: [
      'Typeform / Webflow form trigger',
      'Lead enrichment step',
      'HubSpot CRM entry creator',
      'ICP scoring model',
      '5-email welcome sequence (SendGrid)',
      'Slack alert for hot leads',
    ],
    requirements: ['n8n instance (self-hosted or cloud)', 'HubSpot API key', 'SendGrid API key'],
  },

  {
    id: 'workflow-customer-onboarding',
    name: 'Customer Onboarding Sequence',
    description:
      'Automates the first 30 days of customer onboarding: emails, check-ins, health scores, and Slack alerts.',
    longDescription:
      'A battle-tested 30-day onboarding automation. Triggered on new customer creation in Stripe or HubSpot, it sends a time-cadenced sequence of onboarding emails, schedules automated check-in tasks for the CSM, tracks product activation milestones, computes a health score, and escalates at-risk customers to the CS team in Slack.',
    category: 'workflow',
    tags: ['onboarding', 'customer-success', 'n8n', 'email', 'stripe', 'health-score'],
    author: 'Space Agent OS',
    version: '2.1.0',
    rating: 4.8,
    installCount: 4512,
    pricing: { model: 'subscription', price: 1900, interval: 'month' },
    icon: '🚀',
    includedComponents: [
      'Stripe / HubSpot new customer trigger',
      '30-day email cadence (8 emails)',
      'Activation milestone tracker',
      'Health score calculator',
      'At-risk escalation to Slack',
      'CSM task scheduler',
    ],
    requirements: ['n8n instance', 'Stripe or HubSpot', 'SendGrid or Postmark', 'Slack webhook'],
  },

  // ── GitHub Actions ──────────────────────────────────────────
  {
    id: 'github-action-auto-deploy',
    name: 'Auto-Deploy on Merge',
    description:
      'GitHub Action that deploys to Railway or Fly.io on merge to main, with rollback on failure.',
    longDescription:
      'A production-grade GitHub Actions workflow for zero-downtime deployments to Railway or Fly.io. On merge to main: runs tests, builds Docker image, pushes to registry, deploys to production, runs smoke tests, and auto-rolls back if smoke tests fail. Sends deployment status to Slack.',
    category: 'github-action',
    tags: ['ci-cd', 'github-actions', 'railway', 'fly-io', 'deployment', 'docker'],
    author: 'Space Agent OS',
    version: '1.2.0',
    rating: 4.9,
    installCount: 9834,
    pricing: { model: 'free' },
    icon: '⚙️',
    includedComponents: [
      'Test runner step',
      'Docker build + push step',
      'Railway / Fly.io deploy step',
      'Smoke test runner',
      'Auto-rollback on failure',
      'Slack deployment notifier',
    ],
    requirements: ['GitHub repository', 'Railway or Fly.io account', 'Docker registry'],
  },
]

// Lookup by ID
export function getMarketplaceItem(id: string): MarketplaceItem | AgentTemplate | undefined {
  return MARKETPLACE_ITEMS.find((item) => item.id === id)
}

// Filter by category
export function filterByCategory(
  items: (MarketplaceItem | AgentTemplate)[],
  categories: string[]
): (MarketplaceItem | AgentTemplate)[] {
  if (categories.includes('all')) return items
  return items.filter((item) => categories.includes(item.category))
}

// Search by name/description/tags
export function searchItems(
  items: (MarketplaceItem | AgentTemplate)[],
  query: string
): (MarketplaceItem | AgentTemplate)[] {
  if (!query.trim()) return items
  const q = query.toLowerCase()
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q)) ||
      item.category.includes(q)
  )
}
