'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle2, Instagram, Twitter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SocialBuAccount } from '@/lib/socialbu'

export default function SetupProfilePage() {
  const router = useRouter()
  const { user, refreshProfiles } = useAuth()
  const supabase = createClient()
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [socialBuAccounts, setSocialBuAccounts] = useState<SocialBuAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  
  const [profileData, setProfileData] = useState({
    name: '',
    handle: '',
    socialbuAccountId: '',
    platform: '' as 'instagram' | 'tiktok' | 'twitter' | '',
  })

  // Load SocialBu accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/socialbu-accounts')
        const data = await response.json()
        
        if (data.success) {
          setSocialBuAccounts(data.accounts)
        }
      } catch (error) {
        console.error('Error fetching accounts:', error)
      } finally {
        setLoadingAccounts(false)
      }
    }

    fetchAccounts()
  }, [])

  const handleAccountSelect = (accountId: string) => {
    const account = socialBuAccounts.find(a => a.id.toString() === accountId)
    if (account) {
      setProfileData({
        ...profileData,
        socialbuAccountId: accountId,
        platform: account.type as any,
        handle: account.username,
        name: profileData.name || account.name,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)

    try {
      // Create profile
      const { error } = await supabase.from('profiles').insert({
        user_id: user.id,
        name: profileData.name,
        handle: profileData.handle,
        socialbu_account_id: parseInt(profileData.socialbuAccountId),
        platform: profileData.platform,
        is_active: true,
      })

      if (error) throw error

      // Refresh profiles in context
      await refreshProfiles()

      // Success! Go to step 2
      setStep(2)
    } catch (error) {
      console.error('Error creating profile:', error)
      alert('Failed to create profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingAccounts) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // Step 1: Create Profile
  if (step === 1) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-white mb-2">Create your first profile</h1>
            <p className="text-sm text-zinc-500">
              Connect a SocialBu account to start managing content
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Select SocialBu Account */}
            <div>
              <Label className="text-zinc-300">SocialBu Account *</Label>
              <Select onValueChange={handleAccountSelect} value={profileData.socialbuAccountId}>
                <SelectTrigger className="mt-1.5 bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {socialBuAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      <div className="flex items-center gap-2">
                        {account.type === 'instagram' && <Instagram className="h-4 w-4" />}
                        {account.type === 'twitter' && <Twitter className="h-4 w-4" />}
                        <span>{account.name} (@{account.username})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {socialBuAccounts.length === 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  No SocialBu accounts found. Please connect accounts in SocialBu first.
                </p>
              )}
            </div>

            {/* Profile Name */}
            <div>
              <Label htmlFor="name" className="text-zinc-300">
                Profile Name *
              </Label>
              <Input
                id="name"
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
                placeholder="e.g., Drexel Nightlife, SF Nightlife"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                This is how you'll identify this account in your dashboard
              </p>
            </div>

            {/* Handle (Optional) */}
            <div>
              <Label htmlFor="handle" className="text-zinc-300">
                Handle
              </Label>
              <Input
                id="handle"
                type="text"
                value={profileData.handle}
                onChange={(e) => setProfileData({ ...profileData, handle: e.target.value })}
                className="mt-1.5 bg-zinc-900 border-zinc-800 text-white"
                placeholder="@drexelnightlife"
              />
            </div>

            {/* Platform Display */}
            {profileData.platform && (
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-sm text-zinc-400 mb-1">Platform</p>
                <p className="text-white capitalize font-medium">{profileData.platform}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !profileData.socialbuAccountId || !profileData.name}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating profile...
                </>
              ) : (
                'Create Profile'
              )}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // Step 2: Success
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="h-8 w-8 text-violet-400" />
        </div>
        
        <h1 className="text-2xl font-semibold text-white mb-2">You're all set!</h1>
        <p className="text-zinc-400 mb-8">
          Your profile has been created. Start discovering and curating nightlife content.
        </p>

        <Button
          onClick={() => router.push('/')}
          className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
        >
          Go to Dashboard
        </Button>
      </Card>
    </div>
  )
}

