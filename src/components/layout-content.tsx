'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  
  // Pages that don't need sidebar or authentication
  const isAuthPage = pathname.startsWith('/auth/')
  
  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // Auth pages (no sidebar)
  if (isAuthPage) {
    return <>{children}</>
  }

  // Authenticated pages (with sidebar)
  if (user) {
    return (
      <>
        <Sidebar />
        <main className="pl-64 min-h-screen">
          {children}
        </main>
      </>
    )
  }

  // Unauthenticated - redirect happens in middleware
  return <>{children}</>
}

