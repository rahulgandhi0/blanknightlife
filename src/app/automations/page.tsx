'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Clock, Trash2, Play, Pause, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import type { ScrapeAutomation } from '@/types/database'

// PST offset (Pacific Standard Time = UTC-8)
const PST_OFFSET = -8

function pstToUtc(hour: number): number {
  return (hour - PST_OFFSET + 24) % 24
}

function utcToPst(hour: number): number {
  return (hour + PST_OFFSET + 24) % 24
}

// Parse time string like "9:30 AM" or "14:00" or "2pm" into { hour24, minute }
function parseTimeInput(input: string): { hour24: number; minute: number } | null {
  const str = input.trim().toLowerCase()
  
  // Try formats: 9:30am, 9:30 am, 14:00, 2pm, 2 pm
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10)
    const minute = parseInt(ampmMatch[2] || '0', 10)
    const ampm = ampmMatch[3].toLowerCase()
    
    if (ampm === 'pm' && hour !== 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    
    return { hour24: hour, minute }
  }
  
  // Try 24h format: 14:30, 9:00
  const h24Match = str.match(/^(\d{1,2}):(\d{2})$/)
  if (h24Match) {
    const hour = parseInt(h24Match[1], 10)
    const minute = parseInt(h24Match[2], 10)
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour24: hour, minute }
    }
  }
  
  // Try just hour: 9, 14
  const justHour = parseInt(str, 10)
  if (!isNaN(justHour) && justHour >= 0 && justHour <= 23) {
    return { hour24: justHour, minute: 0 }
  }
  
  return null
}

// Format hour/minute to 12h string
function formatTime(hourUtc: number, minute: number): string {
  const pstHour = utcToPst(hourUtc)
  const ampm = pstHour >= 12 ? 'PM' : 'AM'
  let h = pstHour % 12
  if (h === 0) h = 12
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

// Format frequency hours to human readable
function formatFrequency(hours: number): string {
  if (hours === 24) return 'daily'
  if (hours === 168) return 'weekly'
  return `every ${hours}h`
}

interface ScrapeHistoryItem {
  id: string
  profile_id: string
  account: string
  posts_found: number
  posts_ingested: number
  status: string
  error_message: string | null
  created_at: string
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
  const [timeInput, setTimeInput] = useState('9:00 AM')
  const [frequencyHours, setFrequencyHours] = useState(36)

  // Scrape history state
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  const fetchScrapeHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/scrape-history?limit=30')
      const data = await res.json()
      setScrapeHistory(data.scrapes || [])
    } catch (error) {
      console.error('Failed to fetch scrape history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAutomations()
    fetchScrapeHistory()
  }, [fetchAutomations, fetchScrapeHistory])

  const resetForm = () => {
    setAccount('')
    setTimeInput('9:00 AM')
    setFrequencyHours(36)
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProfile?.id || !account.trim()) return

    const parsedTime = parseTimeInput(timeInput)
    if (!parsedTime) {
      alert('Invalid time format. Try "9:00 AM" or "14:30"')
      return
    }
    
    // Calculate smart default for initial scrape: 2x frequency or minimum 5 days
    const calculatedDaysBack = Math.max(5, Math.ceil((frequencyHours * 2) / 24))
    
    const payload = {
      account_handle: account.trim(),
      run_at_hour: pstToUtc(parsedTime.hour24),
      run_at_minute: parsedTime.minute,
      frequency_hours: frequencyHours,
      days_back: calculatedDaysBack,
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
    setAccount(automation.account_handle)
    setTimeInput(formatTime(automation.run_at_hour, automation.run_at_minute))
    setFrequencyHours(automation.frequency_hours || 36)
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
      await fetch('/api/automations/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: automation.id }),
      })
      await fetchAutomations()
      await fetchScrapeHistory()
    } catch (error) {
      console.error('Failed to run automation:', error)
    } finally {
      setRunningId(null)
    }
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
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* Account */}
                <div className="col-span-6">
                  <label className="text-xs text-zinc-500 mb-1 block">Account</label>
                  <Input
                    value={account}
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val.startsWith('@') && val.length > 0) {
                        setAccount('@' + val)
                      } else {
                        setAccount(val)
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="@username"
                    className="bg-zinc-900 border-zinc-800 h-9"
                    required
                  />
                </div>

                {/* Time input */}
                <div className="col-span-6">
                  <label className="text-xs text-zinc-500 mb-1 block">Start Time (PST)</label>
                  <Input
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="9:00 AM"
                    className="bg-zinc-900 border-zinc-800 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 items-end">
                {/* Frequency */}
                <div className="col-span-10">
                  <label className="text-xs text-zinc-500 mb-1 block">Frequency</label>
                  <select
                    value={frequencyHours}
                    onChange={(e) => setFrequencyHours(Number(e.target.value))}
                    className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-md px-3 text-sm text-white focus:border-violet-500 focus:ring-0"
                  >
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Daily (24h)</option>
                    <option value={36}>Every 36 hours</option>
                    <option value={48}>Every 2 days (48h)</option>
                    <option value={72}>Every 3 days (72h)</option>
                    <option value={168}>Weekly (168h)</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex gap-1 justify-end">
                  <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-500 h-9 w-9 p-0">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={resetForm} className="h-9 w-9 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-200">@{automation.account_handle}</span>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500 px-1.5 py-0">
                      {formatFrequency(automation.frequency_hours || 36)}
                    </Badge>
                    <span className="text-xs text-zinc-500">
                      @ {formatTime(automation.run_at_hour, automation.run_at_minute)} PST
                    </span>
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

      {/* Scrape Activity Log */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Recent Scrape Activity</h2>
            <p className="text-sm text-zinc-500">All scrapes across all accounts</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchScrapeHistory}
            disabled={historyLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", historyLoading && "animate-spin")} />
          </Button>
        </div>

        {historyLoading && scrapeHistory.length === 0 ? (
          <Card className="bg-zinc-950 border border-zinc-800 p-4">
            <div className="text-center text-sm text-zinc-500">Loading...</div>
          </Card>
        ) : scrapeHistory.length === 0 ? (
          <Card className="bg-zinc-950 border border-zinc-800 p-8 text-center">
            <Clock className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-400">No scrape activity yet</p>
          </Card>
        ) : (
          <Card className="bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-zinc-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Account</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Found</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Ingested</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {scrapeHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {format(new Date(item.created_at), 'MMM d, h:mm a')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-200">
                        @{item.account}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            item.status === 'success' ? "bg-green-500" :
                            item.status === 'failed' ? "bg-red-500" :
                            item.status === 'partial' ? "bg-yellow-500" :
                            "bg-zinc-500"
                          )} />
                          <span className={cn(
                            "text-xs capitalize",
                            item.status === 'success' ? "text-green-400" :
                            item.status === 'failed' ? "text-red-400" :
                            item.status === 'partial' ? "text-yellow-400" :
                            "text-zinc-400"
                          )}>
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                        {item.posts_found}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                        {item.posts_ingested}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">
                        {item.error_message || '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
