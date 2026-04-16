import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Public Sans', 'sans-serif'],
        data: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── Surface hierarchy ───────────────────────────────────
        surface: 'var(--surface)',
        'surface-low':     'var(--surface-container-low)',
        'surface-base':    'var(--surface-container)',
        'surface-high':    'var(--surface-container-high)',
        'surface-highest': 'var(--surface-container-highest)',
        'surface-bright':  'var(--surface-bright)',

        // ── Text ────────────────────────────────────────────────
        'on-surface':         'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',

        // ── Accent ──────────────────────────────────────────────
        primary:            'var(--primary)',
        'primary-container': 'var(--primary-container)',
        secondary:          'var(--secondary)',
        'secondary-container': 'var(--secondary-container)',
        tertiary:           'var(--tertiary)',
        'tertiary-container': 'var(--tertiary-container)',

        // ── Outline ─────────────────────────────────────────────
        'outline-variant':  'var(--outline-variant)',

        // ── Legacy aliases (keep marketplace + existing code working) ──
        background: 'var(--surface)',
        'surface-legacy': 'var(--surface-container)',
        'border-base': 'var(--outline-variant)',
        'text-primary': 'var(--on-surface)',
        'text-secondary': 'var(--on-surface-variant)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--primary)',
      },
    },
  },
  plugins: [],
}

export default config
