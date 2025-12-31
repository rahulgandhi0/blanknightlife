'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format, setHours, setMinutes } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Check, X, Sparkles, Clock, Wand2, Loader2, Film, Images } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDiscovery } from '@/types/database'

interface EventCardProps {
  event: EventDiscovery
  onApprove: (id: string, caption: string, scheduledFor: Date) => Promise<void>
  onDiscard: (id: string) => Promise<void>
  onUpdate?: (id: string, updates: Partial<EventDiscovery>) => Promise<void>
}

// Convert 24h time string to 12h format
function formatTo12h(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 0) return '12:00 PM'
  
  let hours: number
  let minutes: number
  
  if (digits.length <= 2) {
    hours = parseInt(digits, 10)
    minutes = 0
  } else if (digits.length === 3) {
    hours = parseInt(digits.slice(0, 1), 10)
    minutes = parseInt(digits.slice(1), 10)
  } else {
    hours = parseInt(digits.slice(0, 2), 10)
    minutes = parseInt(digits.slice(2, 4), 10)
  }
  
  hours = Math.min(Math.max(hours, 0), 23)
  minutes = Math.min(Math.max(minutes, 0), 59)
  
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  let displayHours = hours % 12
  if (displayHours === 0) displayHours = 12
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${meridiem}`
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

export function EventCard({ event, onApprove, onDiscard }: EventCardProps) {
  const [caption, setCaption] = useState(event.final_caption || event.ai_generated_caption || '')
  const [context, setContext] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    event.scheduled_for ? new Date(event.scheduled_for) : undefined
  )
  const [timeDisplay, setTimeDisplay] = useState<string>(
    event.scheduled_for
      ? format(new Date(event.scheduled_for), 'h:mm a')
      : '12:00 PM'
  )
  const [timeRaw, setTimeRaw] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [captionStats, setCaptionStats] = useState<{
    minRecommended: number
    maxRecommended: number
    avgLength: number
  } | null>(null)

  const mediaUrls = event.media_urls || []
  const hasMultipleImages = mediaUrls.length > 1
  const hasAiCaption = !!event.ai_generated_caption

  useState(() => {
    fetch('/api/caption-stats')
      .then(res => res.json())
      .then(data => setCaptionStats(data))
      .catch(console.error)
  })

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

  const handleTimeChange = (value: string) => setTimeRaw(value)

  const handleTimeBlur = () => {
    if (timeRaw.trim()) {
      setTimeDisplay(formatTo12h(timeRaw))
    }
    setTimeRaw('')
  }

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTimeBlur()
      ;(e.target as HTMLInputElement).blur()
    }
  }

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
    
    const { hours, minutes } = parse12hTime(timeDisplay)
    const scheduledDateTime = setMinutes(setHours(selectedDate, hours), minutes)
    
    // 20-minute buffer validation
    const minScheduleTime = new Date()
    minScheduleTime.setMinutes(minScheduleTime.getMinutes() + 20)
    
    if (scheduledDateTime < minScheduleTime) {
      alert('Posts must be scheduled at least 20 minutes in the future')
      return
    }
    
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
    <Card className="border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors h-full">
      <div className="grid grid-cols-[120px_1fr_200px] gap-3 p-3 items-stretch">
        <div className="relative w-full h-[160px] rounded-md overflow-hidden bg-black">
          {mediaUrls.length > 0 ? (
            <Image
              src={mediaUrls[0]}
              alt={`Post from @${event.source_account}`}
              fill
              className="object-cover"
              unoptimized
            />
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
                  setSelectedDate(date)
                  setCalendarOpen(false)
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

          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              value={timeRaw || timeDisplay}
              onChange={(e) => handleTimeChange(e.target.value)}
              onBlur={handleTimeBlur}
              onKeyDown={handleTimeKeyDown}
              onFocus={() => setTimeRaw('')}
              placeholder="1430"
              className="w-full bg-zinc-900 border border-zinc-800 h-9 text-sm pl-10 focus:border-violet-500/60 focus:ring-0"
            />
          </div>

          <Button
            onClick={handleApprove}
            disabled={isLoading || !selectedDate || !caption.trim()}
            size="sm"
            className="w-full h-9 text-sm font-semibold bg-violet-600 hover:bg-violet-500"
          >
            <Check className="h-4 w-4 mr-2" />
            Approve & Schedule
          </Button>
          
          <Button
            onClick={handleDiscard}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="w-full h-9 text-sm border border-zinc-800 text-red-400 hover:border-red-500 hover:text-red-300"
          >
            <X className="h-4 w-4 mr-2" />
            Discard
          </Button>
        </div>
      </div>
    </Card>
  )
}
