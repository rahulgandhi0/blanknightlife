'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Plus, CheckCircle2, Instagram, Twitter } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialBuAccount } from '@/lib/socialbu'

export function ProfileSwitcher() {
  const router = useRouter()
  const { currentProfile, profiles, switchProfile, refreshProfiles } = useAuth()
  const [open, setOpen] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<SocialBuAccount[]>([])
  const [socialLoading, setSocialLoading] = useState(false)
  const supabase = createClient()

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="h-4 w-4" />
      case 'twitter':
        return <Twitter className="h-4 w-4" />
      default:
        return null
    }
  }

  const handleSwitch = (profileId: string) => {
    switchProfile(profileId)
    setOpen(false)
    router.refresh()
  }

  const handleAddProfile = () => {
    setOpen(false)
    router.push('/profiles/new')
  }

  // If no profiles exist, preload SocialBu accounts so user can one-click create/select
  useEffect(() => {
    const loadSocialAccounts = async () => {
      if (profiles.length > 0) return
      setSocialLoading(true)
      try {
        const res = await fetch('/api/socialbu-accounts')
        const data = await res.json()
        if (data.success) {
          setSocialAccounts(data.accounts || [])
        }
      } catch (error) {
        console.error('Failed to load SocialBu accounts', error)
      } finally {
        setSocialLoading(false)
      }
    }
    loadSocialAccounts()
  }, [profiles.length])

  // One-click create profile from SocialBu account
  const createFromSocial = async (account: SocialBuAccount) => {
    try {
      const name = account.name || account.username || 'New Profile'
      const handle = account.username || account.name || ''
      const platform = (account.type as string) || 'instagram'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('profiles') as any)
        .insert({
          name,
          handle,
          socialbu_account_id: account.id,
          platform,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) throw error

      await refreshProfiles()
      if (data?.id) {
        switchProfile(data.id)
      }
      setOpen(false)
    } catch (error) {
      console.error('Failed to create profile from SocialBu account', error)
      alert('Failed to create profile. Please try again.')
    }
  }

  // No profile yet - show SocialBu accounts to pick from (one-click create), fallback to manual add
  if (!currentProfile) {
    return (
      <div className="w-full border-t border-zinc-800">
        <div className="p-3">
          <p className="text-xs font-medium text-zinc-400 mb-2">Select a profile</p>
          {socialLoading && (
            <p className="text-xs text-zinc-500">Loading SocialBu accounts…</p>
          )}
          {!socialLoading && socialAccounts.length > 0 && (
            <div className="space-y-1">
              {socialAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => createFromSocial(acc)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-zinc-200 hover:bg-zinc-900"
                >
                  <div className="h-8 w-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-xs">
                      {(acc.name || acc.username || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium truncate">@{acc.username || acc.name}</p>
                    <p className="text-xs text-zinc-500 truncate capitalize">
                      {acc.type || 'instagram'}
                    </p>
                  </div>
                  <span className="text-xs text-violet-400">Select</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={handleAddProfile}
          className="w-full p-4 border-t border-zinc-800 hover:bg-zinc-900 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Plus className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Add Profile</p>
              <p className="text-xs text-zinc-500">Connect a social account</p>
            </div>
          </div>
        </button>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full p-4 border-t border-zinc-800 hover:bg-zinc-900 transition-colors text-left">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {currentProfile.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">
                  {currentProfile.name}
                </p>
                {getPlatformIcon(currentProfile.platform)}
              </div>
              <p className="text-xs text-zinc-500 truncate capitalize">
                {currentProfile.platform}
              </p>
            </div>

            {/* Chevron */}
            <ChevronDown className={cn(
              "h-4 w-4 text-zinc-500 transition-transform flex-shrink-0",
              open && "rotate-180"
            )} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-64 p-2 bg-zinc-900 border-zinc-800" 
        align="start"
        side="top"
        sideOffset={8}
      >
        <div className="space-y-1">
          {/* Profile List */}
          <div className="space-y-1">
            <p className="px-3 py-1 text-xs font-medium text-zinc-400">Switch Profile</p>
            
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSwitch(profile.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  profile.id === currentProfile.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-xs">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{profile.name}</p>
                  <p className="text-xs text-zinc-500 truncate capitalize">{profile.platform}</p>
                </div>

                {profile.id === currentProfile.id && (
                  <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="h-px bg-zinc-800 my-2" />

          {/* Actions */}
          <button
            onClick={handleAddProfile}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Profile</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
