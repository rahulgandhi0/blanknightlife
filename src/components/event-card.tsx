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
  ExternalLink,
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

export function EventCard({ event, onApprove, onDiscard, onUpdate }: EventCardProps) {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left: Image/Carousel */}
        <div className="relative aspect-square bg-black">
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {mediaUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full transition-all',
                          idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
              No image
            </div>
          )}
          
          {/* Source badge */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="secondary" className="bg-black/60 text-white border-0">
              @{event.source_account}
            </Badge>
            {event.post_type === 'carousel' && (
              <Badge variant="secondary" className="bg-violet-500/80 text-white border-0">
                Carousel
              </Badge>
            )}
          </div>
        </div>

        {/* Right: Caption & Actions */}
        <div className="flex flex-col p-5">
          {/* Original caption (collapsed) */}
          <details className="mb-4 group">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 flex items-center gap-1">
              <span>Original caption</span>
              <ExternalLink className="h-3 w-3" />
            </summary>
            <p className="mt-2 text-xs text-zinc-600 max-h-24 overflow-y-auto">
              {event.original_caption || 'No caption'}
            </p>
          </details>

          {/* AI Caption Editor */}
          <div className="flex-1 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <label className="text-sm font-medium text-zinc-300">Caption</label>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              className="min-h-[120px] bg-zinc-800 border-zinc-700 text-white resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {caption.length} characters
            </p>
          </div>

          {/* Date Picker */}
          <div className="mb-4">
            <label className="text-sm font-medium text-zinc-300 mb-2 block">Schedule for</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-zinc-800 border-zinc-700',
                    !selectedDate && 'text-zinc-500'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
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

          {/* Source timestamp */}
          {event.posted_at_source && (
            <p className="text-xs text-zinc-600 mb-4">
              Posted: {format(new Date(event.posted_at_source), 'MMM d, yyyy h:mm a')}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={isLoading || !selectedDate}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve & Schedule
            </Button>
            <Button
              onClick={handleDiscard}
              disabled={isLoading}
              variant="outline"
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

