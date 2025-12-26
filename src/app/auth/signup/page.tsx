'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, Check, X, Mail } from 'lucide-react'

// Phone number formatter
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '')
  
  // Format as +1 (XXX) XXX-XXXX
  if (digits.length === 0) return ''
  if (digits.length <= 1) return `+${digits}`
  if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)}`
  if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`
  return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`
}

export default function SignUpPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  // Password match indicator
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword
  const passwordsDontMatch = formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData({ ...formData, phone: formatted })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.fullName || !formData.email || !formData.password) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    console.log('Attempting signup with:', { email: formData.email, fullName: formData.fullName })

    const { error: signUpError, needsEmailConfirmation: needsConfirmation } = await signUp(
      formData.email,
      formData.password,
      formData.fullName,
      formData.phone || undefined
    )

    setLoading(false)

    if (signUpError) {
      console.error('Signup error:', signUpError)
      setError(signUpError.message || 'Failed to create account. Please try again.')
      return
    }

    // If email confirmation is required, show message instead of redirecting
    if (needsConfirmation) {
      console.log('Email confirmation required')
      setNeedsEmailConfirmation(true)
      return
    }

    console.log('Signup successful, redirecting to profile setup')
    // Success - redirect to profile setup
    router.push('/auth/setup-profile')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white font-bold text-xl">BN</span>
          </div>
          <span className="font-semibold text-white text-2xl tracking-tight">BlankNightlife</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">
            {needsEmailConfirmation ? 'Check your email' : 'Create your account'}
          </h1>
          <p className="text-sm text-zinc-500">
            {needsEmailConfirmation 
              ? 'We sent a confirmation link to your email'
              : 'Manage your nightlife content across multiple brands'
            }
          </p>
        </div>

        {needsEmailConfirmation ? (
          <div className="space-y-6">
            {/* Email Confirmation Message */}
            <div className="p-6 rounded-lg bg-violet-950/20 border border-violet-900/50">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-6 w-6 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-2">Confirm your email address</h3>
                  <p className="text-sm text-zinc-400 mb-4">
                    We've sent a confirmation link to <strong className="text-white">{formData.email}</strong>
                  </p>
                  <p className="text-sm text-zinc-500">
                    Click the link in the email to activate your account. You can close this page and return after confirming.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
              >
                Go to Login
              </Button>
              
              <div className="text-center">
                <button
                  onClick={() => {
                    setNeedsEmailConfirmation(false)
                    setFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
                  }}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  Sign up with a different email
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <Label htmlFor="fullName" className="text-zinc-300">
              Full Name *
            </Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-zinc-300">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone" className="text-zinc-300">
              Phone (Optional)
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
              placeholder="+1 (555) 123-4567"
              maxLength={18}
            />
            <p className="text-xs text-zinc-500 mt-1">Auto-formatted as you type</p>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-zinc-300">
              Password *
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-zinc-500 mt-1">Minimum 6 characters</p>
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" className="text-zinc-300">
              Confirm Password *
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white pr-10"
                placeholder="••••••••"
                required
              />
              {passwordsMatch && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
              {passwordsDontMatch && (
                <X className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
              )}
            </div>
            {passwordsDontMatch && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-green-400 mt-1">Passwords match</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </Button>
        </form>
        )}

        {/* Login Link - Only show if not in email confirmation state */}
        {!needsEmailConfirmation && (
          <p className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
              Log in
            </Link>
          </p>
        )}
      </Card>
    </div>
  )
}

