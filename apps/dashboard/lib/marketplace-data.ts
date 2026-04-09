// apps/dashboard/lib/marketplace-data.ts

import { MarketplaceItem } from './marketplace-types';

export const marketplaceItems: MarketplaceItem[] = [
  // ── Agent Templates (4) ──────────────────────────────────
  {
    id: 'agent-marketing-manager',
    name: 'Marketing Manager Agent',
    description:
      'Autonomous marketing team that plans campaigns, generates copy, schedules posts, and reports performance across channels.',
    longDescription:
      'A full-stack marketing agent team that handles campaign planning, copywriting, A/B test design, social media scheduling, email drip sequences, and weekly performance reporting. Connects to Meta Ads, Google Ads, Mailchimp, and your CMS. Includes a strategist agent, a copywriter agent, and an analytics agent working in concert.',
    category: 'agent-template',
    tags: ['marketing', 'campaigns', 'social-media', 'email', 'analytics'],
    author: 'SpaceAgent Labs',
    version: '2.1.0',
    rating: 4.8,
    installCount: 3420,
    pricing: { type: 'paid', amount: 29, currency: 'USD', interval: 'monthly' },
    icon: '📣',
    tier: 'pro',
  },
  {
    id: 'agent-customer-support',
    name: 'Customer Support Agent (ES/EN)',
    description:
      'Bilingual support agent that triages tickets, resolves FAQs, escalates edge cases, and maintains a knowledge base.',
    longDescription:
      'Handles inbound support across email, chat, and WhatsApp in both Spanish and English. Automatically classifies ticket urgency, resolves common questions from your knowledge base, drafts responses for human review on complex issues, and tracks CSAT. Integrates with Zendesk, Freshdesk, or Intercom.',
    category: 'agent-template',
    tags: ['support', 'bilingual', 'spanish', 'english', 'tickets', 'zendesk'],
    author: 'SpaceAgent Labs',
    version: '1.8.0',
    rating: 4.6,
    installCount: 2850,
    pricing: { type: 'paid', amount: 19, currency: 'USD', interval: 'monthly' },
    icon: '🎧',
    tier: 'starter',
  },
  {
    id: 'agent-bookkeeper',
    name: 'Bookkeeper Agent (SAT/CFDI)',
    description:
      'Automated bookkeeping for Mexican businesses — reconciles invoices, generates CFDI XMLs, and prepares SAT filings.',
    longDescription:
      'Purpose-built for Mexican tax compliance. Ingests bank statements and invoices, reconciles transactions, generates CFDI 4.0 XML files, calculates ISR/IVA, and prepares monthly SAT declarations. Supports both Persona Física and Persona Moral regimes. Connects to CONTPAQi, Aspel, and major Mexican banks.',
    category: 'agent-template',
    tags: ['bookkeeping', 'sat', 'cfdi', 'mexico', 'tax', 'invoicing'],
    author: 'FinTech MX',
    version: '3.0.1',
    rating: 4.9,
    installCount: 1780,
    pricing: { type: 'paid', amount: 39, currency: 'USD', interval: 'monthly' },
    icon: '📊',
    tier: 'pro',
  },
  {
    id: 'agent-sales-dev',
    name: 'Sales Development Agent',
    description:
      'Prospect researcher and outbound sequencer that finds leads, enriches contacts, and runs personalized email cadences.',
    longDescription:
      'Combines lead sourcing from Apollo/LinkedIn, contact enrichment, ICP scoring, and multi-step email outreach. The agent researches each prospect, crafts personalized openers, handles replies, and books meetings on your calendar. Includes objection handling playbooks and CRM logging.',
    category: 'agent-template',
    tags: ['sales', 'outbound', 'prospecting', 'email', 'crm', 'leads'],
    author: 'SpaceAgent Labs',
    version: '2.4.0',
    rating: 4.7,
    installCount: 4100,
    pricing: { type: 'paid', amount: 24, currency: 'USD', interval: 'monthly' },
    icon: '🚀',
    tier: 'starter',
  },

  // ── Skills (3) ───────────────────────────────────────────
  {
    id: 'skill-social-content',
    name: 'Social Media Content Generator',
    description:
      'Generates platform-optimized posts for Instagram, Twitter/X, LinkedIn, and TikTok from a single brief.',
    longDescription:
      'Feed it a topic, brand voice guide, and target platform — get back ready-to-post content with hashtags, optimal posting times, and image prompts. Supports carousel scripts, thread formats, short-form video scripts, and LinkedIn articles. Learns your brand voice over time.',
    category: 'skill',
    tags: ['social-media', 'content', 'copywriting', 'instagram', 'linkedin'],
    author: 'ContentCraft',
    version: '1.5.0',
    rating: 4.4,
    installCount: 5200,
    pricing: { type: 'free' },
    icon: '✍️',
    tier: 'free',
  },
  {
    id: 'skill-lead-enrichment',
    name: 'Lead Enrichment Engine',
    description:
      'Enriches raw lead lists with company data, social profiles, tech stack, funding info, and ICP scores.',
    longDescription:
      'Upload a CSV of company names or domains and get back enriched records with employee count, revenue range, tech stack (via BuiltWith), recent funding rounds, social profiles, and a custom ICP fit score. Deduplicates and validates email addresses. Outputs to CSV or direct CRM push.',
    category: 'skill',
    tags: ['enrichment', 'leads', 'data', 'crm', 'sales'],
    author: 'DataForge',
    version: '2.0.0',
    rating: 4.5,
    installCount: 3100,
    pricing: { type: 'paid', amount: 9, currency: 'USD', interval: 'monthly' },
    icon: '🔍',
    tier: 'starter',
  },
  {
    id: 'skill-invoice-gen',
    name: 'Invoice Generator',
    description:
      'Creates professional PDF invoices from structured data with multi-currency support and payment tracking.',
    longDescription:
      'Generates branded PDF invoices from order data or manual input. Supports multi-currency, tax calculations (VAT/IVA/GST), line item discounts, payment terms, and recurring invoice schedules. Tracks payment status and sends reminders. Integrates with Stripe, PayPal, and bank transfer workflows.',
    category: 'skill',
    tags: ['invoicing', 'pdf', 'billing', 'payments', 'finance'],
    author: 'SpaceAgent Labs',
    version: '1.2.0',
    rating: 4.3,
    installCount: 2400,
    pricing: { type: 'free' },
    icon: '🧾',
    tier: 'free',
  },

  // ── Playwright Scripts (3) ───────────────────────────────
  {
    id: 'pw-competitor-pricing',
    name: 'Competitor Pricing Scraper',
    description:
      'Monitors competitor product pages and extracts pricing changes into a structured feed with diff alerts.',
    longDescription:
      'Configurable Playwright script that navigates competitor product/pricing pages on a schedule, extracts current prices, detects changes, and logs everything to a Google Sheet or webhook. Handles dynamic JS-rendered pages, pagination, and anti-bot challenges with stealth mode. Sends Slack/email alerts on price changes.',
    category: 'playwright-script',
    tags: ['scraping', 'pricing', 'competitor', 'monitoring', 'alerts'],
    author: 'ScrapeOps',
    version: '1.1.0',
    rating: 4.2,
    installCount: 1850,
    pricing: { type: 'paid', amount: 14, currency: 'USD', interval: 'one-time' },
    icon: '🕵️',
    tier: 'starter',
  },
  {
    id: 'pw-social-poster',
    name: 'Social Media Auto-Poster',
    description:
      'Automates posting to social platforms that lack API access using browser automation with human-like behavior.',
    longDescription:
      'Posts content to platforms without public APIs by automating the browser with realistic human-like delays, mouse movements, and interaction patterns. Supports scheduled posting, image/video uploads, and hashtag insertion. Includes session persistence so you don\'t need to re-login each run.',
    category: 'playwright-script',
    tags: ['social-media', 'automation', 'posting', 'browser'],
    author: 'AutoPost',
    version: '2.0.0',
    rating: 4.0,
    installCount: 2200,
    pricing: { type: 'paid', amount: 19, currency: 'USD', interval: 'one-time' },
    icon: '📱',
    tier: 'starter',
  },
  {
    id: 'pw-review-monitor',
    name: 'Review Site Monitor',
    description:
      'Tracks new reviews across Google Business, Trustpilot, and G2 — alerts on negative sentiment in real time.',
    longDescription:
      'Continuously monitors your business profiles on major review platforms. Extracts new reviews, runs sentiment analysis, and sends instant alerts for negative reviews so you can respond quickly. Aggregates review data into a dashboard with trend charts and average rating tracking over time.',
    category: 'playwright-script',
    tags: ['reviews', 'monitoring', 'sentiment', 'reputation', 'alerts'],
    author: 'RepWatch',
    version: '1.3.0',
    rating: 4.1,
    installCount: 980,
    pricing: { type: 'free' },
    icon: '⭐',
    tier: 'free',
  },

  // ── MCP Integrations (2) ─────────────────────────────────
  {
    id: 'mcp-whatsapp-business',
    name: 'WhatsApp Business Integration',
    description:
      'Two-way WhatsApp Business API connector for sending templates, receiving messages, and managing conversations.',
    longDescription:
      'Full MCP integration with the WhatsApp Business API (Cloud API). Send template messages, receive and process inbound messages, manage conversation threads, handle media attachments, and track delivery/read receipts. Includes webhook handler for real-time message processing and conversation routing to agents.',
    category: 'mcp-integration',
    tags: ['whatsapp', 'messaging', 'chat', 'api', 'communication'],
    author: 'SpaceAgent Labs',
    version: '1.6.0',
    rating: 4.7,
    installCount: 3800,
    pricing: { type: 'paid', amount: 15, currency: 'USD', interval: 'monthly' },
    icon: '💬',
    tier: 'starter',
  },
  {
    id: 'mcp-shopify',
    name: 'Shopify Connector',
    description:
      'Reads and manages Shopify store data — products, orders, customers, inventory, and fulfillment status.',
    longDescription:
      'Complete MCP bridge to the Shopify Admin API. Query products, variants, and collections; read and update orders; manage customer records; track inventory levels; and monitor fulfillment status. Supports bulk operations, webhook subscriptions for real-time updates, and metafield access for custom data.',
    category: 'mcp-integration',
    tags: ['shopify', 'ecommerce', 'orders', 'products', 'inventory'],
    author: 'CommerceHub',
    version: '2.2.0',
    rating: 4.6,
    installCount: 2950,
    pricing: { type: 'paid', amount: 12, currency: 'USD', interval: 'monthly' },
    icon: '🛍️',
    tier: 'starter',
  },

  // ── n8n Workflows (2) ────────────────────────────────────
  {
    id: 'wf-lead-capture',
    name: 'Lead Capture Funnel',
    description:
      'End-to-end lead capture: form submission → enrichment → CRM entry → Slack notification → drip sequence.',
    longDescription:
      'n8n workflow that triggers on form submission (Typeform, Tally, or webhook), enriches the lead with company data, creates a CRM record in HubSpot or Pipedrive, notifies your sales channel in Slack with a rich card, and enrolls the lead in an email drip sequence. Includes deduplication logic and lead scoring.',
    category: 'workflow',
    tags: ['leads', 'crm', 'automation', 'forms', 'email', 'slack'],
    author: 'FlowOps',
    version: '1.4.0',
    rating: 4.5,
    installCount: 2100,
    pricing: { type: 'free' },
    icon: '🔄',
    tier: 'free',
  },
  {
    id: 'wf-customer-onboarding',
    name: 'Customer Onboarding Flow',
    description:
      'Automated onboarding sequence: welcome email → account setup → training schedule → 30-day check-in.',
    longDescription:
      'n8n workflow that orchestrates new customer onboarding. Triggers on deal-closed in CRM, sends a branded welcome email, provisions account access, schedules training sessions, assigns a CSM, creates onboarding tasks in your project tracker, and sends automated check-ins at day 7, 14, and 30. Tracks completion percentage per customer.',
    category: 'workflow',
    tags: ['onboarding', 'customers', 'automation', 'email', 'crm'],
    author: 'SpaceAgent Labs',
    version: '1.1.0',
    rating: 4.4,
    installCount: 1650,
    pricing: { type: 'paid', amount: 9, currency: 'USD', interval: 'one-time' },
    icon: '🎯',
    tier: 'starter',
  },

  // ── GitHub Action (1) ────────────────────────────────────
  {
    id: 'gh-auto-deploy',
    name: 'Auto-Deploy on Merge',
    description:
      'GitHub Action that builds, tests, and deploys your app on merge to main with rollback on failure.',
    longDescription:
      'Composite GitHub Action that triggers on merge to main/master. Runs your test suite, builds the project, deploys to your configured target (Vercel, Railway, AWS, or Docker registry), runs smoke tests against the deployment, and automatically rolls back if smoke tests fail. Includes Slack notifications for deploy status and a deployment log.',
    category: 'github-action',
    tags: ['ci-cd', 'deployment', 'github', 'automation', 'devops'],
    author: 'DevOps Pro',
    version: '3.1.0',
    rating: 4.8,
    installCount: 5600,
    pricing: { type: 'free' },
    icon: '⚡',
    tier: 'free',
  },
];
