'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = (() => {
    if (password.length === 0) return null
    if (password.length < 6) return 'weak'
    if (password.length < 10) return 'medium'
    return 'strong'
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, orgName, email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Failed to create account')
        return
      }

      router.push('/onboarding')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
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

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-white">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">Start deploying AI agents in minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Your name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Johnson"
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-gray-600 transition-colors"
              />
            </div>

            {/* Org name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Organization name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-gray-600 transition-colors"
              />
              <p className="mt-1 text-xs text-gray-600">
                This creates your first workspace organization
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-gray-600 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="block w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-gray-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength */}
              {passwordStrength && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {['weak', 'medium', 'strong'].map((level, i) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength === 'weak' && i === 0
                            ? 'bg-red-500'
                            : passwordStrength === 'medium' && i <= 1
                            ? 'bg-yellow-400'
                            : passwordStrength === 'strong'
                            ? 'bg-green-400'
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs ${
                    passwordStrength === 'weak' ? 'text-red-400' :
                    passwordStrength === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Terms */}
            <p className="text-xs text-gray-600 text-center">
              By creating an account you agree to our{' '}
              <Link href="#" className="text-gray-400 hover:text-gray-300">Terms of Service</Link>
              {' '}and{' '}
              <Link href="#" className="text-gray-400 hover:text-gray-300">Privacy Policy</Link>
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Create account
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
