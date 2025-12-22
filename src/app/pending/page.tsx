'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard } from '@/components/event-card'
import { Clock, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EventDiscovery } from '@/types/database'

export default function PendingPage() {
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedEvent, setSelectedEvent] = useState<EventDiscovery | null>(null)

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
        <div className="flex items-center gap-4">
          <Clock className="h-8 w-8 text-amber-500 flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Pending Review
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              {events.length} post{events.length !== 1 ? 's' : ''} awaiting your approval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="bg-zinc-900 border-zinc-800 flex-shrink-0"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">All caught up!</h3>
          <p className="text-zinc-500">No pending posts to review right now.</p>
        </div>
      ) : viewMode === 'list' ? (
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
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all overflow-hidden text-left"
            >
              <div className="relative w-full aspect-[4/5] overflow-hidden">
                {event.media_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.media_urls[0]}
                    alt={`Post from @${event.source_account}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm bg-black/40">
                    No image
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">@{event.source_account}</span>
                  <span className="text-[11px] text-zinc-500">
                    {event.posted_at_source ? new Date(event.posted_at_source).toLocaleDateString() : ''}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
                  Pending
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Drawer overlay for grid view */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center overflow-auto p-6">
          <div className="max-w-5xl w-full">
            <div className="flex justify-end mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="bg-zinc-900 border-zinc-800"
              >
                Close
              </Button>
            </div>
            <EventCard
              event={selectedEvent}
              onApprove={handleApprove}
              onDiscard={(id) => {
                handleDiscard(id)
                setSelectedEvent(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

