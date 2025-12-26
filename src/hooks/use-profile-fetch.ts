import { useAuth } from '@/contexts/auth-context'

/**
 * Hook to automatically include profile_id in fetch requests
 */
export function useProfileFetch() {
  const { currentProfile } = useAuth()

  const fetchWithProfile = async (url: string, options?: RequestInit) => {
    if (!currentProfile) {
      throw new Error('No profile selected')
    }

    // Add profile_id to URL
    const urlObj = new URL(url, window.location.origin)
    urlObj.searchParams.set('profile_id', currentProfile.id)

    return fetch(urlObj.toString(), options)
  }

  return { fetchWithProfile, profileId: currentProfile?.id, currentProfile }
}
