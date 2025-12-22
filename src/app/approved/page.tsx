'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard } from '@/components/event-card'
import { CheckCircle2 } from 'lucide-react'
import type { EventDiscovery } from '@/types/database'

export default function ApprovedPage() {
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?status=approved')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          Approved
        </h1>
        <p className="text-zinc-400">
          {events.length} approved post{events.length !== 1 ? 's' : ''} ready to schedule
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No approved posts</h3>
          <p className="text-zinc-500">Approved posts that haven&apos;t been scheduled will appear here.</p>
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

