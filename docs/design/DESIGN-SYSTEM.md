# Design System Document: The Intellectual Kinetic

## 0. Color Mode Architecture

This system has two color modes. Everything else — layout, typography, components,
spacing, elevation rules, the No-Line Rule — is **mode-agnostic** and defined once below.

| Mode | Source of truth | Notes |
|---|---|---|
| **Light (default)** | Stitch MCP output | Solarized Light-inspired palette, generated via Google Stitch |
| **Dark** | Section 2 of this document | Deep navy, teal/amber accents |

Implementation: CSS custom properties on `:root` (light) and `.dark` / `@media (prefers-color-scheme: dark)` (dark). Tailwind `dark:` variant for utility overrides. Components reference tokens only — never hardcoded hex values except within the token definitions themselves.

---

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Archivist"**
This design system moves away from the "neon-on-black" hacker tropes of the early 2000s, opting instead for a high-fidelity, scholarly environment. It is rooted in the "Scholar-Hacker" aesthetic—an intentional blend of brutalist precision and editorial elegance.

To break the "template" look, we utilize **Intentional Asymmetry**. Layouts should not be perfectly mirrored; rather, they should feel like a meticulously organized researcher's desk. We achieve this through "The Off-Grid Shift," where secondary metadata (labels, timestamps) is often tucked into the margins or aligned to a secondary vertical axis, creating a sense of sophisticated, non-linear discovery.

---

## 2. Dark Mode Color Palette
> **Scope: dark mode only.** Light mode colors come from the Stitch-generated design.
> All surface token names are shared between modes — only the hex values swap.

### Surface Hierarchy & Nesting (Tonal Nesting)
- **Base Layer:** `surface` — `#00161d`
- **Sectioning:** `surface_container_low` — `#001f28`
- **Active Workspace:** `surface_container` — `#00232d`
- **Elevated Workspace:** `surface_container_high` — `#0d2e39`
- **Floating Logic:** `surface_container_highest` — `#133945`
- **Hover State:** `surface_bright` — `#183e49`

### Accent Tokens (dark mode)
- **Primary:** `#6cd8ce` (teal) → gradient to `primary_container` `#002c29` at 135°
- **Secondary / System-Critical:** `#f2bf43` (amber) — use sparingly
- **Ghost Border fallback:** `outline_variant` `#41484b` at 20% opacity

### Frosted Obsidian (dark mode)
`backdrop-blur(8–12px)` over `surface_container_high` at 60% opacity. Used for modals, popovers, floating panels.

### Tinted Ambient Shadow (dark mode, use only when elevation is ambiguous)
`box-shadow: 0 20px 40px rgba(0, 22, 29, 0.6)`

---

## 3. Typography
*Mode-agnostic. Applies to both light and dark.*

- **Display / Headlines:** Space Grotesk, tracking `-0.02em`, weight 600–700
- **Body:** Public Sans, weight 400, leading relaxed
- **Data / Labels:** Inter, weight 400–500
- **Numerical data:** monospace (JetBrains Mono or system monospace)
- **Label-sm pattern:** Space Grotesk, all-caps, `letter-spacing: 0.08em`

---

## 4. Elevation
*Mode-agnostic structure; shadow color uses mode-specific tokens.*

Tonal layering is the primary elevation signal — not drop shadows. Nest surfaces using the container hierarchy from Section 2 (light: Stitch tokens; dark: Section 2 tokens).

Drop shadows: use `tinted ambient shadow` only when tonal layering alone is insufficient to establish depth (e.g., a modal over a complex background).

---

## 5. Components
*Mode-agnostic structure. Colors reference tokens, not hex.*

- **Buttons:** Primary = gradient fill (`primary` → `primary_container`), `border-radius: 0.375rem` (md). Secondary = `surface_container_highest` bg + ghost border. Tertiary = text-only in `secondary` (amber) monospace.
- **Inputs:** `surface_container_highest` bg, no visible border at rest. Focus = 1px ghost border in `secondary` (amber).
- **Cards:** No dividers. 24px (`space-y-6`) vertical whitespace between items. Hover shifts to `surface_bright`.
- **Chips:** `tertiary_container` bg, `border-radius: 0.125rem` (sm). No `rounded-full` pills.
- **Tables:** `surface_container_lowest` headers, right-aligned monospace numbers, no row dividers.

---

## 6. Rules
*Mode-agnostic.*

### No-Line Rule
NO 1px borders for sectioning or layout separation. Use tonal surface nesting exclusively.
Ghost borders (`outline_variant` at 20% opacity) are permitted only when accessibility requires a visible boundary that color contrast alone cannot provide.

### Do's
- Amber (`secondary`) sparingly — system-critical states, tertiary CTAs, focus rings
- Embrace whitespace; 24px between list items is the floor, not the ceiling
- Space Grotesk all-caps for `label-sm` category labels
- Intentional asymmetry: secondary metadata lives in margins, not centered

### Don'ts
- No pure black (`#000000`) — use `surface` base token
- No drop shadows except tinted ambient when strictly necessary
- No `rounded-full` / pill shapes
- No high-contrast dividers (`border-*`, `divide-*`)
- Never hardcode hex values in component code — reference CSS custom properties
