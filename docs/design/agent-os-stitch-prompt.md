# Agent OS / FAM — Google Stitch Design Prompt

> **Product:** Agent OS — Flywheel Automation Marketplace (FAM)
> **Tagline:** "Your AI workforce, ready to work."
> **Design quality benchmark:** Vercel's precision meets Shopify's accessibility
> **Theme:** Dark space aesthetic, terminal-inspired, premium SaaS

---

## Global Design System

### Color Palette (Tailwind values)

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#09090B` (zinc-950) | Page backgrounds |
| `--bg-card` | `#111116` | Card surfaces, panels |
| `--bg-card-hover` | `#18181B` (zinc-900) | Card hover state |
| `--border-default` | `#1e1e24` | Card borders, dividers |
| `--border-hover` | `#27272A` (zinc-800) | Hover border state |
| `--border-focus` | `#6366f1` (indigo-500) | Focus rings, active borders |
| `--accent-primary` | `#6366f1` (indigo-500) | CTAs, primary buttons, links |
| `--accent-primary-hover` | `#818cf8` (indigo-400) | Button hover states |
| `--accent-secondary` | `#a78bfa` (violet-400) | Specialist tier badges, secondary highlights |
| `--text-primary` | `#F4F4F5` (zinc-100) | Headlines, primary text |
| `--text-secondary` | `#94A3B8` (slate-400) | Body text, descriptions |
| `--text-muted` | `#64748B` (slate-500) | Captions, timestamps |
| `--status-ok` | `#10B981` (emerald-500) | Online, success, completed |
| `--status-warning` | `#EAB308` (yellow-500) | Working, pending |
| `--status-error` | `#EF4444` (red-500) | Offline, failed, error |
| `--gradient-hero` | `indigo-400 → slate-200` | Hero headline gradient text |

### Typography

- **Headlines:** Inter (or system sans-serif), font-weight 700–800, tracking-tight
- **Body:** Inter, font-weight 400, leading-relaxed, text-slate-400
- **Monospace values:** JetBrains Mono or SF Mono for stats, token counts, timestamps, code
- **Scale:** text-xs (12px) → text-sm (14px) → text-base (16px) → text-lg (18px) → text-2xl (24px) → text-4xl (36px) → text-6xl (60px) for hero

### Spacing & Layout

- **Card border-radius:** rounded-2xl (1rem) for dashboard cards, rounded-3xl (1.5rem) for marketing cards
- **Badge border-radius:** rounded-full
- **Card padding:** p-6 (1.5rem) standard, p-8 (2rem) for feature cards
- **Grid gap:** gap-4 (1rem) for dense grids, gap-6 (1.5rem) for card grids, gap-8 (2rem) for sections
- **Section vertical spacing:** py-24 (6rem) for marketing sections, py-32 (8rem) for hero
- **Max content width:** max-w-7xl (80rem) centered with mx-auto px-6

### Effects & Motion

- Subtle noise texture overlay on page background at 3–5% opacity
- Cards: `transition-all duration-200 ease-out` on hover
- Card hover: translate-y by -2px, border brightens to slate-700, optional subtle indigo glow (`shadow-indigo-500/5`)
- Scroll animations: fade-in-up with 60px offset, stagger 100ms between items
- Status dots: 2px solid ring with subtle pulse animation for "active" state
- Gradient orbs in hero: large blurred indigo and violet circles at 10–15% opacity behind content

---

## PART 1: Marketing / Landing Site

Design a single-page, vertically scrolling marketing site. Dark, premium, high-information-density. Every section is full-width with max-w-7xl centered content. Sticky nav at top.

---

### 1.1 — Navigation Bar (sticky)

Fixed to viewport top. Background: `bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50`. Height: h-16.

**Left:** Agent OS logomark — a small geometric icon (stylized "A" formed by converging lines suggesting agents/nodes) in indigo-500, followed by "Agent OS" in text-lg font-bold text-zinc-100. Subtle "by FAM" in text-xs text-slate-500 beneath or beside.

**Center:** Nav links in text-sm font-medium text-slate-400 hover:text-zinc-100 — "Product", "Marketplace", "Pricing", "Mexico", "Docs"

**Right:** Language toggle pill (EN | ES) in a rounded-full border border-zinc-700 bg-zinc-900 pill, active language in text-white bg-indigo-500/20. Then "Sign In" text link in text-slate-300 hover:text-white. Then "Get Started" button: bg-indigo-500 hover:bg-indigo-400 text-white rounded-full px-5 py-2 text-sm font-semibold.

---

### 1.2 — Hero Section

**Layout:** Centered text, py-32 relative overflow-hidden.

**Background decoration:** Two large gradient orbs — one indigo-500/10 (600px diameter, top-left offset) and one violet-500/8 (500px, bottom-right offset) — blurred with blur-3xl. Faint grid pattern overlay (slate-800/20 lines, 40px spacing) fading to transparent at edges. Subtle neural network visualization: thin connecting lines between small dots scattered across the background at ~5% opacity, pulsing gently.

**"Now in Beta" badge** at the very top, centered: a small rounded-full pill with a pulsing emerald-500 dot (w-2 h-2), text "Now in Beta" in text-xs font-medium text-slate-300, border border-zinc-700 bg-zinc-900/50 px-4 py-1.5. Subtle glow animation on the dot.

**Headline:** Two lines, text-6xl md:text-7xl font-extrabold tracking-tight text-center.
Line 1: "Your AI workforce," in text-zinc-100.
Line 2: "ready to work." with a gradient text fill from indigo-400 to slate-200 (bg-gradient-to-r from-indigo-400 to-slate-200 bg-clip-text text-transparent).

**Subheadline:** Below headline, max-w-2xl mx-auto text-center, text-lg md:text-xl text-slate-400 leading-relaxed.
Text: "FAM is the all-in-one platform where AI agents collaborate, learn from every task, and get smarter over time. The flywheel that turns your busywork into a self-improving workforce."

