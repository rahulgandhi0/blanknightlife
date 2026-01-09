'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Profile } from '@/types/database'

interface ProfileContextType {
  currentProfile: Profile | null
  profiles: Profile[]
  loading: boolean
  isAuthenticated: boolean
  authenticate: (pin: string) => boolean
  switchProfile: (profileId: string) => void
  refreshProfiles: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const CORRECT_PIN = '4482'
const AUTH_KEY = 'blanknightlife_auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Load all profiles
  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load profiles')

      const typedProfiles = (json.profiles || []) as Profile[]
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

  // Check authentication on mount
  useEffect(() => {
    const authStatus = sessionStorage.getItem(AUTH_KEY)
    if (authStatus === 'true') {
      setIsAuthenticated(true)
      loadProfiles()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const authenticate = (pin: string): boolean => {
    if (pin === CORRECT_PIN) {
      setIsAuthenticated(true)
      sessionStorage.setItem(AUTH_KEY, 'true')
      loadProfiles()
      return true
    }
    return false
  }

  const switchProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    if (profile) {
      setCurrentProfile(profile)
      localStorage.setItem('currentProfileId', profileId)
    }
  }

  const refreshProfiles = async () => {
    const res = await fetch('/api/profiles')
    const json = await res.json()
    if (!res.ok) return

    const typedProfiles = (json.profiles || []) as Profile[]
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

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        profiles,
        loading,
        isAuthenticated,
        authenticate,
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
