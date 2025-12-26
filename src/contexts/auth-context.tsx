'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { User, Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  currentProfile: Profile | null
  profiles: Profile[]
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  switchProfile: (profileId: string) => Promise<void>
  refreshProfiles: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  // Load user and profiles
  const loadUser = async (supabaseUser: SupabaseUser) => {
    try {
      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single()

      if (userError) throw userError

      setUser(userData)
      setSupabaseUser(supabaseUser)

      // Get user's profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      setProfiles(profilesData || [])

      // Set current profile from localStorage or first profile
      const savedProfileId = localStorage.getItem('currentProfileId')
      const profile = savedProfileId
        ? profilesData?.find(p => p.id === savedProfileId)
        : profilesData?.[0]

      setCurrentProfile(profile || null)
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user)
      } else {
        setUser(null)
        setSupabaseUser(null)
        setCurrentProfile(null)
        setProfiles([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
          },
        },
      })

      if (error) return { error }

      // Check if email confirmation is required
      // If user is null but no error, email confirmation is enabled
      const needsEmailConfirmation = !data.user && !error

      // User record is auto-created by database trigger (if email confirmation is disabled)
      return { error: null, needsEmailConfirmation }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return { error: error ? error : null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('currentProfileId')
  }

  const switchProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    if (profile) {
      setCurrentProfile(profile)
      localStorage.setItem('currentProfileId', profileId)
    }
  }

  const refreshProfiles = async () => {
    if (!supabaseUser) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setProfiles(data)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        currentProfile,
        profiles,
        loading,
        signUp,
        signIn,
        signOut,
        switchProfile,
        refreshProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

