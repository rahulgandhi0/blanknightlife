'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RefreshCw, Link2, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface HistoryItem {
  created_at: string
  posted_at_source: string | null
  status: string
}

type ScrapeMode = 'profile' | 'post'

export default function ScrapePage() {
  const { currentProfile } = useAuth()
  const [mode, setMode] = useState<ScrapeMode>('profile')
  const [account, setAccount] = useState('@')

  // Handle @ prefix in username input
  const handleAccountChange = (value: string) => {
    if (!value.startsWith('@')) {
      value = '@' + value.replace(/@/g, '')
    }
    setAccount(value)
  }
  const [postUrl, setPostUrl] = useState('')
  const [sinceDays, setSinceDays] = useState('3')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ runId?: string; error?: string; success?: boolean } | null>(null)
  const [history, setHistory] = useState<{
    lastIngestedAt: string | null
    statusCounts: Record<string, number>
    recent: HistoryItem[]
    total: number
  } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null)
  const [scrapeStats, setScrapeStats] = useState<{
    found?: number
    processed?: number
    skipped?: number
    errors?: number
    details?: { id: string; result: string }[]
    fallbackUsed?: boolean
  } | null>(null)
  const [progress, setProgress] = useState<
    { label: string; state: 'idle' | 'active' | 'done' | 'error'; helper?: string }[]
  >([
    { label: 'Validate input', state: 'idle' },
    { label: 'Run Apify', state: 'idle' },
    { label: 'Filter results', state: 'idle' },
    { label: 'Ingest', state: 'idle' },
  ])
  const [logs, setLogs] = useState<string[]>([])
  const [liveLog, setLiveLog] = useState<string>('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

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
    } catch {
      setHistory(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (mode !== 'profile') return
    const handle = account.trim().replace(/^@/, '')
    if (!handle) {
      setHistory(null)
      return
    }
    const t = setTimeout(() => fetchHistory(handle), 300)
    return () => clearTimeout(t)
  }, [account, mode])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Reset results when switching modes
  useEffect(() => {
    setResult(null)
    setScrapeStatus(null)
    setScrapeStats(null)
    setLogs([])
    setProgress([
      { label: 'Validate input', state: 'idle' },
      { label: 'Run Apify', state: 'idle' },
      { label: 'Filter results', state: 'idle' },
      { label: 'Ingest', state: 'idle' },
    ])
  }, [mode])

  const updateProgress = (stepLabel: string, state: 'idle' | 'active' | 'done' | 'error', helper?: string) => {
    setProgress(prev => prev.map(p => 
      p.label === stepLabel ? { ...p, state, helper } : p
    ))
  }

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg])
    setLiveLog(msg)
  }

  const extractShortcode = (url: string): string | null => {
    const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/)
    if (match) return match[1]
    const match2 = url.match(/instagr\.am\/p\/([A-Za-z0-9_-]+)/)
    if (match2) return match2[1]
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setScrapeStatus(null)
    setScrapeStats(null)
    setLogs([])
    setLiveLog('')
    setProgress([
      { label: 'Validate input', state: 'active' },
      { label: 'Run Apify', state: 'idle' },
      { label: 'Filter results', state: 'idle' },
      { label: 'Ingest', state: 'idle' },
    ])

    try {
      if (mode === 'post') {
        // Single post scrape
        const shortcode = extractShortcode(postUrl)
        if (!shortcode) {
          updateProgress('Validate input', 'error', 'Invalid Instagram URL')
          setScrapeStatus('Invalid Instagram URL - use format: instagram.com/p/ABC123/')
          setLoading(false)
          return
        }

        updateProgress('Validate input', 'done')
        updateProgress('Run Apify', 'active', 'Fetching post...')
        addLog(`Fetching post: ${shortcode}`)

        const res = await fetch('/api/apify-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            postUrl: postUrl.trim(),
            shortcode,
            profile_id: currentProfile?.id,
            mode: 'single',
          }),
        })
        const data = await res.json()
        handleResponse(data)
      } else {
        // Profile scrape
        const cleanAccount = account.trim().replace(/^@/, '')
        const sinceHours = Math.round(Number(sinceDays) * 24) || 72
        
        updateProgress('Validate input', 'done')
        updateProgress('Run Apify', 'active', `Scraping @${cleanAccount}...`)
        addLog(`Starting scrape for @${cleanAccount}`)
        addLog(`Looking back ${sinceDays} days (${sinceHours} hours)`)

        // Start polling for visual feedback
        let dots = 0
        pollRef.current = setInterval(() => {
          dots = (dots + 1) % 4
          setLiveLog(`Scraping @${cleanAccount}${'.'.repeat(dots)}`)
        }, 500)

        const res = await fetch('/api/apify-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            account: cleanAccount,
            sinceHours,
            profile_id: currentProfile?.id,
          }),
        })

        // Stop polling
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }

        const data = await res.json()
        handleResponse(data)
        
        // Refresh history
        if (data.success) {
          fetchHistory(cleanAccount)
        }
      }
    } catch (error) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      setProgress([
        { label: 'Validate input', state: 'done' },
        { label: 'Run Apify', state: 'error', helper: 'Request failed' },
        { label: 'Filter results', state: 'idle' },
        { label: 'Ingest', state: 'idle' },
      ])
      setResult({ error: 'Request failed' })
      setScrapeStatus('Request failed')
    } finally {
      setLoading(false)
      setLiveLog('')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleResponse = (data: any) => {
    setResult(data)
    if (Array.isArray(data.logs)) {
      setLogs(prev => [...prev, ...data.logs])
    }

    const mappedSteps =
      Array.isArray(data.steps) && data.steps.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? data.steps.map((step: any) => {
            const status = step.status as string
            let state: 'idle' | 'active' | 'done' | 'error' = 'idle'
            if (status === 'running') state = 'active'
            else if (status === 'done') state = 'done'
            else if (status === 'error') state = 'error'
            return { label: step.label || 'Step', state, helper: step.info }
          })
        : progress
    setProgress(mappedSteps)

    if (data.success) {
      setProgress((prev) =>
        prev.map((p) => {
          if (p.label === 'Run Apify') {
            return { ...p, state: 'done', helper: `Found ${data.found || 0}${data.fallbackUsed ? ' (fallback)' : ''}` }
          }
          if (p.label === 'Ingest') {
            return { ...p, state: 'done', helper: `Processed ${data.ingestResult?.processed || 0}` }
          }
          return p.state === 'idle' ? { ...p, state: 'done' } : p
        })
      )
      setScrapeStats({
        found: data.found || 0,
        processed: data.ingestResult?.processed || 0,
        skipped: data.ingestResult?.skipped || 0,
        errors: data.ingestResult?.errors || 0,
        details: data.ingestResult?.details || [],
        fallbackUsed: data.fallbackUsed || false,
      })
      setScrapeStatus(data.message || '✓ DONE')
    } else if (data.error) {
      setProgress((prev) =>
        prev.map((p) =>
          p.label === 'Run Apify'
            ? { ...p, state: 'error', helper: data.error }
            : p.label === 'Validate input'
              ? { ...p, state: 'done' }
              : p
        )
      )
      setScrapeStatus(data.error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scrape Now</h1>
          <p className="text-sm text-zinc-500 mt-1">Import content from Instagram</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg w-fit">
        <button
          onClick={() => setMode('profile')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            mode === 'profile'
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          )}
        >
          <User className="h-4 w-4" />
          Profile
        </button>
        <button
          onClick={() => setMode('post')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            mode === 'post'
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          )}
        >
          <Link2 className="h-4 w-4" />
          Single Post
        </button>
      </div>

      <Card className="bg-zinc-950 border border-zinc-800 p-4 space-y-4">
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'profile' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-zinc-300">Instagram Username</Label>
                <Input
                  value={account}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  placeholder="@username"
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
                <p className="text-xs text-zinc-500">Scrapes recent posts from this profile</p>
              </div>

              <div className="flex flex-col gap-1 w-40">
                <Label className="text-sm text-zinc-300">Time range (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={sinceDays}
                  onChange={(e) => setSinceDays(e.target.value)}
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
                <p className="text-xs text-zinc-500">Max 30 days</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-zinc-300">Instagram Post URL</Label>
              <Input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://instagram.com/p/ABC123/ or /reel/..."
                className="bg-zinc-900 border-zinc-800"
                required
              />
              <p className="text-xs text-zinc-500">Paste the full URL of a single post or reel</p>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading || !currentProfile || (mode === 'profile' ? !account.trim() : !postUrl.trim())} 
            className="bg-violet-600 hover:bg-violet-500" 
            aria-busy={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {liveLog || 'Processing…'}
              </span>
            ) : mode === 'post' ? (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Scrape Post
              </>
            ) : (
              <>
                <User className="h-4 w-4 mr-2" />
                Scrape Profile
              </>
            )}
          </Button>

          {!currentProfile && (
            <p className="text-xs text-amber-400">Please select a profile first</p>
          )}
        </form>

        {result && (
          <div className="text-sm space-y-1">
            {result.error && <p className="text-red-400">{result.error}</p>}
            {result.success && result.runId && (
              <div className="space-y-1">
                <p className="text-zinc-400 text-xs">Run ID: {result.runId}</p>
              </div>
            )}
          </div>
        )}

        {scrapeStatus && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={scrapeStatus.startsWith('✓') ? 'text-green-400' : 'text-zinc-400'}>
                {scrapeStatus}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-zinc-400">
              {progress.map((step, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span
                    className={
                      step.state === 'done'
                        ? 'text-green-400'
                        : step.state === 'active'
                          ? 'text-white'
                          : step.state === 'error'
                            ? 'text-red-400'
                            : 'text-zinc-500'
                    }
                  >
                    {step.label}
                  </span>
                  {step.helper && <span className="text-[11px] text-zinc-500">{step.helper}</span>}
                </div>
              ))}
            </div>
            {scrapeStats && (
              <div className="flex gap-4 text-xs text-zinc-400">
                <span>Found: <span className="text-white font-medium">{scrapeStats.found}</span></span>
                <span>Ingested: <span className="text-green-400 font-medium">{scrapeStats.processed}</span></span>
                <span>Skipped: <span className="text-zinc-500 font-medium">{scrapeStats.skipped}</span></span>
                {(scrapeStats.errors ?? 0) > 0 && (
                  <span>Errors: <span className="text-red-400 font-medium">{scrapeStats.errors}</span></span>
                )}
              </div>
            )}
            {scrapeStats?.details && scrapeStats.details.length > 0 && (
              <div className="border border-zinc-800 rounded p-2 text-[11px] text-zinc-400 max-h-40 overflow-y-auto">
                {scrapeStats.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-zinc-500">{d.id}</span>
                    <span className="text-zinc-300">{d.result}</span>
                  </div>
                ))}
              </div>
            )}
            {logs.length > 0 && (
              <div className="border border-zinc-800 rounded p-2 text-[11px] text-zinc-400 max-h-40 overflow-y-auto space-y-1">
                {logs.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-300">{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* History section - only show for profile mode */}
      {mode === 'profile' && account.replace(/^@/, '').trim() && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">History</h2>
              <p className="text-sm text-zinc-500">{account}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchHistory(account.trim().replace(/^@/, ''))}
              disabled={!account.trim() || historyLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", historyLoading && "animate-spin")} />
            </Button>
          </div>

          {history ? (
            <Card className="bg-zinc-950 border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs mb-1">Last Scraped</p>
                    <p className="text-zinc-200">
                      {history.lastIngestedAt ? format(new Date(history.lastIngestedAt), 'MMM d, h:mm a') : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs mb-1">Total Posts</p>
                    <p className="text-zinc-200">{history.total}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs mb-1">Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(history.statusCounts).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                          {k}: {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {history.recent.length > 0 && (
                <div className="divide-y divide-zinc-800">
                  {history.recent.map((item, idx) => (
                    <div key={idx} className="px-4 py-3 hover:bg-zinc-900/50 transition-colors flex items-center justify-between">
                      <span className="text-sm text-zinc-300">
                        {format(new Date(item.created_at), 'MMM d, h:mm a')}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          item.status === 'pending' ? "bg-blue-500" :
                          item.status === 'scheduled' ? "bg-violet-500" :
                          item.status === 'posted' ? "bg-green-500" :
                          item.status === 'discarded' ? "bg-red-500" :
                          "bg-zinc-500"
                        )} />
                        <span className="text-xs text-zinc-500 uppercase">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="bg-zinc-950 border border-zinc-800 p-6 text-center">
              <p className="text-sm text-zinc-500">No history available</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
