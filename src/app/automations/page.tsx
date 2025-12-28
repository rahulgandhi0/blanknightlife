'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Clock, Trash2, Play, Pause, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import type { ScrapeAutomation } from '@/types/database'

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// PST offset
const PST_OFFSET = -8

function pstToUtc(hour: number): number {
  return (hour - PST_OFFSET + 24) % 24
}

function utcToPst(hour: number): number {
  return (hour + PST_OFFSET + 24) % 24
}

// Convert 24h to 12h format
function to12Hour(hour24: number): { hour: number; ampm: 'AM' | 'PM' } {
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  let hour = hour24 % 12
  if (hour === 0) hour = 12
  return { hour, ampm }
}

// Convert 12h to 24h format
function to24Hour(hour12: number, ampm: 'AM' | 'PM'): number {
  if (ampm === 'AM') {
    return hour12 === 12 ? 0 : hour12
  } else {
    return hour12 === 12 ? 12 : hour12 + 12
  }
}

export default function AutomationsPage() {
  const { currentProfile } = useAuth()
  const [automations, setAutomations] = useState<ScrapeAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  
  // Form state
  const [account, setAccount] = useState('')
  const [daysBack, setDaysBack] = useState('3')
  const [frequency, setFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily')
  const [hour, setHour] = useState('9')
  const [minute, setMinute] = useState('00')
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM')
  const [runOnDays, setRunOnDays] = useState([0, 1, 2, 3, 4, 5, 6])

  const fetchAutomations = useCallback(async () => {
    if (!currentProfile?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/automations?profile_id=${currentProfile.id}`)
      const data = await res.json()
      setAutomations(data.automations || [])
    } catch (error) {
      console.error('Failed to fetch automations:', error)
    } finally {
      setLoading(false)
    }
  }, [currentProfile?.id])

  useEffect(() => {
    fetchAutomations()
  }, [fetchAutomations])

  const resetForm = () => {
    setAccount('')
    setDaysBack('3')
    setFrequency('daily')
    setHour('9')
    setMinute('00')
    setAmpm('AM')
    setRunOnDays([0, 1, 2, 3, 4, 5, 6])
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProfile?.id || !account.trim()) return

    const hour24 = to24Hour(parseInt(hour) || 9, ampm)
    
    const payload = {
      account_handle: account.trim(),
      days_back: parseInt(daysBack) || 3,
      frequency,
      run_at_hour: pstToUtc(hour24),
      run_at_minute: parseInt(minute) || 0,
      run_on_days: runOnDays,
    }

    try {
      if (editingId) {
        await fetch('/api/automations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, updates: payload }),
        })
      } else {
        await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, profile_id: currentProfile.id }),
        })
      }
      resetForm()
      fetchAutomations()
    } catch (error) {
      console.error('Failed to save automation:', error)
    }
  }

  const startEditing = (automation: ScrapeAutomation) => {
    const pstHour = utcToPst(automation.run_at_hour)
    const { hour: h12, ampm: ap } = to12Hour(pstHour)
    
    setAccount(automation.account_handle)
    setDaysBack(String(automation.days_back))
    setFrequency(automation.frequency)
    setHour(String(h12))
    setMinute(String(automation.run_at_minute).padStart(2, '0'))
    setAmpm(ap)
    setRunOnDays(automation.run_on_days)
    setEditingId(automation.id)
    setShowForm(true)
  }

  const toggleActive = async (automation: ScrapeAutomation) => {
    await fetch('/api/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: automation.id, 
        updates: { is_active: !automation.is_active } 
      }),
    })
    fetchAutomations()
  }

  const deleteAutomation = async (id: string) => {
    if (!confirm('Delete this automation?')) return
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    fetchAutomations()
  }

  const runNow = async (automation: ScrapeAutomation) => {
    setRunningId(automation.id)
    try {
      await fetch(`/api/automations/trigger?force_id=${automation.id}`)
      await fetchAutomations()
    } catch (error) {
      console.error('Failed to run automation:', error)
    } finally {
      setRunningId(null)
    }
  }

  const toggleDay = (day: number) => {
    setRunOnDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  const formatTime = (hourUtc: number, min: number) => {
    const pstHour = utcToPst(hourUtc)
    const { hour: h, ampm: ap } = to12Hour(pstHour)
    return `${h}:${String(min).padStart(2, '0')} ${ap}`
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-zinc-900 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-zinc-500">Scheduled scrapes for {currentProfile?.name}</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-violet-600 hover:bg-violet-500">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-zinc-950 border border-zinc-800 p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Account */}
              <div className="col-span-3">
                <label className="text-xs text-zinc-500 mb-1 block">Account</label>
                <Input
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="username"
                  className="bg-zinc-900 border-zinc-800 h-9"
                  required
                />
              </div>
              
              {/* Days Back */}
              <div className="col-span-2">
                <label className="text-xs text-zinc-500 mb-1 block">Days Back</label>
                <Select value={daysBack} onValueChange={setDaysBack}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[1, 2, 3, 5, 7, 14, 30].map(d => (
                      <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency */}
              <div className="col-span-2">
                <label className="text-xs text-zinc-500 mb-1 block">Frequency</label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as 'hourly' | 'daily' | 'weekly')}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time picker */}
              <div className="col-span-4">
                <label className="text-xs text-zinc-500 mb-1 block">Run At (PST)</label>
                <div className="flex items-center gap-2">
                  <Select value={hour} onValueChange={setHour}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-zinc-500 text-lg">:</span>
                  <Select value={minute} onValueChange={setMinute}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {['00', '15', '30', '45'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ampm} onValueChange={(v) => setAmpm(v as 'AM' | 'PM')}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex gap-1 justify-end">
                <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-500 h-9 w-9 p-0">
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetForm} className="h-9 w-9 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Days of week (only for weekly) */}
            {frequency === 'weekly' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-zinc-500">Run on:</span>
                {DAYS_FULL.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                      runOnDays.includes(idx)
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Automations List */}
      {automations.length === 0 && !showForm ? (
        <Card className="bg-zinc-950 border border-zinc-800 p-8 text-center">
          <Clock className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 mb-3">No automations yet</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-violet-600 hover:bg-violet-500">
            <Plus className="h-4 w-4 mr-1" />
            Create Automation
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {automations.map((automation) => (
            <Card 
              key={automation.id} 
              className={cn(
                "bg-zinc-950 border border-zinc-800 p-3",
                !automation.is_active && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Status dot */}
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  automation.is_active ? "bg-green-500" : "bg-zinc-600"
                )} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">@{automation.account_handle}</span>
                    <span className="text-xs text-zinc-500">{automation.days_back}d</span>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500 capitalize px-1.5 py-0">
                      {automation.frequency}
                    </Badge>
                    <span className="text-xs text-zinc-500">
                      {formatTime(automation.run_at_hour, automation.run_at_minute)}
                    </span>
                    {automation.frequency === 'weekly' && (
                      <span className="text-xs text-zinc-600">
                        {automation.run_on_days.map(d => DAYS_FULL[d].charAt(0)).join('')}
                      </span>
                    )}
                  </div>
                  {automation.last_run_at && (
                    <p className="text-[11px] text-zinc-600">
                      Last: {format(new Date(automation.last_run_at), 'MMM d, h:mm a')}
                      {automation.last_run_status && (
                        <span className={cn(
                          "ml-2",
                          automation.last_run_status === 'success' ? 'text-green-500' : 
                          automation.last_run_status === 'failed' ? 'text-red-400' : 'text-blue-400'
                        )}>
                          • {automation.last_run_status}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Next run */}
                {automation.next_run_at && automation.is_active && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-zinc-600">Next</p>
                    <p className="text-xs text-zinc-400">
                      {format(new Date(automation.next_run_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runNow(automation)}
                    disabled={runningId === automation.id}
                    className="h-7 w-7 p-0 text-violet-400 hover:text-violet-300"
                    title="Run Now"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", runningId === automation.id && "animate-spin")} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(automation)}
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
                    title={automation.is_active ? 'Pause' : 'Resume'}
                  >
                    {automation.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(automation)}
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAutomation(automation.id)}
                    className="h-7 w-7 p-0 text-zinc-600 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
