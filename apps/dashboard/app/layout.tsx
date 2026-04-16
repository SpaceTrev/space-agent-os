// ============================================================
// Agent OS — Root Layout  (The Intellectual Kinetic design)
// ============================================================

import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: {
    default: 'Agent OS',
    template: '%s | Agent OS',
  },
  description:
    'Multi-tenant AI agent orchestration platform. Build, deploy, and monitor autonomous AI agents at scale.',
  keywords: ['AI agents', 'orchestration', 'automation', 'LLM', 'multi-tenant'],
  authors: [{ name: 'Agent OS' }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Agent OS',
    description: 'Multi-tenant AI agent orchestration platform',
    siteName: 'Agent OS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent OS',
    description: 'Multi-tenant AI agent orchestration platform',
  },
}

export const viewport: Viewport = {
  themeColor: '#2aa198',
  width: 'device-width',
  initialScale: 1,
}

// ============================================================
// Theme init script — runs before React hydration to prevent
// flash of wrong theme. System preference is the default.
// ============================================================

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.add(theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
    }
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
`

// ============================================================
// Root Layout Component
// ============================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash theme script — must run synchronously before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* Google Fonts — The Intellectual Kinetic */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased font-body">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
