'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Calendar, Clock, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { EventDiscovery } from '@/types/database'
import { useProfileFetch } from '@/hooks/use-profile-fetch'

export default function ScheduledPage() {
  const { fetchWithProfile, profileId } = useProfileFetch()
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    if (!profileId) return
    try {
      const res = await fetchWithProfile('/api/events?status=scheduled')
      const data = await res.json()
      // Sort by scheduled_for date
      const sorted = (data.events || []).sort((a: EventDiscovery, b: EventDiscovery) => {
        return new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()
      })
      setEvents(sorted)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchWithProfile, profileId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleUnschedule = async (id: string) => {
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: { status: 'pending', scheduled_for: null },
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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-violet-500" />
          Scheduled Posts
        </h1>
        <p className="text-zinc-400">
          {events.length} post{events.length !== 1 ? 's' : ''} in the queue
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No scheduled posts</h3>
          <p className="text-zinc-500">Approve pending posts to add them to the queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="p-4 bg-zinc-900 border-zinc-800">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-black flex-shrink-0">
                  {event.media_urls?.[0] && (
                    <Image
                      src={event.media_urls[0]}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-300">@{event.source_account}</span>
                    {event.post_type === 'carousel' && (
                      <Badge variant="secondary" className="text-xs">Carousel</Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 truncate">
                    {event.final_caption?.slice(0, 80)}...
                  </p>
                </div>

                {/* Schedule time */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-violet-400 mb-0.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">
                      {event.scheduled_for ? format(new Date(event.scheduled_for), 'MMM d') : 'Not set'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">
                    {event.scheduled_for ? format(new Date(event.scheduled_for), 'h:mm a') : ''}
                  </p>
                </div>

                {/* Unschedule */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnschedule(event.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

