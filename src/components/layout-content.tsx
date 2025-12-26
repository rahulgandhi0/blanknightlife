'use client'

import { Sidebar } from '@/components/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  
  // Show loading screen while loading profiles
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <>
      <Sidebar />
      <main className="pl-64 min-h-screen">
        {children}
      </main>
    </>
  )
}
