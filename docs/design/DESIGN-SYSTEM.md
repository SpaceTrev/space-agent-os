# Design System Document: The Intellectual Kinetic

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Archivist"**
This design system moves away from the "neon-on-black" hacker tropes of the early 2000s, opting instead for a high-fidelity, scholarly environment. It is rooted in the "Scholar-Hacker" aesthetic—an intentional blend of brutalist precision and editorial elegance.

To break the "template" look, we utilize **Intentional Asymmetry**. Layouts should not be perfectly mirrored; rather, they should feel like a meticulously organized researcher's desk. We achieve this through "The Off-Grid Shift," where secondary metadata (labels, timestamps) is often tucked into the margins or aligned to a secondary vertical axis, creating a sense of sophisticated, non-linear discovery.

## 2. Colors & Surface Philosophy
### Surface Hierarchy & Nesting (Tonal Nesting)
- **Base Layer:** surface (#00161d)
- **Sectioning:** surface_container_low (#001f28)
- **Active Workspace:** surface_container (#00232d)
- **Floating Logic:** surface_container_highest (#133945)

### No-Line Rule: NO 1px borders. Tonal shifts only.
### Glass & Gradient: primary (#6cd8ce) to primary_container (#002c29) at 135°. Frosted Obsidian = backdrop-blur(8-12px) over 60% opaque surface_container_high.

## 3. Typography
- Display/Headlines: Space Grotesk (-0.02em tracking)
- Body: Public Sans
- Data/Labels: Inter
- Numerical data: monospace

## 4. Elevation: Tonal layering, not shadows. Tinted ambient shadow only when needed: box-shadow: 0 20px 40px rgba(0, 22, 29, 0.6). Ghost Border fallback: outline_variant (#41484b) at 20% opacity.

## 5. Components
- Buttons: Primary = gradient fill, md radius. Secondary = surface_container_highest + ghost border. Tertiary = text-only in amber (#f2bf43) monospace.
- Inputs: surface_container_highest bg, no border. Focus = 1px ghost border in amber.
- Cards: No dividers. 24px vertical whitespace. Hover shifts to surface_bright (#183e49).
- Chips: tertiary_container bg, sm radius (0.125rem). No pills.
- Tables: surface_container_lowest headers, right-aligned monospace numbers.

## 6. Do's: Amber sparingly, embrace whitespace, Space Grotesk all-caps for label-sm.
## Don'ts: No pure black, no drop shadows, no radius-full, no high-contrast dividers.
