import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/mission-control',
  '/marketplace',
  '/dispatch',
  '/agents',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/health',
  '/api/system',
  '/api/billing/webhook',
  '/api/ops',
  '/api/webhooks',
  '/api/marketplace',
  '/api/sync',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths, static files, and root
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // For non-public routes, try Supabase auth — but don't crash if it fails
  try {
    const { createServerClient } = await import('@supabase/ssr')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.next()
    }

    let response = NextResponse.next({ request: { headers: req.headers } })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user && (pathname.startsWith('/dashboard') || pathname.match(/^\/[^/]+/))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (user && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return response
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