**CTA row:** flex gap-4 justify-center mt-10.
Primary: "Get Started Free" — bg-indigo-500 hover:bg-indigo-400 text-white rounded-full px-8 py-3.5 text-base font-semibold, subtle shadow-lg shadow-indigo-500/25.
Secondary: "View Demo" — border border-zinc-700 hover:border-zinc-600 bg-transparent text-slate-300 hover:text-white rounded-full px-8 py-3.5 text-base font-semibold. Play icon (▶) inline before text.

**Below CTAs:** Small text-xs text-slate-500 centered: "No credit card required · Free forever tier · Setup in 2 minutes"

---

### 1.3 — The Problem Section

**Headline:** "You're juggling 15 AI tools that don't talk to each other." in text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Scattered subscriptions. Copy-paste workflows. Zero memory between sessions." in text-lg text-slate-400 text-center max-w-2xl mx-auto.

**Visual:** A full-width illustration/diagram showing:
- **Left side (chaos):** 12–15 small tool logo pills scattered at random angles and positions — ChatGPT, Claude, Perplexity, Notion, Slack, Figma, Linear, Midjourney, Cursor, GitHub Copilot, Zapier, Google Sheets, Airtable. Each in a small rounded-xl bg-zinc-900 border border-zinc-800 pill with the tool's icon/emoji and name. Connected by tangled, thin dashed lines in slate-700 suggesting messy integrations. Overall feeling: chaotic, overwhelming.
- **Center:** A large arrow or converging funnel shape, gradient from slate-600 to indigo-500, with the text "→ FAM →" or just a clean directional flow.
- **Right side (order):** A single clean card representing Agent OS Mission Control — a compact mockup showing a neat 3x3 agent grid, a sidebar, and a status bar. Glowing indigo border. Everything funneled into one clean surface. Label beneath: "One command center. Every tool connected."

---

### 1.4 — How It Works

**Section label:** Small pill badge "HOW IT WORKS" in text-xs font-semibold tracking-widest uppercase text-indigo-400, centered above headline.
**Headline:** "Three steps to your AI workforce" in text-4xl font-bold text-zinc-100 text-center.

**3-step horizontal layout** (stack vertically on mobile). Three columns with gap-8.

**Step 1: Browse the Marketplace**
- Large "01" in text-7xl font-extrabold text-zinc-800 (watermark style, behind content)
- Icon: Grid/storefront emoji or icon in indigo-500
- Title: "Browse the Marketplace" in text-xl font-bold text-zinc-100
- Description: "Pick pre-built agent teams, skills, and automations from our growing library. One click to install. Instantly ready." in text-sm text-slate-400
- Mini preview: A small 2x2 grid of dark marketplace cards (just outlines with emoji icons visible) suggesting the marketplace interface

**Step 2: Connect Your Tools**
- Large "02" watermark
- Icon: Plug/link emoji or icon in indigo-500
- Title: "Connect to your tools"
- Description: "MCPs wire your agents to Slack, GitHub, Notion, Google Workspace, Supabase, and 50+ more. Zero-code configuration." in text-sm text-slate-400
- Mini preview: A row of integration logo circles (Supabase, Vercel, GitHub, Slack, Notion, Google) connected by thin lines to a central Agent OS node

**Step 3: Watch Them Work**
- Large "03" watermark
- Icon: Rocket/sparkle emoji in indigo-500
- Title: "Watch them work"
- Description: "Dispatch tasks from your phone or desktop. Agents collaborate, use tools, and report back. You approve when needed." in text-sm text-slate-400
- Mini preview: A compact Mission Control preview showing agent status dots and an activity feed

**Connecting line:** A subtle horizontal dashed line in slate-800 connects the three steps across their tops (desktop only).

---

### 1.5 — Marketplace Preview

**Headline:** "The Marketplace" in text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Pre-built agents, skills, and automations. Install in one click." text-lg text-slate-400 text-center.

**Category tabs** centered above the grid: rounded-full pills in a flex row. "All" (active: bg-indigo-500/20 text-indigo-400 border-indigo-500/30), "Agent Teams", "Skills", "Automations", "Integrations" (inactive: text-slate-500 hover:text-slate-300 border-transparent).

**Card grid:** 3 columns on desktop (grid-cols-3), 1 on mobile. gap-4. Show 6 cards:

