'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8">
      <Card className="border border-red-900 bg-red-950/20 p-8 text-center max-w-md mx-auto">
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-red-400 mb-2">Something went wrong</h2>
        <p className="text-zinc-400 text-sm mb-6">{error.message}</p>
        <Button onClick={reset} className="bg-violet-600 hover:bg-violet-500">
          Try again
        </Button>
      </Card>
    </div>
  )
}

