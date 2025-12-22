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
import {
  Calendar as CalendarIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Wand2,
  Loader2
} from 'lucide-react'
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

  const mediaUrls = event.media_urls || []
  const hasMultipleImages = mediaUrls.length > 1
  const hasAiCaption = !!event.ai_generated_caption

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
    
    setIsLoading(true)
    try {
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

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % mediaUrls.length)
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length)

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800/60 backdrop-blur-sm hover:border-zinc-700/70 transition-all">
      <div className="grid grid-cols-[180px_1fr_200px] gap-5 p-4 items-stretch min-h-[240px]">
        {/* Left: Image */}
        <div className="relative w-full h-full min-h-[200px] rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/5">
          {mediaUrls.length > 0 ? (
            <>
              <Image
                src={mediaUrls[currentImageIndex]}
                alt={`Post from @${event.source_account}`}
                fill
                className="object-cover"
                unoptimized
              />
              
              {hasMultipleImages && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/80 backdrop-blur flex items-center justify-center text-white hover:bg-black transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/80 backdrop-blur flex items-center justify-center text-white hover:bg-black transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
                    {mediaUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          idx === currentImageIndex ? 'bg-white w-3' : 'bg-white/40 w-1.5'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {event.post_type === 'carousel' && (
                <Badge className="absolute top-2 right-2 bg-violet-500/90 backdrop-blur text-white border-0 text-[10px] px-1.5 py-0.5">
                  {mediaUrls.length}
                </Badge>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
              No image
            </div>
          )}
        </div>

        {/* Middle: Original + Context + Generated Caption */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200 border-0 text-xs font-medium px-2 py-0.5">
              @{event.source_account}
            </Badge>
            {event.posted_at_source && (
              <span className="text-[11px] text-zinc-500">
                {format(new Date(event.posted_at_source), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          {/* Original Caption (read-only) */}
          <div className="bg-zinc-800/30 rounded-lg p-2 border border-zinc-700/30">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Original</span>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-3 leading-relaxed">
              {event.original_caption || 'No caption'}
            </p>
          </div>

          {/* Context Input + Generate Button */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium mb-1 block">
                Add Context (optional)
              </label>
              <Input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., 'focus on the DJ name', 'mention sold out'"
                className="h-8 text-xs bg-zinc-800/50 border-zinc-700/50"
              />
            </div>
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

          {/* AI Generated / Editable Caption */}
          <div className="relative flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3 text-violet-400" />
              <span className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">
                {hasAiCaption ? 'AI Caption' : 'Caption'} (editable)
              </span>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={hasAiCaption ? 'Edit caption or regenerate...' : 'Click ✨ to generate, or write manually...'}
              className="h-full min-h-[70px] bg-zinc-800/50 border-zinc-700/50 text-white resize-none text-sm leading-relaxed p-2.5 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50"
            />
            <span className="absolute right-2 bottom-1.5 text-[10px] text-zinc-500 bg-zinc-900/80 px-1.5 py-0.5 rounded">
              {caption.length}
            </span>
          </div>
        </div>

        {/* Right: Schedule & Actions */}
        <div className="flex flex-col gap-3">
          {/* Date */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1 block">Date</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-zinc-800/50 border-zinc-700/50 h-9 text-sm',
                    !selectedDate && 'text-zinc-500'
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-zinc-400" />
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    setCalendarOpen(false)
                  }}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1 block">Time</label>
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                type="text"
                value={timeRaw || timeDisplay}
                onChange={(e) => handleTimeChange(e.target.value)}
                onBlur={handleTimeBlur}
                onKeyDown={handleTimeKeyDown}
                onFocus={() => setTimeRaw('')}
                placeholder="1430"
                className="w-full bg-zinc-800/50 border-zinc-700/50 h-9 text-sm pl-8 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <p className="text-[9px] text-zinc-600 mt-0.5">Type 24h (1430 → 2:30 PM)</p>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <Button
            onClick={handleApprove}
            disabled={isLoading || !selectedDate || !caption.trim()}
            size="sm"
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 h-9 text-sm font-semibold shadow-lg shadow-violet-500/20"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
          
          <Button
            onClick={handleDiscard}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="w-full bg-zinc-800/30 border-zinc-700/50 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 h-8 text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Discard
          </Button>
        </div>
      </div>
    </Card>
  )
}