Each marketplace card:
- bg-[#111116] border border-[#1e1e24] rounded-2xl p-6 hover:border-slate-700 transition-all
- Top-left: Large emoji icon (text-3xl) on a bg-zinc-800/50 rounded-xl w-14 h-14 flex items-center justify-center
- Title: text-lg font-semibold text-zinc-100 mt-4
- Category badge: text-xs rounded-full px-2.5 py-0.5 inline-block. Colors vary: indigo for agent teams, violet for skills, emerald for automations, sky for integrations
- Description: text-sm text-slate-400 mt-2 line-clamp-2
- Footer row: flex justify-between items-center mt-4 pt-4 border-t border-zinc-800
  - Left: star icon + "4.8" in text-xs text-slate-500, and "1.2K installs" in text-xs text-slate-500
  - Right: price badge — "Free" in text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5, or "$9/mo" in text-xs text-indigo-400

**The 6 cards:**
1. 🏗️ "Full-Stack Dev Team" — Agent Teams — "Complete engineering squad: architect, frontend, backend, reviewer, and QA agents working in concert." — Free
2. 📊 "Marketing Autopilot" — Agent Teams — "Content calendar, SEO optimization, social scheduling, and analytics — fully automated." — $9/mo
3. 🧠 "Deep Research" — Skills — "Multi-source research with citation chains. Feed it a question, get a sourced report." — Free
4. 🔄 "Daily Standup Bot" — Automations — "Collects updates from your team's tools every morning. Posts summary to Slack." — Free
5. 🇲🇽 "Mexico Business Suite" — Agent Teams — "SAT compliance, CFDI invoicing, bilingual customer support, peso-optimized workflows." — $19/mo
6. 🔌 "Supabase Connector" — Integrations — "Full CRUD, real-time subscriptions, auth management, and edge function deployment." — Free

---

### 1.6 — Command Center Preview

**Layout:** Split — text on left (40%), preview mockup on right (60%).

**Left text block:**
- Section label pill: "MISSION CONTROL" in text-xs tracking-widest uppercase text-indigo-400
- Headline: "Your command center for the AI workforce" in text-3xl font-bold text-zinc-100
- Description: "See every agent's status, model allocation, brain vault contents, and activity — all in real time. Control everything from your phone or desktop." in text-base text-slate-400 leading-relaxed
- Three feature bullets (no bullet symbols — use small icons inline):
  - 🟢 "Real-time agent monitoring with status indicators"
  - 🧠 "Brain Vault: your company's knowledge, always in context"
  - ⚡ "Dispatch tasks with natural language from anywhere"
- CTA: "Explore Mission Control →" text link in text-indigo-400 hover:text-indigo-300 font-medium

**Right mockup:**
A perspective-tilted (slight 3D rotation, ~5° Y-axis) screenshot/mockup of the Mission Control dashboard (see Part 2, Screen 1 for exact contents). Surrounded by a rounded-2xl border border-zinc-800 bg-zinc-900 frame with a macOS-style title bar (three dots: red, yellow, green). Subtle shadow-2xl shadow-indigo-500/5. Behind the mockup: a large blurred indigo gradient orb for depth.

---

### 1.7 — The Flywheel

**Headline:** "The Flywheel Effect" in text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Every task makes the entire system smarter." text-lg text-slate-400 text-center.

**Visual:** A large circular diagram centered on the page (~400px diameter on desktop).

Four nodes arranged in a circle, connected by curved arrows forming a continuous loop. Arrows are gradient from indigo-500 to violet-500. The loop flows clockwise:

1. **Node 1 (top):** "Task Completed" — icon: ✅ — Small card with bg-zinc-900 border border-zinc-800 rounded-xl p-4. Text-sm font-semibold text-zinc-100 with text-xs text-slate-500 description: "Agent finishes a job"
2. **Node 2 (right):** "Skill Extracted" — icon: 🧠 — "Patterns and knowledge captured"
3. **Node 3 (bottom):** "Added to Library" — icon: 📚 — "Brain Vault grows smarter"
4. **Node 4 (left):** "Next Task Faster" — icon: ⚡ — "Future tasks benefit automatically"

**Center of the circle:** The Agent OS logomark with subtle pulsing glow. Text below: "Continuous improvement" in text-xs text-slate-500.

Below the diagram, centered: "Traditional tools reset every session. FAM compounds your investment." in text-base text-slate-400 italic.

---

### 1.8 — AI Tool Aggregator

**Headline:** "One portal for every AI tool." text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Stop tab-hopping. Access ChatGPT, Claude, Gemini, Perplexity, Midjourney, and more — through one unified dashboard with shared context." text-lg text-slate-400 text-center max-w-2xl mx-auto.

**Visual:** A horizontal row (scrollable on mobile) of tool cards, each a rounded-2xl bg-zinc-900 border border-zinc-800 card, w-28 h-28, flex flex-col items-center justify-center gap-2.

Tools shown (8 total):
1. Google Stitch — Stitch icon — "Design"
2. Figma Make — Figma icon — "Prototyping"
3. Perplexity — Perplexity icon — "Research"
4. NotebookLM — Notebook icon — "Analysis"
5. Gemini — Gemini icon — "Reasoning"
6. Claude — Claude icon — "Coding"
7. ChatGPT — OpenAI icon — "Writing"
8. Midjourney — MJ icon — "Imagery"

Each card has the tool's logo/icon (stylized, monochrome slate-400, or full color at reduced opacity), tool name in text-xs font-medium text-zinc-100, and category label in text-xs text-slate-500.

Below the row: A single line connecting all cards down to a central Agent OS node — visual metaphor of "all funneling into one place." The Agent OS node glows indigo.

**Footer text:** "New integrations added weekly. Request yours →" in text-sm text-indigo-400 text-center.

---

### 1.9 — Pricing Section

**Section label pill:** "PRICING" in text-xs tracking-widest uppercase text-indigo-400 text-center.
**Headline:** "Simple pricing. Powerful agents." text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Start free. Scale when you're ready." text-lg text-slate-400 text-center.

**Toggle:** Monthly / Annual (save 20%) pill toggle centered above cards. Annual active: bg-indigo-500/20 text-indigo-400.

**3-column grid** (stack on mobile). gap-6. Cards have equal height.

**Tier 1: Starter**
- bg-[#111116] border border-[#1e1e24] rounded-2xl p-8
- Badge: "Free Forever" in text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-3 py-1
- Plan name: "Starter" text-2xl font-bold text-zinc-100
- Price: "$0" text-5xl font-extrabold text-zinc-100, "/mo" text-lg text-slate-500
- Description: "Perfect for exploring AI agents" text-sm text-slate-400
- Divider: border-t border-zinc-800 my-6
- Features list (checkmarks in emerald-500):
  - 1 workspace
  - 3 agents
  - Basic models (Gemma, Qwen local)
  - Community support
  - 100 tasks/month
  - Brain Vault: 50 documents
- CTA: "Get Started" full-width button, border border-zinc-700 hover:border-zinc-600 text-slate-300 rounded-xl py-3 text-sm font-semibold

**Tier 2: Pro (highlighted)**
- bg-[#111116] border-2 border-indigo-500/50 rounded-2xl p-8 relative
- "Most Popular" absolute badge: -top-3 left-1/2 -translate-x-1/2, bg-indigo-500 text-white text-xs font-semibold rounded-full px-4 py-1
- Badge: "Pro" in text-xs text-indigo-400 bg-indigo-500/10 rounded-full px-3 py-1
- Plan name: "Pro" text-2xl font-bold text-zinc-100
- Price: "$49" text-5xl font-extrabold text-zinc-100, "/mo" text-lg text-slate-500
- Description: "For teams that ship with AI" text-sm text-slate-400
- Divider
- Features (checkmarks in indigo-400):
  - Unlimited workspaces
  - Unlimited agents
  - All models (Opus, Gemini, Claude, GPT-4o)
  - Approval workflows
  - Full marketplace access
  - Brain Vault: unlimited documents
  - Priority support
  - API access
- CTA: "Start Pro Trial" full-width button, bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl py-3 text-sm font-semibold shadow-lg shadow-indigo-500/25

**Tier 3: Enterprise**
- bg-[#111116] border border-[#1e1e24] rounded-2xl p-8
- Badge: "Enterprise" text-xs text-violet-400 bg-violet-500/10 rounded-full px-3 py-1
- Plan name: "Enterprise" text-2xl font-bold text-zinc-100
- Price: "Custom" text-5xl font-extrabold text-zinc-100
- Description: "Dedicated infrastructure, white-glove setup" text-sm text-slate-400
- Divider
- Features (checkmarks in violet-400):
  - Everything in Pro
  - Dedicated compute cluster
  - 99.9% SLA
  - 24/7 phone + Slack support
  - Custom agent teams
  - On-premise option
  - SOC 2 compliance
  - SAML/SSO
- CTA: "Contact Sales" full-width button, border border-zinc-700 hover:border-zinc-600 text-slate-300 rounded-xl py-3 text-sm font-semibold

---

### 1.10 — Mexico Section

**Background:** Subtle Mexican flag-inspired gradient stripe at the very top of the section — a thin 2px line that is green-500 → white → red-500, then section continues with normal dark bg.

**Section label pill:** "HECHO EN MEXICO 🇲🇽" text-xs tracking-widest uppercase text-emerald-400 text-center.
**Headline:** "Built for Mexico. Listo para el mundo." text-4xl font-bold text-zinc-100 text-center.
**Subtext:** "Full bilingual support, local payment integrations, and compliance tools designed for Mexican businesses." text-lg text-slate-400 text-center max-w-2xl mx-auto.

**4-column feature grid** (2x2 on mobile):

Card 1: 🧾 "SAT / CFDI Compliance"
"Automated invoice generation, tax calculation, and SAT submission. Fully compliant with Mexican fiscal regulations."
bg-zinc-900 border-zinc-800 rounded-2xl p-6

Card 2: 💰 "Peso Pricing + Local Payments"
"SPEI transfers, CoDi QR payments, OXXO cash deposits, Mercado Pago. All payment methods your customers use."

Card 3: 🌮 "Industry Templates"
"Pre-built agent teams for restaurants, dental clinics, retail shops, professional services, and e-commerce. Tailored to Mexican business workflows."
Show small icons: fork+knife, tooth, shopping bag, briefcase

Card 4: 🗣️ "Bilingual AI Agents"
"Every agent speaks fluent Spanish and English. Natural code-switching. Cultural context awareness for Mexican markets."

**Below grid, centered:**
Three small business type illustrations in a row: a taqueria storefront, a dental clinic, and a retail shop — simple, line-art style in slate-600 with indigo-500 accent highlights.

Text below: "Pricing starts at $299 MXN/mes. Acepta pagos en pesos." text-sm text-slate-400 text-center.

---

### 1.11 — Social Proof / Testimonials

**Headline:** "Trusted by teams who ship" text-3xl font-bold text-zinc-100 text-center.

**3 testimonial cards** in a row (stack on mobile):

Each card: bg-zinc-900 border border-zinc-800 rounded-2xl p-6.
- Quote: text-base text-slate-300 italic, preceded by a large " in text-4xl text-indigo-500/30
- Author row: flex items-center gap-3 mt-4
  - Avatar: rounded-full w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 (placeholder)
  - Name: text-sm font-semibold text-zinc-100
  - Title: text-xs text-slate-500

Testimonial 1: "We replaced 6 different AI subscriptions with FAM. The flywheel effect is real — our agents got noticeably faster after the first week." — Ana Martinez, CTO at TechMX

Testimonial 2: "The Mexico business suite alone saved us 20 hours a month on invoicing. And it actually understands Mexican tax law." — Carlos Reyes, Founder of NomNom Restaurants

Testimonial 3: "Mission Control gives me visibility I never had. I know exactly what every AI agent is doing, in real time." — Sarah Chen, Head of Operations at ScaleUp

**Below testimonials:**
Logos bar: "Powering teams at" with 5–6 placeholder company logos in slate-700 (monochrome), horizontally centered with gap-8.

**Final CTA block:**
"Join the FAM" in text-3xl font-bold text-zinc-100 text-center.
"Your AI workforce is waiting." text-lg text-slate-400.
"Get Started Free" button (same as hero primary CTA). Below: "No credit card required" text-xs text-slate-500.

---

### 1.12 — Footer

**Background:** bg-zinc-950 border-t border-zinc-800. py-16 then py-6 for bottom bar.

**Top section:** 4-column grid (stack on mobile).

Column 1: Agent OS logo + "FAM" wordmark. Brief description: "The flywheel automation marketplace. Your AI workforce, ready to work." text-sm text-slate-500 max-w-xs. Social icons row: Twitter/X, GitHub, Discord, LinkedIn — slate-500 hover:slate-300 icons.

Column 2: "Product" heading text-sm font-semibold text-zinc-100 mb-4.
Links in text-sm text-slate-400 hover:text-slate-200 flex flex-col gap-2:
Mission Control, Marketplace, Dispatch, Agent Chat, Brain Vault, API

Column 3: "Company" heading.
Links: About, Blog, Careers, Press, Contact, Mexico

Column 4: "Resources" heading.
Links: Documentation, Changelog, Status, Community, Support, Privacy Policy

**Bottom bar:** flex justify-between items-center pt-6 border-t border-zinc-800.
Left: "© 2026 FAM Technologies. All rights reserved." text-xs text-slate-600.
Center: "System Operational" badge — flex items-center gap-2, pulsing emerald-500 dot, text-xs text-slate-500.
Right: "Made with 🤍 in Mexico City" text-xs text-slate-600.

---

## PART 2: Dashboard / App Screens

All dashboard screens share a common shell: top nav bar + optional sidebar. Authenticated state. Same dark theme.

### Common Dashboard Shell

**Top nav bar:** h-14 bg-zinc-950 border-b border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl.

Left: Agent OS logomark (small, indigo-500) + "Agent OS" text-sm font-bold text-zinc-100.

Center nav links (desktop only): text-sm font-medium — "Mission Control", "Marketplace", "Agents", "Dispatch", "Brain Vault". Active: text-indigo-400 with a 2px bottom border in indigo-500. Inactive: text-slate-400 hover:text-slate-200.

Right cluster:
- Connection status pill: rounded-full flex items-center gap-2 px-3 py-1 border border-zinc-800 bg-zinc-900. Pulsing emerald-500 dot + "Live" text-xs text-emerald-400, OR red-500 dot + "Offline" text-xs text-red-400.
- Notification bell icon (slate-400) with optional red dot indicator.
- User avatar: rounded-full w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 with user initials in white text-xs font-bold.

---

### Screen 1: Mission Control (`/mission-control`)

The primary dashboard. A dense, information-rich overview of the entire system.

**Layout:** CSS grid — 2 columns on desktop (60/40 split), single column on mobile. gap-4 p-6.

#### Panel A: Agent Roster (top-left, spans full width on desktop or left 60%)

- Panel header: "Agent Roster" text-lg font-semibold text-zinc-100, right side: "9 agents" text-sm text-slate-500 + filter icon
- 3x3 grid of agent cards (grid-cols-3 on desktop, grid-cols-1 on mobile). gap-3.

Each agent card: bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700.
- Top row: status dot (w-2.5 h-2.5 rounded-full) + agent name text-sm font-semibold text-zinc-100
- Second row: role text-xs text-slate-500 (e.g., "Lead Architect")
- Third row: tier badge — small rounded-full px-2 py-0.5 text-xs font-medium
  - Orchestrator: bg-indigo-500/15 text-indigo-400 border border-indigo-500/30
  - Specialist: bg-violet-500/15 text-violet-400 border border-violet-500/30
  - Worker: bg-zinc-700/50 text-slate-400 border border-zinc-700
- Bottom: current task text-xs text-slate-600 truncated, or "Idle" in text-slate-700

**The 9 agents:**
1. 🎯 ContextAgent — Context Manager — Orchestrator — 🟢 Online
2. 📋 PMAgent — Project Manager — Orchestrator — 🟢 Online
3. 🗺️ PlannerAgent — Strategic Planner — Orchestrator — 🟢 Online
4. 🏗️ LeadArchitectAgent — Lead Architect — Specialist — 🟢 Online
5. 🔍 ReviewerAgent — Code Reviewer — Specialist — 🟡 Working
6. 🔬 ResearcherAgent — Research Analyst — Worker — 🟢 Online
7. ⚙️ BackendEngineerAgent — Backend Dev — Worker — 🟡 Working
8. 🎨 FrontendEngineerAgent — Frontend Dev — Worker — 🟢 Online
9. 📚 DomainAgent — Domain Expert — Worker — 🔴 Offline

#### Panel B: Model Tiers (top-right)

- Panel header: "Model Tiers" text-lg font-semibold text-zinc-100
- 4 stacked cards, gap-2:

Each model card: bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4.
- Left: model icon/badge (colored circle w-10 h-10 with letter)
- Center: model name text-sm font-semibold text-zinc-100, below: speed label text-xs text-slate-500
- Right: cost indicator — "$" symbols in different opacities (1-4 dollar signs)

Models:
1. "O" indigo bg — "Opus 4 Orchestrator" — "Deep reasoning · 30s/task" — $$$$
2. "G" emerald bg — "Gemma 4 Local" — "On-device · instant" — Free
3. "Q" sky bg — "Qwen3-Coder" — "Real-time code · 2s/task" — $$
4. "C" violet bg — "Codex Harness" — "Agentic tasks · 8s/task" — $$$

#### Panel C: Brain Vault (bottom-left)

- Panel header: "Brain Vault" text-lg font-semibold text-zinc-100, right: "247 docs" text-sm text-slate-500
- 6 horizontal bars, each representing a domain:

Each bar: flex items-center gap-3 py-2.
- Domain icon + name: text-sm text-zinc-100 (w-32 min-width)
- Progress bar: flex-1, h-2 rounded-full bg-zinc-800 with filled portion in the domain's color
- Count: text-xs text-slate-500 (e.g., "52 docs")

Domains:
1. ⚙️ Engineering — indigo-500 fill — 72 docs (wide fill ~65%)
2. 📈 Marketing — violet-500 fill — 45 docs (~40%)
3. 💰 Sales — emerald-500 fill — 38 docs (~35%)
4. 🏢 Operations — sky-500 fill — 52 docs (~48%)
5. 🏛️ Company — amber-500 fill — 28 docs (~25%)
6. 🛠️ Skills — rose-500 fill — 12 docs (~11%)

#### Panel D: Activity Feed (bottom-right)

- Panel header: "Activity" text-lg font-semibold text-zinc-100, right: "Live" with pulsing emerald dot
- Scrollable list (max-h-64 overflow-y-auto), gap-2:

Each activity item: flex items-start gap-3 py-2 border-b border-zinc-800/50.
- Timestamp: text-xs text-slate-600 font-mono w-16 shrink-0 (e.g., "2:34 PM")
- Agent badge: tiny rounded-full pill bg-zinc-800 text-xs text-slate-400 px-2 (e.g., "Backend")
- Action text: text-sm text-slate-300 flex-1 (e.g., "Completed API endpoint migration for /users route")
- Status icon: small emerald/yellow/red dot

8–10 activity items showing various agents completing tasks, starting tasks, requesting approval, etc.

**Bottom status bar:** Across the full width below all panels. bg-zinc-900 border-t border-zinc-800 px-6 py-2 flex justify-between.
Left: "Last synced: 3s ago" text-xs text-slate-600 + tiny pulsing dot.
Center: "9 agents · 4 models · 247 brain docs" text-xs text-slate-600.
Right: "Supabase" badge with Supabase icon, text-xs text-slate-600, subtle green underline.

---

### Screen 2: Marketplace (`/marketplace`)

**Top section:**
- Page title: "Marketplace" text-2xl font-bold text-zinc-100.
- Subtitle: "Agent teams, skills, and automations to supercharge your workflow." text-sm text-slate-400.

- Search bar: full-width max-w-2xl, bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3. Search icon (slate-500) + placeholder "Search marketplace..." text-sm text-slate-500. Right side: filter icon button (border border-zinc-700 rounded-lg p-2).

- Category tabs: flex gap-2 mt-4. Same styling as marketing site tabs. "All" active by default.

**Grid:** grid-cols-3 on desktop, grid-cols-1 on mobile. gap-4 mt-6.

Show 9 marketplace cards (same card design as marketing site section 1.5 but slightly more compact for the dashboard context). Mix of agent teams, skills, automations, and integrations.

**When a card is clicked — Detail Modal:**
Centered overlay modal, max-w-2xl, bg-zinc-900 border border-zinc-800 rounded-2xl p-0 shadow-2xl.

- Header: large emoji (text-5xl) on left, right side: item name text-2xl font-bold text-zinc-100, category badge, star rating, install count. Below: author name text-sm text-slate-500.
- Close X button in top-right.
- Body: scrollable.
  - "About" section: text-sm text-slate-300 leading-relaxed. 2–3 paragraphs of description.
  - "Included" section: list of included components with small icons (agents, skills, automations, connections). Each as a small flex row with icon + name + type badge.
  - "Screenshots" section: 2 preview images in rounded-xl bg-zinc-800 placeholder frames.
  - "Reviews" section: 2–3 review cards (avatar, name, rating, text).
- Footer: sticky bottom. bg-zinc-900 border-t border-zinc-800 p-4 flex justify-between items-center.
  - Price: "Free" or "$9/mo" text-lg font-bold.
  - "Install" button: bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl px-8 py-3 text-sm font-semibold.

---

### Screen 3: Dispatch Console (`/dispatch`)

**Layout:** max-w-3xl mx-auto centered content. Clean, focused interface.

**Dispatch input area:**
- Large textarea: bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full min-h-[120px] text-base text-zinc-100. Placeholder: "Describe the task or goal..." in text-slate-500. Focus: border-indigo-500 ring-1 ring-indigo-500/50.
- Below the textarea, flex justify-between items-center mt-3:
  - Left: Agent selector — a rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center gap-2. Lightning bolt icon (⚡) in indigo-400, "Auto-assign" text-sm text-slate-300, chevron-down icon. Dropdown on click: list of agents with their tier badges.
  - Center: Options — small icon buttons for "Attach file" (paperclip), "Priority" (flag), "Schedule" (clock).
  - Right: "Dispatch" button — bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl px-8 py-2.5 text-sm font-semibold flex items-center gap-2. Rocket icon (🚀) + "Dispatch". Shadow: shadow-lg shadow-indigo-500/25.

**Divider:** border-t border-zinc-800 my-8 with centered text "Recent Commands" text-xs text-slate-600 bg-zinc-950 px-4 -mt-3 relative.

**Recent Commands list:** flex flex-col gap-3.

Each command card: bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 cursor-pointer.
- Top row: flex justify-between items-center.
  - Command text: text-sm text-zinc-100 font-medium truncate flex-1 (e.g., "Build a REST API for user authentication with JWT tokens")
  - Status badge: rounded-full px-2.5 py-0.5 text-xs font-medium flex items-center gap-1.5
    - Pending: bg-yellow-500/10 text-yellow-400 border border-yellow-500/30, clock icon
    - Running: bg-indigo-500/10 text-indigo-400 border border-indigo-500/30, spinner animation
    - Completed: bg-emerald-500/10 text-emerald-400 border border-emerald-500/30, checkmark icon
    - Failed: bg-red-500/10 text-red-400 border border-red-500/30, X icon
- Bottom row: flex items-center gap-4 mt-2 text-xs text-slate-500.
  - Agent badge: tiny pill showing assigned agent name
  - Timestamp: "2 minutes ago"
  - Expand arrow: chevron-down, rotates on expand

**Expanded state** (when a command is clicked): Card expands to show:
- Result section: bg-zinc-800/50 rounded-lg p-4 mt-3, showing agent's output in text-sm text-slate-300 font-mono.
- Tool calls: collapsible list showing which tools were used (e.g., "Called: supabase.query()", "Called: github.createPR()").
- Duration: "Completed in 34s" text-xs text-slate-500.

Show 5 commands: 1 Running, 1 Pending, 2 Completed, 1 Failed.

---

### Screen 4: Agent Chat (`/agents`)

**Layout:** flex h-[calc(100vh-3.5rem)] (full height minus nav).

#### Left Sidebar (w-72 border-r border-zinc-800 bg-zinc-950)

- Sidebar header: px-4 py-3 border-b border-zinc-800. "Agents" text-lg font-semibold text-zinc-100. Search icon button.

- Agent groups, each with a section label:

**Orchestrators** — text-xs font-semibold text-indigo-400 uppercase tracking-wider px-4 pt-4 pb-2
- ContextAgent — "Context Manager" — 🟢 — "Active now"
- PMAgent — "Project Manager" — 🟢 — "Active now"
- PlannerAgent — "Strategic Planner" — 🟢 — "3m ago"

**Specialists** — text-xs font-semibold text-violet-400 uppercase tracking-wider px-4 pt-4 pb-2
- LeadArchitectAgent — "Lead Architect" — 🟢 — "1m ago"
- ReviewerAgent — "Code Reviewer" — 🟡 — "Reviewing PR #42"

**Workers** — text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 pt-4 pb-2
- ResearcherAgent — "Research Analyst" — 🟢 — "5m ago"
- BackendEngineerAgent — "Backend Dev" — 🟡 — "Building API"
- FrontendEngineerAgent — "Frontend Dev" — 🟢 — "2m ago"
- DomainAgent — "Domain Expert" — 🔴 — "Offline"

Each agent list item: px-4 py-3 hover:bg-zinc-900 cursor-pointer rounded-lg mx-2 flex items-center gap-3.
- Status dot (w-2 h-2 rounded-full)
- Agent name text-sm font-medium text-zinc-100
- Role text-xs text-slate-500 below name
- Right-aligned: last active text-xs text-slate-600

Active/selected agent: bg-zinc-800/50 border-l-2 border-indigo-500.

#### Right Panel (flex-1 flex flex-col bg-zinc-950)

**Agent header:** px-6 py-4 border-b border-zinc-800 flex items-center gap-4.
- Agent avatar: w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center, emoji text-xl
- Name: text-lg font-semibold text-zinc-100
- Role: text-sm text-slate-500
- Tier badge (same as roster)
- Model: text-xs text-slate-600 font-mono (e.g., "claude-opus-4-6")
- Right side: "Online" status with emerald dot, and a "..." options menu button

**Message area:** flex-1 overflow-y-auto px-6 py-4. flex flex-col gap-4.

User messages (right-aligned): max-w-[70%] ml-auto bg-indigo-500/20 border border-indigo-500/30 rounded-2xl rounded-br-md px-4 py-3 text-sm text-zinc-100.

Agent messages (left-aligned): max-w-[70%] bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-200.

**Tool call expansion cards** (within agent messages): bg-zinc-900 border border-zinc-700 rounded-lg p-3 mt-2. Collapsible.
- Header: flex items-center gap-2. Wrench icon (🔧) text-xs text-slate-500, "Tool: supabase.query()" text-xs font-mono text-slate-400, chevron icon.
- Expanded: shows input/output in text-xs font-mono text-slate-500 bg-zinc-950 rounded-md p-2.

Sample conversation showing 4–5 messages: user asks to build a feature, agent responds with plan, makes tool calls, returns results.

**Input bar:** px-6 py-4 border-t border-zinc-800.
- Input: bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 focus-within:border-indigo-500.
  - Text input: flex-1 text-sm text-zinc-100 placeholder "Message LeadArchitectAgent..."
  - Send button: rounded-lg bg-indigo-500 hover:bg-indigo-400 w-9 h-9 flex items-center justify-center. Arrow-up icon in white.
- Below input: text-xs text-slate-600 "⌘ + Enter to send"

---

### Screen 5: Team Pipeline View (`/team`)

**Page title:** "Team Pipeline" text-2xl font-bold text-zinc-100. Subtitle: "Real-time view of your agent workflow" text-sm text-slate-400.

**Horizontal flow visualization:** A wide, horizontally scrollable area. Background: subtle dot grid pattern in zinc-800/20.

**Pipeline stages** flow left-to-right, connected by directional arrows (→) in slate-700 with subtle gradient to indigo-500 where work is actively flowing:

**Stage 1: Planning**
Node: rounded-2xl bg-zinc-900 border-2 border-indigo-500/50 p-4 w-40 text-center. Glowing (active).
- 🗺️ PlannerAgent
- "Planning" text-xs text-indigo-400
- Status: "Active" with emerald dot
- Small progress ring around the node border (animated)

→ arrow →

**Stage 2: Architecture**
Node: same style, border-indigo-500/30, less glow.
- 🏗️ LeadArchitectAgent
- "Designing" text-xs text-indigo-400
- Status: "Active"

→ arrow →

**Stage 3: Development (3 parallel nodes)**
Three nodes stacked vertically with a bracket connecting them:
- ⚙️ BackendEngineerAgent — "Building API" — 🟡 Working
- 🎨 FrontendEngineerAgent — "Building UI" — 🟢 Idle (dimmed, border-zinc-800, opacity-50)
- 🔬 ResearcherAgent — "Researching" — 🟢 Idle (dimmed)

→ arrow →

**Stage 4: Code Review**
Node: border-yellow-500/30, yellow tint.
- 🔍 ReviewerAgent
- "Reviewing" text-xs text-yellow-400
- Status: "In Review"

→ arrow →

**Stage 5: QA**
Node: dimmed (not yet active), border-zinc-800.
- 🧪 QAAgent
- "Pending"
- Status: "Waiting"

→ arrow →

**Stage 6: Release**
Node: dimmed.
- 🚀 ReleaseAgent
- "Pending"
- Status: "Waiting"

**Orchestrator overlay:** At the top of the pipeline, spanning its width, a thin bar showing:
- 🎯 ContextAgent (overseeing) — connected to all nodes by thin dotted lines
- 📋 PMAgent (tracking) — small status text "Sprint 4 · Day 3 · On Track"

**Click interaction:** Clicking any node opens a slide-out panel from the right (w-96 bg-zinc-900 border-l border-zinc-800) showing: agent details, current task, recent actions, model info, and a "Chat" button to jump to the agent chat view.

---

### Screen 6: Settings / Brain Config (`/settings`)

**Layout:** flex. Left sidebar nav + right content area.

#### Left sidebar (w-56 border-r border-zinc-800 bg-zinc-950 py-6)

Nav items (vertical list), each: px-4 py-2.5 rounded-lg mx-2 text-sm text-slate-400 hover:text-zinc-100 hover:bg-zinc-900 flex items-center gap-3.
Active item: bg-zinc-800/50 text-zinc-100 with indigo-500 left border (2px).

Items with icons:
- ⚙️ General
- 🤖 Models
- 🧠 Brain Vault (active)
- 🛠️ Skills
- 🔌 Integrations
- 🔑 API Keys

#### Content area — Brain Vault tab (shown as active)

**Section header:** "Brain Vault" text-xl font-semibold text-zinc-100. "Your company's knowledge base, always in context for every agent." text-sm text-slate-400.

**Hot Memory Budget bar:** A prominent horizontal bar at top.
Label: "Hot Memory" text-sm font-medium text-zinc-100. "128K / 200K tokens used" text-sm text-slate-500.
Bar: w-full h-3 rounded-full bg-zinc-800. Filled portion (64%): bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full. If over 80%: fill turns amber-500.
Below bar: "Tokens are distributed across active agents automatically." text-xs text-slate-600.

**Search:** "Search brain vault..." input, same style as dispatch search. Full-width. mb-4.

**Two-column layout** below (60/40):

**Left column: Domain Tree**
A file-tree style expandable list:

```
📁 company/ (28 docs)
  📄 company-overview.md
  📄 org-chart.md
  📄 brand-guidelines.md
  └── ...
📁 engineering/ (72 docs)  ← expanded
  📁 architecture/
    📄 system-design.md
    📄 api-standards.md
  📁 playbooks/
    📄 deployment-checklist.md
    📄 incident-response.md
  📁 standards/
    📄 code-review-guide.md
  └── ...
📁 marketing/ (45 docs)
📁 sales/ (38 docs)
📁 operations/ (52 docs)
📁 skills/ (12 docs)
```

Each folder: flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-900 rounded-md cursor-pointer.
Folder icon in amber-400, name text-sm text-zinc-100, count text-xs text-slate-600.
Files: document icon in slate-500, name text-sm text-slate-300.
Expand/collapse chevrons.

**Right column: Document Preview**
When a file is selected, show its preview:
- Card: bg-zinc-900 border border-zinc-800 rounded-xl p-6.
- File name: text-lg font-semibold text-zinc-100.
- Frontmatter: bg-zinc-800 rounded-lg p-3 text-xs font-mono text-slate-400. Shows domain, type, priority, tokens, last_updated.
- Content preview: first 10 lines of the document in text-sm text-slate-300 font-mono. Fades out with a gradient mask.
- Action buttons: flex gap-2 mt-4. "Edit" (border border-zinc-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs), "Remove" (border border-red-500/30 text-red-400 rounded-lg px-3 py-1.5 text-xs), "Pin to Hot Memory" (bg-indigo-500/20 text-indigo-400 rounded-lg px-3 py-1.5 text-xs).

#### Content area — Models tab (alternate view)

**Section header:** "Model Configuration" text-xl font-semibold text-zinc-100.

**Model tier cards** (grid-cols-2 gap-4):

Each card: bg-zinc-900 border border-zinc-800 rounded-xl p-6.
- Model icon (colored circle) + name text-lg font-semibold text-zinc-100
- Tier: text-xs badge (Orchestrator/Specialist/Worker)
- Provider: text-sm text-slate-500 (e.g., "Anthropic", "Google", "Alibaba")
- Speed: text-sm text-slate-400 (e.g., "~30s per task")
- Cost: $ indicator + estimated $/1K tokens text-xs text-slate-500
- "Edit" button, "Test" button
- Toggle: "Active" switch

**Cost Estimator:** Below the cards.
Card: bg-zinc-900 border border-zinc-800 rounded-xl p-6.
- "Monthly Cost Estimate" text-lg font-semibold text-zinc-100
- Slider: "Expected tasks/month" — range input from 100 to 10,000
- Breakdown table: model name | tasks routed | estimated cost. Font-mono text-sm.
- Total: text-lg font-bold text-zinc-100 with indigo underline.

**Fallback Chain Visualization:**
A vertical flow showing: Primary Model → Fallback 1 → Fallback 2 → Local Model.
Each node connected by arrows. If primary fails/times out, auto-routes to next.
"Opus 4" → "GPT-4o" → "Qwen3-Coder" → "Gemma 4 Local"
Each with latency and cost annotations.

---

## Responsive Behavior Notes

- **Desktop (1280px+):** Full multi-column layouts as described. Side-by-side panels.
- **Tablet (768px–1279px):** 2-column grids collapse to 2 columns where possible. Sidebar becomes collapsible hamburger menu.
- **Mobile (< 768px):** Single column everything. Bottom tab navigation replaces top nav links (5 icons: Home, Market, Dispatch, Agents, Settings). Cards stack vertically. Pipeline view becomes vertical instead of horizontal. Chat fills full screen.

---

## Interaction States Summary

| Element | Default | Hover | Active/Focus | Disabled |
|---|---|---|---|---|
| Primary button | bg-indigo-500 | bg-indigo-400, shadow-lg | ring-2 ring-indigo-500/50 | opacity-50 cursor-not-allowed |
| Secondary button | border-zinc-700 bg-transparent | border-zinc-600, text-white | ring-2 ring-zinc-500/50 | opacity-50 |
| Card | border-zinc-800 | border-zinc-700, -translate-y-0.5 | border-indigo-500 | opacity-60 |
| Input | border-zinc-800 | border-zinc-700 | border-indigo-500, ring-1 ring-indigo-500/50 | bg-zinc-900/50 |
| Nav link | text-slate-400 | text-slate-200 | text-indigo-400, border-b-2 border-indigo-500 | text-slate-700 |
| Status dot | solid color | — | pulse animation | gray |

---

## Asset Requirements

- Agent OS logomark: geometric "A" formed by converging nodes/lines, works at 24px and 64px
- Favicon: logomark in indigo on dark background
- OG image: hero section screenshot, 1200x630
- Marketplace card emoji icons at text-3xl (30px+)
- Placeholder avatar gradients (indigo → violet)
- Tool/integration logos as monochrome SVGs for the aggregator section
- Noise texture: subtle, tileable, PNG at 5% opacity

---

*End of Google Stitch design prompt. Paste this entire document into Stitch for comprehensive screen generation. Each section contains enough detail for production-quality output including exact colors, spacing, typography, content, and interaction states.*
