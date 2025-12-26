'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Loader2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AccountSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone || null,
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Failed to update account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="mb-4 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-2xl font-semibold text-white">Account Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your account information
        </p>
      </div>

      <div className="max-w-2xl">
        <Card className="border border-zinc-800 bg-zinc-950 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Profile Picture Placeholder */}
            <div>
              <Label className="text-zinc-300 mb-3 block">Profile Picture</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <User className="h-10 w-10 text-white" />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 text-zinc-400"
                    disabled
                  >
                    Change Photo (Coming Soon)
                  </Button>
                  <p className="text-xs text-zinc-500 mt-1">JPG, PNG or GIF. Max 2MB</p>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="text-zinc-300">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                Used for notifications and account recovery
              </p>
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
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-lg bg-green-950/20 border border-green-900/50 text-green-400 text-sm">
                Account updated successfully!
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-zinc-800 text-zinc-400"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

