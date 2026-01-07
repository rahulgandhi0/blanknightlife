'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Instagram, ExternalLink } from 'lucide-react'
import type { SocialBuAccount } from '@/lib/socialbu'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialBuAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      setError(null)
      const res = await fetch('/api/socialbu-accounts')
      const data = await res.json()
      
      if (data.success) {
        setAccounts(data.accounts)
      } else {
        setError(data.error || 'Failed to fetch accounts')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAccounts()
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-zinc-800 rounded mb-4" />
          <div className="h-4 w-96 bg-zinc-800 rounded mb-8" />
          <div className="space-y-3">
            <div className="h-16 bg-zinc-900 rounded-lg" />
            <div className="h-16 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SocialBu Accounts</h1>
          <p className="text-sm text-zinc-500 mt-1">Accounts connected to your SocialBu workspace</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="border-zinc-800"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border border-red-900 bg-red-950/20 p-4">
          <p className="text-red-400 text-sm mb-2">Error loading accounts</p>
          <p className="text-zinc-500 text-xs">{error}</p>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="border border-zinc-800 bg-zinc-950 p-8 text-center">
          <Instagram className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-4">No accounts found in SocialBu</p>
          <Button
            onClick={() => window.open('https://socialbu.com', '_blank')}
            variant="outline"
            size="sm"
            className="border-zinc-800"
          >
            Open SocialBu
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </Card>
      ) : (
        <Card className="border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800">
          {accounts.map((account) => (
            <div key={account.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0">
                  <Instagram className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">@{account.username || account.name || 'unknown'}</p>
                  <p className="font-medium text-zinc-200 truncate">{account.name || account.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {account.is_active && (
                  <Badge 
                    variant="outline" 
                    className="border-green-800 text-green-400 bg-green-950/20"
                  >
                    Active
                  </Badge>
                )}
                <code className="text-xs font-mono text-violet-400 bg-zinc-900 px-2 py-1 rounded">
                  {account.id}
                </code>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Setup Instructions */}
      <Card className="border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="font-medium text-zinc-200 mb-3">Adding a New Profile</h3>
        <ol className="text-sm text-zinc-400 space-y-2">
          <li className="flex gap-2">
            <span className="text-zinc-600">1.</span>
            Connect your Instagram account in{' '}
            <a href="https://socialbu.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline inline-flex items-center gap-1">
              SocialBu <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-600">2.</span>
            Click Refresh above to see the new account ID
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-600">3.</span>
            Create a new profile in BlankNightLife with that account ID
          </li>
        </ol>
      </Card>
    </div>
  )
}
