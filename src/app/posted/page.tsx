'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Send, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EventDiscovery } from '@/types/database'
import { useProfileFetch } from '@/hooks/use-profile-fetch'

export default function PostedPage() {
  const { fetchWithProfile, profileId } = useProfileFetch()
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    if (!profileId) return
    try {
      const res = await fetchWithProfile('/api/events?status=posted')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchWithProfile, profileId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-4" />
          <div className="h-4 w-64 bg-zinc-800 rounded mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-zinc-900 rounded-lg" />
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
          <Send className="h-8 w-8 text-blue-500" />
          Posted
        </h1>
        <p className="text-zinc-400">
          {events.length} post{events.length !== 1 ? 's' : ''} published
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Send className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No posts yet</h3>
          <p className="text-zinc-500">Posts will appear here once they&apos;re published.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden bg-zinc-900 border-zinc-800 group">
              <div className="relative aspect-square">
                {event.media_urls?.[0] && (
                  <Image
                    src={event.media_urls[0]}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white/80 line-clamp-2">
                    {event.final_caption}
                  </p>
                </div>
                {event.post_type === 'carousel' && (
                  <Badge className="absolute top-2 right-2 bg-black/60 text-white text-xs">
                    Carousel
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">@{event.source_account}</span>
                  {event.meta_post_id && (
                    <a
                      href={`https://instagram.com/p/${event.meta_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {event.posted_at && (
                  <p className="text-xs text-zinc-600 mt-1">
                    {format(new Date(event.posted_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

