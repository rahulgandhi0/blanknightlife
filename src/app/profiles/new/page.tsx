'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Instagram, Twitter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SocialBuAccount } from '@/lib/socialbu'

export default function NewProfilePage() {
  const router = useRouter()
  const { user, profiles, refreshProfiles } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [socialBuAccounts, setSocialBuAccounts] = useState<SocialBuAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  
  const [profileData, setProfileData] = useState({
    name: '',
    handle: '',
    socialbuAccountId: '',
    platform: '' as 'instagram' | 'tiktok' | 'twitter' | '',
  })

  // Load available SocialBu accounts (exclude already connected ones)
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/socialbu-accounts')
        const data = await response.json()
        
        if (data.success) {
          // Filter out accounts already connected to this user's profiles
          const connectedIds = profiles.map(p => p.socialbu_account_id)
          const availableAccounts = data.accounts.filter(
            (acc: SocialBuAccount) => !connectedIds.includes(acc.id)
          )
          setSocialBuAccounts(availableAccounts)
        }
      } catch (error) {
        console.error('Error fetching accounts:', error)
      } finally {
        setLoadingAccounts(false)
      }
    }

    fetchAccounts()
  }, [profiles])

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
      const { error } = await supabase.from('profiles').insert({
        user_id: user.id,
        name: profileData.name,
        handle: profileData.handle,
        socialbu_account_id: parseInt(profileData.socialbuAccountId),
        platform: profileData.platform,
        is_active: true,
      })

      if (error) throw error

      await refreshProfiles()
      router.push('/')
    } catch (error) {
      console.error('Error creating profile:', error)
      alert('Failed to create profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="mb-6 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="border border-zinc-800 bg-zinc-950 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white mb-2">Add New Profile</h1>
            <p className="text-sm text-zinc-500">
              Connect another SocialBu account to manage multiple brands
            </p>
          </div>

          {loadingAccounts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : socialBuAccounts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400 mb-4">
                All your SocialBu accounts are already connected.
              </p>
              <Button
                onClick={() => window.open('https://socialbu.com', '_blank')}
                variant="outline"
                className="border-zinc-800"
              >
                Add More Accounts in SocialBu
              </Button>
            </div>
          ) : (
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
                  placeholder="e.g., NYC Nightlife, Miami Nightlife"
                  required
                />
              </div>

              {/* Handle */}
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
                  placeholder="@nycnightlife"
                />
              </div>

              {/* Platform Display */}
              {profileData.platform && (
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-1">Platform</p>
                  <p className="text-white capitalize font-medium">{profileData.platform}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading || !profileData.socialbuAccountId || !profileData.name}
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Profile'
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
          )}
        </Card>
      </div>
    </div>
  )
}

