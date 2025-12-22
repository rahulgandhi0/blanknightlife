'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
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
      await onApprove(event.id, caption, selectedDate)
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
    <Card className="overflow-hidden bg-zinc-900 border-zinc-800">
      <div className="flex gap-4 p-3">
        {/* Left: Image - fixed small size */}
        <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-black">
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
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                    {mediaUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-1 w-1 rounded-full transition-all',
                          idx === currentImageIndex ? 'bg-white w-2' : 'bg-white/40'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
              No image
            </div>
          )}
          
          {/* Carousel badge */}
          {event.post_type === 'carousel' && (
            <Badge className="absolute top-1 right-1 bg-violet-500/80 text-white border-0 text-[10px] px-1 py-0">
              {mediaUrls.length}
            </Badge>
          )}
        </div>

        {/* Middle: Caption */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0 text-[10px]">
              @{event.source_account}
            </Badge>
            {event.posted_at_source && (
              <span className="text-[10px] text-zinc-600">
                {format(new Date(event.posted_at_source), 'MMM d')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[10px] text-zinc-500">AI Caption</span>
          </div>
          
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="flex-1 min-h-[60px] max-h-[80px] bg-zinc-800 border-zinc-700 text-white resize-none text-xs p-2"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2 w-36 flex-shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-full justify-start text-left font-normal bg-zinc-800 border-zinc-700 h-8 text-xs',
                  !selectedDate && 'text-zinc-500'
                )}
              >
                <CalendarIcon className="mr-1.5 h-3 w-3" />
                {selectedDate ? format(selectedDate, 'MMM d') : 'Pick date'}
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

          <Button
            onClick={handleApprove}
            disabled={isLoading || !selectedDate}
            size="sm"
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 h-8 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          
          <Button
            onClick={handleDiscard}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="w-full bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:text-red-400 h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Discard
          </Button>
        </div>
      </div>
    </Card>
  )
}
