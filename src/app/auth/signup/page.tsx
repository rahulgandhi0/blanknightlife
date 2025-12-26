'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, Check, X } from 'lucide-react'

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

    const { error: signUpError } = await signUp(
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
          <h1 className="text-2xl font-semibold text-white mb-2">Create your account</h1>
          <p className="text-sm text-zinc-500">
            Manage your nightlife content across multiple brands
          </p>
        </div>

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

        {/* Login Link */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  )
}

