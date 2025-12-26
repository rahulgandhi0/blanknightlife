'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronDown, Plus, Settings, LogOut, CheckCircle2, Instagram, Twitter } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProfileSwitcher() {
  const router = useRouter()
  const { user, currentProfile, profiles, switchProfile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user || !currentProfile) {
    return null
  }

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

  const handleSwitch = async (profileId: string) => {
    await switchProfile(profileId)
    setOpen(false)
    router.refresh()
  }

  const handleAddProfile = () => {
    setOpen(false)
    router.push('/profiles/new')
  }

  const handleSettings = () => {
    setOpen(false)
    router.push('/settings/account')
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
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
              <p className="text-xs text-zinc-500 truncate">
                {user.email}
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
          {/* Current User Info */}
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-zinc-400 mb-1">Signed in as</p>
            <p className="text-sm text-white font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>

          <div className="h-px bg-zinc-800 my-2" />

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

          <button
            onClick={handleSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Account Settings</span>
          </button>

          <div className="h-px bg-zinc-800 my-2" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

