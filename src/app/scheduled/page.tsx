'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { format, setHours, setMinutes } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Trash2, Send, Pencil, RefreshCw, AlertTriangle, CheckCircle2, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { TimeInput } from '@/components/ui/time-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { EventDiscovery } from '@/types/database'
import { useProfileFetch } from '@/hooks/use-profile-fetch'

function parse12hTime(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return { hours: 12, minutes: 0 }
  
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  
  return { hours, minutes }
}

export default function ScheduledPage() {
  const { fetchWithProfile, profileId, currentProfile } = useProfileFetch()
  const [events, setEvents] = useState<EventDiscovery[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; message?: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState<Date | undefined>()
  const [editTime, setEditTime] = useState('12:00 PM')
  const [editCaption, setEditCaption] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Sync with SocialBu - marks past scheduled posts as posted
  const syncWithSocialBu = useCallback(async (showResult = false) => {
    if (!profileId) return
    setSyncing(true)
    try {
      const res = await fetch('/api/socialbu-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      })
      const data = await res.json()
      if (showResult && data.synced > 0) {
        setSyncResult({ synced: data.synced, message: data.message })
        setTimeout(() => setSyncResult(null), 3000)
      }
      return data.synced || 0
    } catch (error) {
      console.error('Sync failed:', error)
      return 0
    } finally {
      setSyncing(false)
    }
  }, [profileId])

  const fetchEvents = useCallback(async () => {
    if (!profileId) return
    try {
      // Fetch both scheduled and approved events
      const [scheduledRes, approvedRes] = await Promise.all([
        fetchWithProfile('/api/events?status=scheduled'),
        fetchWithProfile('/api/events?status=approved'),
      ])
      const [scheduledData, approvedData] = await Promise.all([
        scheduledRes.json(),
        approvedRes.json(),
      ])
      
      const allEvents = [...(scheduledData.events || []), ...(approvedData.events || [])]
      
      // Sort by scheduled_for date
      const sorted = allEvents.sort((a: EventDiscovery, b: EventDiscovery) => {
        return new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()
      })
      setEvents(sorted)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchWithProfile, profileId])

  // Sync individual event with SocialBu
  const syncEventWithSocialBu = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/socialbu-get-post?eventId=${eventId}`)
      const data = await res.json()
      
      if (data.success && data.event) {
        // Update local state with SocialBu data
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId 
              ? { 
                  ...e, 
                  scheduled_for: data.event.scheduled_for,
                  final_caption: data.event.final_caption,
                } 
              : e
          ).sort((a, b) => 
            new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()
          )
        )
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to sync event with SocialBu:', error)
      return false
    }
  }, [])

  // Sync only the next 5 upcoming scheduled events with SocialBu to avoid N+1 API flood
  // The postback_url webhook handles real-time status updates, so aggressive polling is unnecessary
  const syncAllWithSocialBu = useCallback(async () => {
    const scheduledEvents = events.filter(e => e.socialbu_post_id && e.status === 'scheduled')
    
    if (scheduledEvents.length === 0) return

    // OPTIMIZATION: Only sync the next 5 upcoming posts to reduce API load
    // Sort by scheduled_for and take the first 5
    const upcomingEvents = scheduledEvents
      .sort((a, b) => {
        const dateA = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0
        const dateB = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0
        return dateA - dateB
      })
      .slice(0, 5)

    if (upcomingEvents.length === 0) return

    console.log(`Syncing next ${upcomingEvents.length} upcoming events with SocialBu (out of ${scheduledEvents.length} total)...`)
    
    const results = await Promise.allSettled(
      upcomingEvents.map(event => syncEventWithSocialBu(event.id))
    )
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length
    console.log(`Synced ${successCount}/${upcomingEvents.length} events with SocialBu`)
    
    // Note: We rely on the postback_url webhook for real-time status updates.
    // This limited sync is just a safety check for the most imminent posts.
  }, [events, syncEventWithSocialBu])

  // Fetch events on mount and sync with SocialBu
  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  // Sync with SocialBu after events are loaded
  useEffect(() => {
    if (events.length > 0 && !loading) {
      syncAllWithSocialBu()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      // Use the bulk sync API to check for posted posts
      const syncedCount = await syncWithSocialBu(true)
      
      // Refresh the events list
      await fetchEvents()
      
      if (syncedCount > 0) {
        setSyncResult({ 
          synced: syncedCount, 
          message: `Marked ${syncedCount} post${syncedCount !== 1 ? 's' : ''} as posted` 
        })
      } else {
        setSyncResult({ 
          synced: 0, 
          message: 'All posts are up to date' 
        })
      }
      setTimeout(() => setSyncResult(null), 3000)
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncResult({ synced: 0, message: 'Sync failed' })
      setTimeout(() => setSyncResult(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

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

  const startEditing = (event: EventDiscovery) => {
    setEditingId(event.id)
    setEditCaption(event.final_caption || '')
    if (event.scheduled_for) {
      setEditDate(new Date(event.scheduled_for))
      setEditTime(format(new Date(event.scheduled_for), 'h:mm a').toUpperCase())
    } else {
      setEditDate(new Date())
      setEditTime('12:00 PM')
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditDate(undefined)
    setEditTime('12:00 PM')
    setEditCaption('')
  }

  const saveReschedule = async (id: string) => {
    if (!editDate) return

    const { hours, minutes } = parse12hTime(editTime)
    const scheduledDateTime = setMinutes(setHours(editDate, hours), minutes)

    // Find the event to check if it's already in SocialBu
    const event = events.find(e => e.id === id)
    
    // Determine if caption changed
    const captionChanged = editCaption.trim() !== (event?.final_caption || '').trim()
    
    // Update UI state immediately (optimistic update)
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id 
          ? { 
              ...e, 
              scheduled_for: scheduledDateTime.toISOString(),
              final_caption: editCaption.trim() || e.final_caption
            } 
          : e
      ).sort((a, b) => 
        new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()
      )
    )
    cancelEditing()

    try {
      // Update local database
      const localUpdates: { scheduled_for: string; final_caption?: string } = {
        scheduled_for: scheduledDateTime.toISOString()
      }
      if (captionChanged) {
        localUpdates.final_caption = editCaption.trim()
      }

      const localRes = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: localUpdates,
        }),
      })

      if (!localRes.ok) {
        throw new Error('Failed to update local database')
      }

      // If event is already scheduled in SocialBu, update it there too
      if (event?.socialbu_post_id || event?.meta_post_id) {
        console.log('Syncing update to SocialBu...', { 
          eventId: id, 
          socialbu_post_id: event.socialbu_post_id,
          newTime: scheduledDateTime.toISOString(),
          captionChanged 
        })
        
        const socialBuUpdates: { scheduledFor: string; finalCaption?: string } = {
          scheduledFor: scheduledDateTime.toISOString()
        }
        if (captionChanged) {
          socialBuUpdates.finalCaption = editCaption.trim()
        }

        const socialBuRes = await fetch('/api/socialbu-update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: id,
            ...socialBuUpdates,
          }),
        })

        const socialBuData = await socialBuRes.json()
        
        if (!socialBuData.success) {
          console.error('Failed to update SocialBu:', socialBuData.error)
          alert(`Warning: Updated locally but failed to sync with SocialBu: ${socialBuData.error}`)
        } else {
          console.log('✅ Successfully synced to SocialBu')
          // Show success feedback
          alert('✅ Updated successfully and synced to SocialBu!')
        }
      } else {
        console.log('ℹ️ Event not yet in SocialBu, skipping sync')
        alert('✅ Updated locally (will sync when sent to SocialBu)')
      }
    } catch (error) {
      console.error('Failed to save changes:', error)
      alert('Failed to save changes. Please try again.')
      // Revert optimistic update
      await fetchEvents()
    }
  }

  const markAsPosted = async (event: EventDiscovery) => {
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        updates: { 
          status: 'posted',
          posted_at: new Date().toISOString(),
        },
      }),
    })

    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== event.id))
    }
  }

  const sendToSocialBu = async (event: EventDiscovery) => {
    if (!currentProfile?.socialbu_account_id) {
      alert('No SocialBu account linked to this profile')
      return
    }

    setSendingId(event.id)
    try {
      const res = await fetch('/api/socialbu-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          accountIds: [currentProfile.socialbu_account_id],
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        // Update local state
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.id 
              ? { ...e, status: 'scheduled' as const, meta_post_id: data.post_id } 
              : e
          )
        )
      } else {
        alert(`Failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to send to SocialBu:', error)
      alert('Failed to send to SocialBu')
    } finally {
      setSendingId(null)
    }
  }

  const getEventStatus = (event: EventDiscovery) => {
    const now = new Date()
    const scheduledFor = event.scheduled_for ? new Date(event.scheduled_for) : null
    const isPast = scheduledFor && scheduledFor < now
    const hasSocialBuId = event.meta_post_id || event.socialbu_post_id

    if (event.status === 'scheduled' && hasSocialBuId) {
      if (isPast) {
        return { label: 'Should be posted', color: 'text-amber-400 border-amber-400/50', icon: AlertTriangle }
      }
      return { label: 'Queued in SocialBu', color: 'text-green-400 border-green-400/50', icon: CheckCircle2 }
    }
    
    if (event.status === 'approved') {
      if (isPast) {
        return { label: 'Missed - needs rescheduling', color: 'text-red-400 border-red-400/50', icon: AlertTriangle }
      }
      return { label: 'Not sent to SocialBu', color: 'text-amber-400 border-amber-400/50', icon: AlertTriangle }
    }

    return null
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
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-violet-500" />
            Scheduled Posts
          </h1>
          <p className="text-zinc-400">
            {events.length} post{events.length !== 1 ? 's' : ''} in the queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className="text-xs text-zinc-500">{syncResult.message}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={syncing}
            className="border-zinc-800"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <CalendarIcon className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No scheduled posts</h3>
          <p className="text-zinc-500">Approve pending posts to add them to the queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const status = getEventStatus(event)
            const isPast = event.scheduled_for && new Date(event.scheduled_for) < new Date()
            
            return (
              <Card 
                key={event.id} 
                className={cn(
                  "p-4 bg-zinc-900 border-zinc-800",
                  isPast && "border-l-2 border-l-amber-500"
                )}
              >
                {editingId === event.id ? (
                  // Expanded editing mode
                  <div className="space-y-3">
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
                        <p className="text-xs text-zinc-600">Editing post</p>
                      </div>
                    </div>

                    {/* Caption editor */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">Caption</label>
                      <textarea
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-md p-2 text-sm text-white resize-none focus:outline-none focus:border-violet-500"
                        placeholder="Edit caption..."
                      />
                    </div>

                    {/* Schedule controls */}
                    <div className="flex items-center gap-2">
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-[140px] justify-start text-left bg-zinc-800 border-zinc-700"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {editDate ? format(editDate, 'MMM d') : 'Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-zinc-950 border border-zinc-800" align="end">
                          <Calendar
                            mode="single"
                            selected={editDate}
                            onSelect={(date) => {
                              setEditDate(date)
                              setCalendarOpen(false)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <TimeInput
                        value={editTime}
                        onChange={setEditTime}
                        minMinutesFromNow={20}
                      />

                      <div className="flex-1" />

                      <Button size="sm" onClick={() => saveReschedule(event.id)} className="bg-violet-600 hover:bg-violet-500">
                        Save Changes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Compact display mode
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
                        {status && (
                          <Badge variant="outline" className={cn("text-xs", status.color)}>
                            <status.icon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 truncate">
                        {event.final_caption?.slice(0, 80)}...
                      </p>
                    </div>

                    {/* Schedule time */}
                    <div className="text-right flex-shrink-0">
                      <div className={cn(
                        "flex items-center gap-1.5 mb-0.5",
                        isPast ? "text-amber-400" : "text-violet-400"
                      )}>
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">
                          {event.scheduled_for ? format(new Date(event.scheduled_for), 'MMM d') : 'Not set'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600">
                        {event.scheduled_for ? format(new Date(event.scheduled_for), 'h:mm a') : ''}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Send to SocialBu button (only if not already sent) */}
                      {!event.meta_post_id && !event.socialbu_post_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sendToSocialBu(event)}
                          disabled={sendingId === event.id}
                          className="text-violet-400 hover:text-violet-300"
                          title="Send to SocialBu"
                        >
                          <Send className={cn("h-4 w-4", sendingId === event.id && "animate-pulse")} />
                        </Button>
                      )}

                      {/* Mark as Posted (for past-due posts) */}
                      {isPast && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsPosted(event)}
                          className="text-green-400 hover:text-green-300"
                          title="Mark as Posted"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Reschedule */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(event)}
                        className="text-zinc-400 hover:text-white"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Unschedule */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnschedule(event.id)}
                        className="text-zinc-500 hover:text-red-400"
                        title="Move back to Pending"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
