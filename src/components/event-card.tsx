'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format, setHours, setMinutes, parse } from 'date-fns'
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
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDiscovery } from '@/types/database'

interface EventCardProps {
  event: EventDiscovery
  onApprove: (id: string, caption: string, scheduledFor: Date) => Promise<void>
  onDiscard: (id: string) => Promise<void>
  onUpdate?: (id: string, updates: Partial<EventDiscovery>) => Promise<void>
}

export function EventCard({ event, onApprove, onDiscard }: EventCardProps) {
  const [caption, setCaption] = useState(event.final_caption || event.ai_generated_caption || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    event.scheduled_for ? new Date(event.scheduled_for) : undefined
  )
  const [dateOpen, setDateOpen] = useState(false)
  const [timeInput, setTimeInput] = useState<string>(
    event.scheduled_for
      ? format(new Date(event.scheduled_for), 'h:mm a')
      : '12:00 PM'
  )
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const mediaUrls = event.media_urls || []
  const hasMultipleImages = mediaUrls.length > 1

  // Format arbitrary input into canonical `hh:mm AM/PM`
  const normalizeTimeInput = (value: string) => {
    const trimmed = value.trim().toLowerCase()
    const letters = trimmed.replace(/[^ap]/g, '')
    const digits = trimmed.replace(/[^0-9]/g, '')

    if (!digits) return ''

    // Extract hours/minutes from digits
    let hours = Number(digits.slice(0, 2) || '0')
    let minutes = Number(digits.slice(2, 4) || '0')

    // Clamp minutes
    minutes = Math.min(Math.max(minutes, 0), 59)

    // Determine meridiem
    let meridiem: 'AM' | 'PM'
    if (letters.startsWith('a')) meridiem = 'AM'
    else if (letters.startsWith('p')) meridiem = 'PM'
    else meridiem = hours >= 12 ? 'PM' : 'AM'

    // Convert to 12h display
    let displayHours = hours
    if (displayHours === 0) displayHours = 12
    else if (displayHours > 12) displayHours = displayHours - 12

    const paddedHours = displayHours.toString().padStart(2, '0')
    const paddedMinutes = minutes.toString().padStart(2, '0')

    return `${paddedHours}:${paddedMinutes} ${meridiem}`
  }

  const handleTimeInputChange = (value: string) => {
    const normalized = normalizeTimeInput(value)
    setTimeInput(normalized || value)
  }

  const handleTimeInputBlur = () => {
    if (!timeInput.trim()) {
      setTimeInput('12:00 PM')
      return
    }
    const normalized = normalizeTimeInput(timeInput)
    setTimeInput(normalized || '12:00 PM')
  }

  const handleApprove = async () => {
    if (!selectedDate) {
      alert('Please select a date to schedule')
      return
    }
    
    // Parse the time input
    try {
      const parsedTime = parse(timeInput, 'h:mm a', new Date())
      const scheduledDateTime = setMinutes(
        setHours(selectedDate, parsedTime.getHours()), 
        parsedTime.getMinutes()
      )
      
      setIsLoading(true)
      await onApprove(event.id, caption, scheduledDateTime)
    } catch (error) {
      alert('Invalid time format. Please use format like "2:30 PM"')
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

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % mediaUrls.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length)
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800/60 backdrop-blur-sm hover:border-zinc-700/70 transition-all">
      <div className="grid grid-cols-[180px_1fr_220px] gap-6 p-5 items-stretch min-h-[220px]">
        {/* Left: Image */}
        <div className="relative w-full h-full min-h-[180px] rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/5">
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/80 backdrop-blur flex items-center justify-center text-white hover:bg-black transition-all hover:scale-110"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/80 backdrop-blur flex items-center justify-center text-white hover:bg-black transition-all hover:scale-110"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
                    {mediaUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* Carousel badge */}
              {event.post_type === 'carousel' && (
                <Badge className="absolute top-3 right-3 bg-violet-500/90 backdrop-blur text-white border-0 text-xs px-2 py-0.5 shadow-lg">
                  {mediaUrls.length} photos
                </Badge>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
              No image
            </div>
          )}
        </div>

        {/* Middle: Caption */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200 border-0 text-sm font-medium px-2.5 py-1">
              @{event.source_account}
            </Badge>
            {event.posted_at_source && (
              <span className="text-xs text-zinc-500">
                {format(new Date(event.posted_at_source), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">AI Generated Caption</span>
          </div>

          <div className="relative flex-1 flex">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              className="flex-1 min-h-[120px] bg-zinc-800/50 border-zinc-700/50 text-white resize-none text-sm leading-relaxed p-3.5 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
            />
            <span className="absolute right-3 bottom-2 text-[11px] text-zinc-500 bg-zinc-900/70 px-2 py-0.5 rounded-full border border-zinc-800/60">
              {caption.length} chars
            </span>
          </div>
        </div>

        {/* Right: Schedule & Actions */}
        <div className="flex flex-col gap-4 w-52 flex-shrink-0">
          {/* Date Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Schedule Date
            </label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-zinc-800/50 border-zinc-700/50 h-11 text-sm hover:bg-zinc-800 hover:border-zinc-600 transition-all',
                    !selectedDate && 'text-zinc-500'
                  )}
                >
                  <CalendarIcon className="mr-2.5 h-4 w-4 text-zinc-400" />
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    setDateOpen(false)
                  }}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Input with optional dropdown trigger */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Time
            </label>
            <div className="relative flex items-center">
              <Clock className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                value={timeInput}
                onChange={(e) => handleTimeInputChange(e.target.value)}
                onBlur={handleTimeInputBlur}
                placeholder="12:45 AM"
                className="w-full bg-zinc-800/50 border-zinc-700/50 h-11 text-sm pl-10 pr-10 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="absolute right-2 h-7 w-7 rounded-full bg-zinc-800/70 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700/70 transition-all"
                    aria-label="Open time options"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-36 p-2 bg-zinc-900 border-zinc-800 max-h-64 overflow-y-auto">
                  {['12:00 AM','12:15 AM','12:30 AM','12:45 AM','1:00 AM','1:15 AM','1:30 AM','1:45 AM','2:00 AM','2:15 AM','2:30 AM','2:45 AM','3:00 AM','3:15 AM','3:30 AM','3:45 AM','4:00 AM','4:15 AM','4:30 AM','4:45 AM','5:00 AM','5:15 AM','5:30 AM','5:45 AM','6:00 AM','6:15 AM','6:30 AM','6:45 AM','7:00 AM','7:15 AM','7:30 AM','7:45 AM','8:00 AM','8:15 AM','8:30 AM','8:45 AM','9:00 AM','9:15 AM','9:30 AM','9:45 AM','10:00 AM','10:15 AM','10:30 AM','10:45 AM','11:00 AM','11:15 AM','11:30 AM','11:45 AM','12:00 PM','12:15 PM','12:30 PM','12:45 PM','1:00 PM','1:15 PM','1:30 PM','1:45 PM','2:00 PM','2:15 PM','2:30 PM','2:45 PM','3:00 PM','3:15 PM','3:30 PM','3:45 PM','4:00 PM','4:15 PM','4:30 PM','4:45 PM','5:00 PM','5:15 PM','5:30 PM','5:45 PM','6:00 PM','6:15 PM','6:30 PM','6:45 PM','7:00 PM','7:15 PM','7:30 PM','7:45 PM','8:00 PM','8:15 PM','8:30 PM','8:45 PM','9:00 PM','9:15 PM','9:30 PM','9:45 PM','10:00 PM','10:15 PM','10:30 PM','10:45 PM','11:00 PM','11:15 PM','11:30 PM','11:45 PM'].map((slot) => (
                    <button
                      key={slot}
                      className={cn(
                        'w-full text-left text-sm px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors',
                        timeInput === slot && 'bg-zinc-800 text-white'
                      )}
                      onClick={() => setTimeInput(slot)}
                      type="button"
                    >
                      {slot}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[10px] text-zinc-600 ml-1">Type or choose (e.g., 12:45 AM)</p>
          </div>

          <div className="flex-1" />

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleApprove}
              disabled={isLoading || !selectedDate}
              className="col-span-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 h-11 text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve & Schedule
            </Button>
            <Button
              onClick={handleDiscard}
              disabled={isLoading}
              variant="outline"
              className="col-span-2 bg-zinc-800/30 border-zinc-700/50 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 h-10 text-sm font-medium transition-all"
            >
              <X className="h-4 w-4 mr-2" />
              Discard
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
