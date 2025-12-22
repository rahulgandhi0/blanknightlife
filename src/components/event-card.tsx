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
  const [timeInput, setTimeInput] = useState<string>(
    event.scheduled_for 
      ? format(new Date(event.scheduled_for), 'h:mm a')
      : '12:00 PM'
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
    <Card className="overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-900/50 border-zinc-800/50 backdrop-blur-sm hover:border-zinc-700/50 transition-all">
      <div className="flex gap-6 p-5">
        {/* Left: Image */}
        <div className="relative w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/5">
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
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
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
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">AI Generated</span>
          </div>
          
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption here..."
            className="flex-1 min-h-[110px] bg-zinc-800/50 border-zinc-700/50 text-white resize-none text-sm leading-relaxed p-3.5 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-zinc-500">{caption.length} characters</p>
          </div>
        </div>

        {/* Right: Schedule & Actions */}
        <div className="flex flex-col gap-4 w-52 flex-shrink-0">
          {/* Date Picker */}
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">
              Schedule Date
            </label>
            <Popover>
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
                  onSelect={setSelectedDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Input */}
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">
              Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="2:30 PM"
                className="w-full bg-zinc-800/50 border-zinc-700/50 h-11 text-sm pl-10 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5 ml-1">Format: 2:30 PM</p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="space-y-2.5">
            <Button
              onClick={handleApprove}
              disabled={isLoading || !selectedDate}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 h-11 text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve & Schedule
            </Button>
            
            <Button
              onClick={handleDiscard}
              disabled={isLoading}
              variant="outline"
              className="w-full bg-zinc-800/30 border-zinc-700/50 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 h-10 text-sm font-medium transition-all"
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
