'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface ProfileContextType {
  currentProfile: Profile | null
  profiles: Profile[]
  loading: boolean
  switchProfile: (profileId: string) => void
  refreshProfiles: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  // Load all profiles
  const loadProfiles = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const typedProfiles = (profilesData || []) as Profile[]
      setProfiles(typedProfiles)

      // Set current profile from localStorage or first profile
      const savedProfileId = localStorage.getItem('currentProfileId')
      const profile = savedProfileId
        ? typedProfiles.find(p => p.id === savedProfileId)
        : typedProfiles[0]

      setCurrentProfile(profile || null)
    } catch (error) {
      console.error('Error loading profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initialize on mount
  useEffect(() => {
    loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    if (profile) {
      setCurrentProfile(profile)
      localStorage.setItem('currentProfileId', profileId)
    }
  }

  const refreshProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const typedProfiles = data as Profile[]
      setProfiles(typedProfiles)
      // If current profile was deleted, switch to first available
      if (currentProfile && !typedProfiles.find(p => p.id === currentProfile.id)) {
        setCurrentProfile(typedProfiles[0] || null)
        if (typedProfiles[0]) {
          localStorage.setItem('currentProfileId', typedProfiles[0].id)
        } else {
          localStorage.removeItem('currentProfileId')
        }
      }
    }
  }

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        profiles,
        loading,
        switchProfile,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
