'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const client = getSupabase()
    if (!client) {
      setError('Authentication not configured. Contact support.')
      setLoading(false)
      return
    }

    const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Agent OS</span>
          </Link>
        </div>

        <div className="bg-surface-base border border-outline-variant rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
              <p className="text-sm text-on-surface-variant mb-6">
                We sent a password reset link to <span className="text-on-surface font-medium">{email}</span>.
                Click the link to set a new password.
              </p>
              <Link
                href="/login"
                className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold text-white">Reset your password</h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Enter your email and we&apos;ll send a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="block w-full rounded-lg border border-outline-variant bg-surface-high text-sm text-white placeholder-on-surface-variant/50 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-outline-variant transition-colors"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors mt-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Send reset link
                </button>
              </form>

              <p className="text-center text-sm text-on-surface-variant mt-6">
                Remember your password?{' '}
                <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
