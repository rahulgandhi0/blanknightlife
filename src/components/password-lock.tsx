'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PasswordLockProps {
  onAuthenticate: (pin: string) => boolean
}

export function PasswordLock({ onAuthenticate }: PasswordLockProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(timer)
    }
  }, [shake])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const success = onAuthenticate(pin)
    
    if (!success) {
      setError(true)
      setShake(true)
      setPin('')
      setTimeout(() => setError(false), 2000)
    }
  }

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(value)
    setError(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      <Card 
        className={`w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-sm transition-transform ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 text-6xl">🔒</div>
          <CardTitle className="text-2xl font-bold text-white">
            BlankNightlife
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enter PIN to access the curator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={handlePinChange}
                maxLength={4}
                className={`text-center text-2xl tracking-widest bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-zinc-500 ${
                  error ? 'border-red-500 focus:border-red-500' : ''
                }`}
                autoFocus
                autoComplete="off"
              />
              {error && (
                <p className="text-sm text-red-400 text-center animate-pulse">
                  Incorrect PIN. Please try again.
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
              disabled={pin.length !== 4}
            >
              Unlock
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-zinc-600">
            <p>Protected Access</p>
          </div>
        </CardContent>
      </Card>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  )
}
