'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard } from '@/components/event-card'
import { Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EventDiscovery } from '@/types/database'

export default function PendingPage() {
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?status=pending')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchEvents()
  }

  const handleApprove = async (id: string, caption: string, scheduledFor: Date) => {
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: {
          status: 'scheduled',
          final_caption: caption,
          scheduled_for: scheduledFor.toISOString(),
        },
      }),
    })

    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
    }
  }

  const handleDiscard = async (id: string) => {
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: { status: 'discarded' },
      }),
    })

    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-4" />
          <div className="h-4 w-64 bg-zinc-800 rounded mb-8" />
          <div className="h-96 bg-zinc-900 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            Pending Review
          </h1>
          <p className="text-zinc-400">
            {events.length} post{events.length !== 1 ? 's' : ''} awaiting your approval
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="bg-zinc-900 border-zinc-800"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">All caught up!</h3>
          <p className="text-zinc-500">No pending posts to review right now.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}
    </div>
  )
}

