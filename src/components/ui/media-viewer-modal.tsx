'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MediaViewerModalProps {
  isOpen: boolean
  onClose: () => void
  mediaUrls: string[]
  initialIndex?: number
  isReel?: boolean
}

export function MediaViewerModal({
  isOpen,
  onClose,
  mediaUrls,
  initialIndex = 0,
  isReel = false,
}: MediaViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isAnimating, setIsAnimating] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Trigger bounce animation
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 200)
      return () => clearTimeout(timer)
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Autoplay video when modal opens for reels
  useEffect(() => {
    if (isOpen && isReel && videoRef.current) {
      videoRef.current.play().catch(console.error)
    }
  }, [isOpen, isReel, currentIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrevious()
      } else if (e.key === 'ArrowRight' && currentIndex < mediaUrls.length - 1) {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentIndex, mediaUrls.length, onClose])

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < mediaUrls.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const hasMultiple = mediaUrls.length > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-all duration-150 hover:scale-110"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Previous button */}
      {hasMultiple && currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 z-10 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-all duration-150 hover:scale-110"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button */}
      {hasMultiple && currentIndex < mediaUrls.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 z-10 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-all duration-150 hover:scale-110"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Media content */}
      <div
        className={cn(
          "relative max-w-[90vw] max-h-[90vh] transition-transform duration-150",
          isAnimating && "animate-in zoom-in-95"
        )}
      >
        {isReel ? (
          <video
            ref={videoRef}
            src={mediaUrls[currentIndex]}
            controls
            autoPlay
            loop
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          />
        ) : (
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Image
              src={mediaUrls[currentIndex]}
              alt={`Media ${currentIndex + 1}`}
              width={1200}
              height={1200}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Image counter */}
        {hasMultiple && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-zinc-900/80 text-white text-sm font-medium">
            {currentIndex + 1} / {mediaUrls.length}
          </div>
        )}
      </div>

      {/* Dot indicators for carousel */}
      {hasMultiple && mediaUrls.length <= 10 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {mediaUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-150",
                index === currentIndex
                  ? "bg-white w-6"
                  : "bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

