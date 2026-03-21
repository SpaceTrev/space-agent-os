// ============================================================
// Agent OS — Root Layout
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
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
}

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
      <body className="min-h-screen antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
