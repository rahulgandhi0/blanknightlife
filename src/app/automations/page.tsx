'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Clock, Trash2, Play, Pause, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import type { ScrapeAutomation } from '@/types/database'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// PST is UTC-8, PDT is UTC-7. Using fixed -8 offset for simplicity.
const PST_OFFSET = -8

function pstToUtc(hour: number): number {
  // Convert PST hour to UTC hour
  return (hour - PST_OFFSET + 24) % 24
}

function utcToPst(hour: number): number {
  // Convert UTC hour to PST hour
  return (hour + PST_OFFSET + 24) % 24
}

export default function AutomationsPage() {
  const { currentProfile } = useAuth()
  const [automations, setAutomations] = useState<ScrapeAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    account_handle: '@',
    days_back: 3,
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly',
    run_at_hour_pst: 9, // Store in PST for UI
    run_at_minute: 0,
    run_on_days: [0, 1, 2, 3, 4, 5, 6] as number[],
  })

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
    setFormData({
      account_handle: '@',
      days_back: 3,
      frequency: 'daily',
      run_at_hour_pst: 9,
      run_at_minute: 0,
      run_on_days: [0, 1, 2, 3, 4, 5, 6],
    })
    setShowForm(false)
    setEditingId(null)
  }

  // Handle @ prefix in username input
  const handleUsernameChange = (value: string) => {
    // Always ensure @ prefix
    if (!value.startsWith('@')) {
      value = '@' + value.replace(/@/g, '')
    }
    setFormData(prev => ({ ...prev, account_handle: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProfile?.id) return

    // Convert PST to UTC for storage
    const payload = {
      account_handle: formData.account_handle,
      days_back: formData.days_back,
      frequency: formData.frequency,
      run_at_hour: pstToUtc(formData.run_at_hour_pst), // Convert to UTC
      run_at_minute: formData.run_at_minute,
      run_on_days: formData.run_on_days,
    }

    try {
      if (editingId) {
        // Update existing
        await fetch('/api/automations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, updates: payload }),
        })
      } else {
        // Create new
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
    setFormData({
      account_handle: '@' + automation.account_handle.replace(/^@/, ''),
      days_back: automation.days_back,
      frequency: automation.frequency,
      run_at_hour_pst: utcToPst(automation.run_at_hour), // Convert from UTC to PST
      run_at_minute: automation.run_at_minute,
      run_on_days: automation.run_on_days,
    })
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
    setFormData(prev => ({
      ...prev,
      run_on_days: prev.run_on_days.includes(day)
        ? prev.run_on_days.filter(d => d !== day)
        : [...prev.run_on_days, day].sort((a, b) => a - b),
    }))
  }

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12
    const m = minute.toString().padStart(2, '0')
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${h}:${m} ${ampm}`
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-4" />
          <div className="h-4 w-96 bg-zinc-800 rounded mb-8" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-zinc-500 mt-1">Scheduled scraping tasks for {currentProfile?.name}</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="bg-violet-600 hover:bg-violet-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-zinc-950 border border-zinc-800 p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-zinc-200">
                {editingId ? 'Edit Automation' : 'New Automation'}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Instagram Account</Label>
                <Input
                  value={formData.account_handle}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="@username"
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Days Back</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.days_back}
                  onChange={(e) => setFormData(prev => ({ ...prev, days_back: parseInt(e.target.value) || 3 }))}
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, frequency: v as 'hourly' | 'daily' | 'weekly' }))}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Run at (Hour, PST)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={formData.run_at_hour_pst}
                  onChange={(e) => setFormData(prev => ({ ...prev, run_at_hour_pst: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>

              <div className="space-y-2">
                <Label>Minute</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={formData.run_at_minute}
                  onChange={(e) => setFormData(prev => ({ ...prev, run_at_minute: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>

            {formData.frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Run on Days</Label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={cn(
                        "px-3 py-1 rounded text-sm transition-colors",
                        formData.run_on_days.includes(idx)
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm} className="border-zinc-800">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-500">
                <Check className="h-4 w-4 mr-2" />
                {editingId ? 'Save Changes' : 'Create Automation'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Automations List */}
      {automations.length === 0 && !showForm ? (
        <Card className="bg-zinc-950 border border-zinc-800 p-12 text-center">
          <Clock className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No automations yet</h3>
          <p className="text-zinc-500 mb-4">Create an automation to scrape accounts on a schedule</p>
          <Button onClick={() => setShowForm(true)} className="bg-violet-600 hover:bg-violet-500">
            <Plus className="h-4 w-4 mr-2" />
            Create First Automation
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <Card 
              key={automation.id} 
              className={cn(
                "bg-zinc-950 border border-zinc-800 p-4",
                !automation.is_active && "opacity-50"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  automation.is_active ? "bg-violet-600/20 text-violet-400" : "bg-zinc-800 text-zinc-500"
                )}>
                  <Clock className="h-5 w-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-200">@{automation.account_handle}</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        automation.is_active 
                          ? "border-green-400/50 text-green-400" 
                          : "border-zinc-600 text-zinc-500"
                      )}
                    >
                      {automation.is_active ? 'Active' : 'Paused'}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 capitalize">
                      {automation.frequency}
                    </Badge>
                    {automation.last_run_status && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          automation.last_run_status === 'success' 
                            ? "border-green-400/50 text-green-400"
                            : automation.last_run_status === 'running'
                            ? "border-blue-400/50 text-blue-400"
                            : "border-red-400/50 text-red-400"
                        )}
                      >
                        {automation.last_run_status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>{automation.days_back} days back</span>
                    <span>at {formatTime(utcToPst(automation.run_at_hour), automation.run_at_minute)} PST</span>
                    {automation.frequency === 'weekly' && (
                      <span>
                        {automation.run_on_days.map(d => DAYS_OF_WEEK[d]).join(', ')}
                      </span>
                    )}
                    {automation.run_count > 0 && (
                      <span>{automation.run_count} runs</span>
                    )}
                  </div>
                </div>

                {/* Next run */}
                <div className="text-right flex-shrink-0">
                  {automation.next_run_at && automation.is_active && (
                    <>
                      <p className="text-xs text-zinc-600">Next run</p>
                      <p className="text-sm text-zinc-400">
                        {format(new Date(automation.next_run_at), 'MMM d, h:mm a')}
                      </p>
                    </>
                  )}
                  {automation.last_run_at && (
                    <p className="text-xs text-zinc-600 mt-1">
                      Last: {format(new Date(automation.last_run_at), 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runNow(automation)}
                    disabled={runningId === automation.id}
                    className="text-violet-400 hover:text-violet-300"
                    title="Run Now"
                  >
                    <RefreshCw className={cn("h-4 w-4", runningId === automation.id && "animate-spin")} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(automation)}
                    className="text-zinc-400 hover:text-white"
                    title={automation.is_active ? 'Pause' : 'Resume'}
                  >
                    {automation.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(automation)}
                    className="text-zinc-400 hover:text-white"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAutomation(automation.id)}
                    className="text-zinc-500 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
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

