'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard } from '@/components/event-card'
import { Clock, RefreshCw, Image, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EventDiscovery } from '@/types/database'
import { useProfileFetch } from '@/hooks/use-profile-fetch'

type FilterType = 'all' | 'posts' | 'reels'

export default function PendingPage() {
  const { fetchWithProfile, profileId, currentProfile } = useProfileFetch()
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!profileId) return
    try {
      const res = await fetchWithProfile('/api/events?status=pending')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchWithProfile, profileId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchEvents()
  }

  const handleApprove = async (id: string, caption: string, scheduledFor: Date) => {
    // Prevent multiple simultaneous approvals
    if (processingId) {
      console.log('Another post is being processed, please wait...')
      return
    }

    setProcessingId(id)

    // Remove from pending list immediately (optimistic UI)
    setEvents((prev) => prev.filter((e) => e.id !== id))

    try {
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
        // Restore the event on error
        await fetchEvents()
        return
      }

      // Then, schedule to SocialBu using the profile's linked account
      if (currentProfile?.socialbu_account_id) {
        const scheduleRes = await fetch('/api/socialbu-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: id,
            accountIds: [currentProfile.socialbu_account_id],
          }),
        })

        const scheduleData = await scheduleRes.json()
        
        if (!scheduleData.success) {
          console.error('Failed to schedule to SocialBu:', scheduleData.error)
          alert(`Post approved but failed to schedule: ${scheduleData.error}. You can reschedule later.`)
          return
        }
      } else {
        console.warn('No SocialBu account linked to profile. Event approved but not scheduled.')
      }
    } finally {
      setProcessingId(null)
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

  // Filter events based on selected type
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    if (filter === 'posts') return event.post_type !== 'reel'
    if (filter === 'reels') return event.post_type === 'reel'
    return true
  })

  // Count by type
  const postsCount = events.filter(e => e.post_type !== 'reel').length
  const reelsCount = events.filter(e => e.post_type === 'reel').length

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
            {events.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                filter === 'all'
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilter('posts')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                filter === 'posts'
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Image className="h-3.5 w-3.5" />
              Posts ({postsCount})
            </button>
            <button
              onClick={() => setFilter('reels')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                filter === 'reels'
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Film className="h-3.5 w-3.5" />
              Reels ({reelsCount})
            </button>
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
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            {filter === 'reels' ? (
              <Film className="h-8 w-8 text-zinc-600" />
            ) : filter === 'posts' ? (
              <Image className="h-8 w-8 text-zinc-600" />
            ) : (
              <Clock className="h-8 w-8 text-zinc-600" />
            )}
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">
            {filter === 'all' ? 'All caught up!' : `No ${filter} pending`}
          </h3>
          <p className="text-zinc-500">
            {filter === 'all' 
              ? 'No pending posts to review right now.'
              : `Try switching to a different filter.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
              disabled={processingId !== null && processingId !== event.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
