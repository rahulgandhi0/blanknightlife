'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format, setHours, setMinutes } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

// Generate time slots in 15-minute intervals
const timeSlots = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4)
  const minutes = (i % 4) * 15
  return {
    value: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    label: format(setMinutes(setHours(new Date(), hours), minutes), 'h:mm a')
  }
})

export function EventCard({ event, onApprove, onDiscard }: EventCardProps) {
  const [caption, setCaption] = useState(event.final_caption || event.ai_generated_caption || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    event.scheduled_for ? new Date(event.scheduled_for) : undefined
  )
  const [selectedTime, setSelectedTime] = useState<string>(
    event.scheduled_for 
      ? format(new Date(event.scheduled_for), 'HH:mm')
      : '12:00'
  )
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const mediaUrls = event.media_urls || []
  const hasMultipleImages = mediaUrls.length > 1

  const handleApprove = async () => {
    if (!selectedDate) {
      alert('Please select a date to schedule')
      return
    }
    setIsLoading(true)
    try {
      // Combine date and time
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const scheduledDateTime = setMinutes(setHours(selectedDate, hours), minutes)
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

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % mediaUrls.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length)
  }

  return (
    <Card className="overflow-hidden bg-zinc-900/80 border-zinc-800 backdrop-blur">
      <div className="flex gap-5 p-4">
        {/* Left: Image */}
        <div className="relative w-44 h-44 flex-shrink-0 rounded-xl overflow-hidden bg-black shadow-lg">
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
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {mediaUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full transition-all',
                          idx === currentImageIndex ? 'bg-white w-3' : 'bg-white/50'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* Carousel badge */}
              {event.post_type === 'carousel' && (
                <Badge className="absolute top-2 right-2 bg-violet-500 text-white border-0 text-[10px] px-1.5">
                  {mediaUrls.length}
                </Badge>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
              No image
            </div>
          )}
        </div>

        {/* Middle: Caption */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0 text-xs font-medium">
              @{event.source_account}
            </Badge>
            {event.posted_at_source && (
              <span className="text-xs text-zinc-500">
                {format(new Date(event.posted_at_source), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs text-zinc-400 font-medium">AI Generated Caption</span>
          </div>
          
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="flex-1 min-h-[100px] bg-zinc-800/50 border-zinc-700 text-white resize-none text-sm p-3 rounded-lg"
          />
          <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">{caption.length} characters</p>
        </div>

        {/* Right: Schedule & Actions */}
        <div className="flex flex-col gap-3 w-44 flex-shrink-0">
          {/* Date Picker */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-zinc-800/50 border-zinc-700 h-9 text-sm',
                    !selectedDate && 'text-zinc-500'
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">Time</label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 h-9 text-sm">
                <Clock className="mr-2 h-3.5 w-3.5 text-zinc-400" />
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value} className="text-sm">
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <Button
            onClick={handleApprove}
            disabled={isLoading || !selectedDate}
            size="sm"
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 h-10 text-sm font-medium shadow-lg shadow-violet-500/20"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Approve
          </Button>
          
          <Button
            onClick={handleDiscard}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="w-full bg-zinc-800/50 border-zinc-700 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 h-9 text-sm transition-colors"
          >
            <X className="h-4 w-4 mr-1.5" />
            Discard
          </Button>
        </div>
      </div>
    </Card>
  )
}
