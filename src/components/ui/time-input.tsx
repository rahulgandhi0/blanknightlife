'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface TimeInputProps {
  value: string // Format: "h:mm AM/PM" e.g. "2:30 PM"
  onChange: (value: string) => void
  className?: string
  minMinutesFromNow?: number // Minimum minutes from now (default: 15)
  disabled?: boolean
}

export function TimeInput({ 
  value, 
  onChange, 
  className,
  minMinutesFromNow = 15,
  disabled = false
}: TimeInputProps) {
  const [hourDigit1, setHourDigit1] = useState('')
  const [hourDigit2, setHourDigit2] = useState('')
  const [minuteDigit1, setMinuteDigit1] = useState('')
  const [minuteDigit2, setMinuteDigit2] = useState('')
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('PM')
  const [error, setError] = useState<string | null>(null)
  
  const hourInput1Ref = useRef<HTMLInputElement>(null)
  const hourInput2Ref = useRef<HTMLInputElement>(null)
  const minuteInput1Ref = useRef<HTMLInputElement>(null)
  const minuteInput2Ref = useRef<HTMLInputElement>(null)

  // Parse the value prop to populate inputs
  useEffect(() => {
    const match = value.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (match) {
      const hours = match[1].padStart(2, '0')
      const minutes = match[2].padStart(2, '0')
      const mer = match[3].toUpperCase() as 'AM' | 'PM'
      
      setHourDigit1(hours[0])
      setHourDigit2(hours[1])
      setMinuteDigit1(minutes[0])
      setMinuteDigit2(minutes[1])
      setMeridiem(mer)
    }
  }, [value])

  const validateAndUpdate = (h1: string, h2: string, m1: string, m2: string, mer: 'AM' | 'PM') => {
    // All 4 digits must be filled
    if (!h1 || !h2 || !m1 || !m2) {
      setError('All digits required')
      return false
    }

    const hours = parseInt(h1 + h2, 10)
    const minutes = parseInt(m1 + m2, 10)

    // Validate hour range (1-12)
    if (hours < 1 || hours > 12) {
      setError('Hour must be 1-12')
      return false
    }

    // Validate minute range (0-59)
    if (minutes < 0 || minutes > 59) {
      setError('Minutes must be 0-59')
      return false
    }

    // Convert to 24h for validation
    let hours24 = hours
    if (mer === 'PM' && hours !== 12) hours24 += 12
    if (mer === 'AM' && hours === 12) hours24 = 0

    // Check if time is at least minMinutesFromNow in the future
    const now = new Date()
    const selectedTime = new Date()
    selectedTime.setHours(hours24, minutes, 0, 0)
    
    // If selected time is earlier today, assume it's for tomorrow
    if (selectedTime <= now) {
      selectedTime.setDate(selectedTime.getDate() + 1)
    }

    const diffMinutes = Math.floor((selectedTime.getTime() - now.getTime()) / (1000 * 60))
    
    if (diffMinutes < minMinutesFromNow) {
      setError(`Must be ${minMinutesFromNow}+ min from now`)
      return false
    }

    setError(null)
    
    // Update parent with formatted time
    const displayHours = hours
    const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${mer}`
    onChange(formattedTime)
    
    return true
  }

  const handleDigitChange = (
    position: 'h1' | 'h2' | 'm1' | 'm2',
    value: string,
    setter: (v: string) => void,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
    
    setter(digit)

    // Auto-advance to next input
    if (digit && nextRef?.current) {
      nextRef.current.focus()
      nextRef.current.select()
    }

    // Get current values
    const h1 = position === 'h1' ? digit : hourDigit1
    const h2 = position === 'h2' ? digit : hourDigit2
    const m1 = position === 'm1' ? digit : minuteDigit1
    const m2 = position === 'm2' ? digit : minuteDigit2

    // Validate when all digits are entered
    if (h1 && h2 && m1 && m2) {
      validateAndUpdate(h1, h2, m1, m2, meridiem)
    } else {
      setError(null) // Clear error while typing
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    position: 'h1' | 'h2' | 'm1' | 'm2',
    prevRef?: React.RefObject<HTMLInputElement | null>,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === 'Backspace') {
      const currentValue = e.currentTarget.value
      if (!currentValue && prevRef?.current) {
        e.preventDefault()
        prevRef.current.focus()
        prevRef.current.select()
      }
    } else if (e.key === 'ArrowLeft' && prevRef?.current) {
      e.preventDefault()
      prevRef.current.focus()
      prevRef.current.select()
    } else if (e.key === 'ArrowRight' && nextRef?.current) {
      e.preventDefault()
      nextRef.current.focus()
      nextRef.current.select()
    }
  }

  const toggleMeridiem = () => {
    const newMeridiem = meridiem === 'AM' ? 'PM' : 'AM'
    setMeridiem(newMeridiem)
    
    // Revalidate with new meridiem
    if (hourDigit1 && hourDigit2 && minuteDigit1 && minuteDigit2) {
      validateAndUpdate(hourDigit1, hourDigit2, minuteDigit1, minuteDigit2, newMeridiem)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    
    if (pasted.length === 4) {
      setHourDigit1(pasted[0])
      setHourDigit2(pasted[1])
      setMinuteDigit1(pasted[2])
      setMinuteDigit2(pasted[3])
      validateAndUpdate(pasted[0], pasted[1], pasted[2], pasted[3], meridiem)
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 h-9">
          {/* Hour inputs */}
          <input
            ref={hourInput1Ref}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={hourDigit1}
            onChange={(e) => handleDigitChange('h1', e.target.value, setHourDigit1, hourInput2Ref)}
            onKeyDown={(e) => handleKeyDown(e, 'h1', undefined, hourInput2Ref)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={cn(
              "w-[1ch] bg-transparent border-none outline-none text-center text-sm",
              !hourDigit1 && "text-zinc-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            placeholder="_"
          />
          <input
            ref={hourInput2Ref}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={hourDigit2}
            onChange={(e) => handleDigitChange('h2', e.target.value, setHourDigit2, minuteInput1Ref)}
            onKeyDown={(e) => handleKeyDown(e, 'h2', hourInput1Ref, minuteInput1Ref)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={cn(
              "w-[1ch] bg-transparent border-none outline-none text-center text-sm",
              !hourDigit2 && "text-zinc-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            placeholder="_"
          />
          
          <span className="text-zinc-500 mx-0.5">:</span>
          
          {/* Minute inputs */}
          <input
            ref={minuteInput1Ref}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={minuteDigit1}
            onChange={(e) => handleDigitChange('m1', e.target.value, setMinuteDigit1, minuteInput2Ref)}
            onKeyDown={(e) => handleKeyDown(e, 'm1', hourInput2Ref, minuteInput2Ref)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={cn(
              "w-[1ch] bg-transparent border-none outline-none text-center text-sm",
              !minuteDigit1 && "text-zinc-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            placeholder="_"
          />
          <input
            ref={minuteInput2Ref}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={minuteDigit2}
            onChange={(e) => handleDigitChange('m2', e.target.value, setMinuteDigit2)}
            onKeyDown={(e) => handleKeyDown(e, 'm2', minuteInput1Ref)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={cn(
              "w-[1ch] bg-transparent border-none outline-none text-center text-sm",
              !minuteDigit2 && "text-zinc-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            placeholder="_"
          />
        </div>
        
        {/* AM/PM Toggle */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleMeridiem}
          disabled={disabled}
          className={cn(
            "h-9 w-14 border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
            meridiem === 'PM' ? "text-violet-400" : "text-zinc-400"
          )}
        >
          {meridiem}
        </Button>
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}

