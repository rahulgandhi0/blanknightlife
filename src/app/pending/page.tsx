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
    // First, update the event with approved status and caption
    const updateRes = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: {
          status: 'approved',
          final_caption: caption,
          scheduled_for: scheduledFor.toISOString(),
        },
      }),
    })

    if (!updateRes.ok) {
      alert('Failed to approve event')
      return
    }

    // Then, schedule to SocialBu
    // Default to account IDs from env, or let user configure later
    const defaultAccountIds = process.env.NEXT_PUBLIC_SOCIALBU_DEFAULT_ACCOUNTS
      ? process.env.NEXT_PUBLIC_SOCIALBU_DEFAULT_ACCOUNTS.split(',').map(Number)
      : []

    if (defaultAccountIds.length > 0) {
      const scheduleRes = await fetch('/api/socialbu-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: id,
          accountIds: defaultAccountIds,
        }),
      })

      const scheduleData = await scheduleRes.json()
      
      if (!scheduleData.success) {
        console.error('Failed to schedule to SocialBu:', scheduleData.error)
        alert(`Post approved but failed to schedule: ${scheduleData.error}. You can reschedule from the Approved tab.`)
        return
      }
    } else {
      // No default accounts configured - just approve without scheduling to SocialBu
      console.warn('No SocialBu accounts configured. Event approved but not scheduled to SocialBu.')
    }

    // Remove from pending list
    setEvents((prev) => prev.filter((e) => e.id !== id))
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
    <div className="p-6">
      <div className="sticky top-0 z-10 flex items-center justify-between py-3 bg-zinc-950">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold leading-tight">Pending Review</h1>
          <p className="text-sm text-zinc-500">
            {events.length} post{events.length !== 1 ? 's' : ''} awaiting approval
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="h-9 px-3 text-sm border-zinc-800"
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

