'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { EventDiscovery } from '@/types/database'

export default function ArchivedPage() {
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      // Fetch both archived and discarded
      const [archived, discarded] = await Promise.all([
        fetch('/api/events?status=archived').then(r => r.json()),
        fetch('/api/events?status=discarded').then(r => r.json()),
      ])
      setEvents([...(archived.events || []), ...(discarded.events || [])])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleRestore = async (id: string) => {
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: { status: 'pending' },
      }),
    })

    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this post?')) return

    const res = await fetch(`/api/events?id=${id}`, {
      method: 'DELETE',
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
              <div key={i} className="h-20 bg-zinc-900 rounded-lg" />
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
          <Archive className="h-8 w-8 text-zinc-500" />
          Archived
        </h1>
        <p className="text-zinc-400">
          {events.length} archived/discarded post{events.length !== 1 ? 's' : ''}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Archive className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">Nothing archived</h3>
          <p className="text-zinc-500">Discarded and archived posts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="p-4 bg-zinc-900 border-zinc-800">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-black flex-shrink-0 opacity-60">
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
                    <span className="text-sm text-zinc-400">@{event.source_account}</span>
                    <Badge 
                      variant="secondary" 
                      className={event.status === 'discarded' ? 'bg-red-500/10 text-red-400' : ''}
                    >
                      {event.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-600 truncate">
                    {event.original_caption?.slice(0, 60)}...
                  </p>
                </div>

                {/* Date */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-zinc-600">
                    {event.created_at ? format(new Date(event.created_at), 'MMM d, yyyy') : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestore(event.id)}
                    className="text-zinc-500 hover:text-emerald-400"
                    title="Restore to pending"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(event.id)}
                    className="text-zinc-500 hover:text-red-400"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

