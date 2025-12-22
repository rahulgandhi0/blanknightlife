'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RefreshCw } from 'lucide-react'

interface HistoryItem {
  created_at: string
  posted_at_source: string | null
  status: string
}

export default function ScrapePage() {
  const [account, setAccount] = useState('')
  const [sinceHours, setSinceHours] = useState('48')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ runId?: string; error?: string; success?: boolean } | null>(null)
  const [history, setHistory] = useState<{
    lastIngestedAt: string | null
    statusCounts: Record<string, number>
    recent: HistoryItem[]
    total: number
  } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const fetchHistory = async (handle: string) => {
    if (!handle) {
      setHistory(null)
      return
    }
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/scrape-history?account=${encodeURIComponent(handle)}`)
      const data = await res.json()
      if (res.ok) {
        setHistory(data)
      } else {
        setHistory(null)
      }
    } catch (error) {
      setHistory(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    const handle = account.trim()
    if (!handle) {
      setHistory(null)
      return
    }
    const t = setTimeout(() => fetchHistory(handle), 300)
    return () => clearTimeout(t)
  }, [account])

  useEffect(() => {
    if (!polling || !account.trim()) return
    const interval = setInterval(() => {
      fetchHistory(account.trim())
    }, 5000)
    return () => clearInterval(interval)
  }, [polling, account])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setPolling(false)
    try {
      const res = await fetch('/api/apify-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: account.trim(), sinceHours: Number(sinceHours) || 48 }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) {
        setPolling(true)
        setTimeout(() => setPolling(false), 120000)
      }
      fetchHistory(account.trim())
    } catch (error) {
      setResult({ error: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scrape Now</h1>
          <p className="text-sm text-zinc-500 mt-1">Trigger an on-demand Apify scrape</p>
        </div>
      </div>

      <Card className="bg-zinc-950 border border-zinc-800 p-4 space-y-4">
        <form className="space-y-4" onSubmit={submit}>
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-zinc-300">Account</Label>
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="@account or handle"
              className="bg-zinc-900 border-zinc-800"
              required
            />
          </div>
          <div className="flex flex-col gap-1 w-40">
            <Label className="text-sm text-zinc-300">Time range (hours)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={sinceHours}
              onChange={(e) => setSinceHours(e.target.value)}
              className="bg-zinc-900 border-zinc-800"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-500">
            {loading ? 'Triggering...' : 'Trigger Scrape'}
          </Button>
        </form>

        {result && (
          <div className="text-sm space-y-1">
            {result.error && <p className="text-red-400">{result.error}</p>}
            {result.success && result.runId && (
              <div className="space-y-1">
                <p className="text-green-400">✓ Scrape started successfully</p>
                <p className="text-zinc-400 text-xs">Run ID: {result.runId}</p>
                {polling && (
                  <p className="text-zinc-500 text-xs flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Auto-refreshing history every 5s...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="bg-zinc-950 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-zinc-500">Scrape history for this handle</p>
            <p className="text-lg text-white">{account || '–'}</p>
          </div>
          <div className="flex items-center gap-2">
            {historyLoading && <p className="text-xs text-zinc-500">Loading…</p>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchHistory(account.trim())}
              disabled={!account.trim() || historyLoading}
              className="bg-zinc-900 border-zinc-800 h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {history ? (
          <div className="space-y-2 text-sm text-zinc-300">
            <p>Last ingested: {history.lastIngestedAt ? new Date(history.lastIngestedAt).toLocaleString() : 'Never'}</p>
            <p>Total ingested: {history.total}</p>
            <div className="flex gap-3 text-xs text-zinc-400">
              {Object.entries(history.statusCounts).map(([k, v]) => (
                <span key={k} className="capitalize">{k}: {v}</span>
              ))}
            </div>
            <div className="border border-zinc-800 rounded p-2 space-y-1 text-xs text-zinc-400 max-h-48 overflow-y-auto">
              {history.recent.length === 0 && <p>No recent ingests</p>}
              {history.recent.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                  <span className="uppercase text-[11px] text-zinc-500">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No history</p>
        )}
      </Card>
    </div>
  )
}
