'use client'

import { useState, useEffect, memo } from 'react'
import Image from 'next/image'
import { format, setHours, setMinutes } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { TimeInput } from '@/components/ui/time-input'
import { MediaViewerModal } from '@/components/ui/media-viewer-modal'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Check, X, Sparkles, Wand2, Loader2, Film, Images } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDiscovery } from '@/types/database'

interface EventCardProps {
  event: EventDiscovery
  onApprove: (id: string, caption: string, scheduledFor: Date) => Promise<void>
  onDiscard: (id: string) => Promise<void>
  onUpdate?: (id: string, updates: Partial<EventDiscovery>) => Promise<void>
  disabled?: boolean
}

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

export const EventCard = memo(function EventCard({ event, onApprove, onDiscard, disabled = false }: EventCardProps) {
  const [caption, setCaption] = useState(event.final_caption || event.ai_generated_caption || '')
  const [context, setContext] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    event.scheduled_for ? new Date(event.scheduled_for) : undefined
  )
  const [timeValue, setTimeValue] = useState<string>(
    event.scheduled_for
      ? format(new Date(event.scheduled_for), 'h:mm a').toUpperCase()
      : '12:00 PM'
  )
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false)
  const [captionStats, setCaptionStats] = useState<{
    minRecommended: number
    maxRecommended: number
    avgLength: number
  } | null>(null)

  const mediaUrls = event.media_urls || []
  const hasMultipleImages = mediaUrls.length > 1
  const hasAiCaption = !!event.ai_generated_caption

  // Fix: Move fetch to useEffect to prevent render-phase side effects
  useEffect(() => {
    fetch('/api/caption-stats')
      .then(res => res.json())
      .then(data => setCaptionStats(data))
      .catch(console.error)
  }, [])

  const captionLength = caption.length
  const isWithinRange = captionStats 
    ? captionLength >= captionStats.minRecommended && captionLength <= captionStats.maxRecommended
    : true
  const lengthColor = !captionStats 
    ? 'text-zinc-500'
    : isWithinRange 
      ? 'text-green-400' 
      : captionLength < captionStats.minRecommended 
        ? 'text-amber-400' 
        : 'text-red-400'


  const handleGenerateCaption = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          context: context.trim() || undefined,
        }),
      })

      const data = await response.json()
      
      if (data.success && data.caption) {
        setCaption(data.caption)
      } else {
        console.error('Failed to generate caption:', data.error)
        alert('Failed to generate caption. Please try again.')
      }
    } catch (error) {
      console.error('Generate caption error:', error)
      alert('Failed to generate caption. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedDate) {
      alert('Please select a date to schedule')
      return
    }
    
    const { hours, minutes } = parse12hTime(timeValue)
    const scheduledDateTime = setMinutes(setHours(selectedDate, hours), minutes)
    
    setIsLoading(true)
    try {
      // Track caption edits for RL
      // Compare against AI caption if available, otherwise against original caption
      const previousCaption = event.ai_generated_caption || event.original_caption || ''
      if (previousCaption && caption.trim() !== previousCaption.trim()) {
        fetch('/api/track-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            aiCaption: previousCaption,
            userCaption: caption,
            context: context || undefined,
          }),
        }).catch(console.error) // Fire and forget
      }
      
      await onApprove(event.id, caption, scheduledDateTime)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDiscard = async () => {
    setIsLoading(true)
    try {
      await onDiscard(event.id)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Card className="border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors duration-200 h-full">
        <div className="grid grid-cols-[120px_1fr_200px] gap-3 p-3 items-stretch">
          <div 
            className="relative w-full h-[160px] rounded-md overflow-hidden bg-black cursor-pointer group"
            onClick={() => mediaUrls.length > 0 && setIsMediaViewerOpen(true)}
          >
            {mediaUrls.length > 0 ? (
              <>
                <Image
                  src={mediaUrls[0]}
                  alt={`Post from @${event.source_account}`}
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                  unoptimized
                  loading="lazy"
                  sizes="120px"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-full">
                    View
                  </div>
                </div>
                {/* Multiple images indicator */}
                {hasMultipleImages && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Images className="h-3 w-3" />
                    {mediaUrls.length}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
                No image
              </div>
            )}
          </div>

        <div className="flex flex-col gap-2 h-full">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>@{event.source_account}</span>
            {event.post_type === 'reel' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/50 text-violet-400">
                <Film className="h-2.5 w-2.5 mr-1" />
                Reel
              </Badge>
            )}
            {event.post_type === 'carousel' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-400">
                <Images className="h-2.5 w-2.5 mr-1" />
                Carousel
              </Badge>
            )}
            {event.posted_at_source && (
              <span className="text-zinc-600">• {format(new Date(event.posted_at_source), 'MMM d')}</span>
            )}
          </div>

          <div className="text-[12px] text-zinc-500 leading-relaxed">
            {event.original_caption || 'No caption'}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Sparkles className="h-3 w-3" />
              <span>AI caption</span>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Refine the caption..."
              className="h-[110px] bg-zinc-900 border border-zinc-800 text-sm text-white leading-relaxed p-3 rounded-md focus:border-violet-500/60 focus:ring-0"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              {captionStats && (
                <span>
                  {captionStats.minRecommended}-{captionStats.maxRecommended}
                </span>
              )}
              <span className={cn("px-2 py-0.5 rounded bg-zinc-900", lengthColor)}>
                {caption.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional context"
              className="h-8 text-xs bg-zinc-900 border border-zinc-800 flex-1 focus:border-violet-500/60 focus:ring-0"
            />
            <Button
              onClick={handleGenerateCaption}
              disabled={isGenerating}
              size="sm"
              className="h-8 px-3 bg-violet-600 hover:bg-violet-500"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-stretch justify-end h-full">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left h-9 text-sm bg-zinc-900 border border-zinc-800',
                  !selectedDate && 'text-zinc-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-950 border border-zinc-800" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date)
                    setCalendarOpen(false)
                  }
                }}
                initialFocus
                disabled={(date) => {
                  // Allow today and future dates
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return date < today
                }}
              />
            </PopoverContent>
          </Popover>

          <TimeInput
            value={timeValue}
            onChange={setTimeValue}
            minMinutesFromNow={20}
          />

          <Button
            onClick={handleApprove}
            disabled={isLoading || disabled || !selectedDate || !caption.trim()}
            size="sm"
            className="w-full h-9 text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : disabled ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Approve & Schedule
              </>
            )}
          </Button>
          
          <Button
            onClick={handleDiscard}
            disabled={isLoading || disabled}
            size="sm"
            variant="outline"
            className="w-full h-9 text-sm border border-zinc-800 text-red-400 hover:border-red-500 hover:text-red-300 disabled:opacity-50"
          >
            <X className="h-4 w-4 mr-2" />
            Discard
          </Button>
        </div>
      </div>
    </Card>

    <MediaViewerModal
      isOpen={isMediaViewerOpen}
      onClose={() => setIsMediaViewerOpen(false)}
      mediaUrls={mediaUrls}
      initialIndex={0}
      isReel={event.post_type === 'reel'}
    />
  </>
  )
})
