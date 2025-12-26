'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Instagram, Twitter, Loader2, CheckCircle2 } from 'lucide-react'
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

  const getPlatformIcon = (type: string) => {
    switch (type) {
      case 'instagram':
        return <Instagram className="h-5 w-5" />
      case 'twitter':
        return <Twitter className="h-5 w-5" />
      default:
        return null
    }
  }

  const getPlatformColor = (type: string) => {
    switch (type) {
      case 'instagram':
        return 'bg-pink-600'
      case 'twitter':
        return 'bg-blue-500'
      case 'tiktok':
        return 'bg-black'
      case 'facebook':
        return 'bg-blue-600'
      case 'linkedin':
        return 'bg-blue-700'
      default:
        return 'bg-zinc-600'
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-zinc-800 rounded mb-4" />
          <div className="h-4 w-96 bg-zinc-800 rounded mb-8" />
          <div className="grid gap-4">
            <div className="h-32 bg-zinc-900 rounded-lg" />
            <div className="h-32 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="sticky top-0 z-10 flex items-center justify-between py-3 bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold leading-tight mb-2">Connected Accounts</h1>
          <p className="text-sm text-zinc-500">
            Manage your SocialBu connected accounts for multi-platform posting
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="h-9 px-3 text-sm border-zinc-800"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border border-red-900 bg-red-950/20 p-6 mt-6">
          <div className="text-red-400 text-sm">
            <p className="font-semibold mb-2">Error loading accounts</p>
            <p>{error}</p>
            <p className="mt-4 text-xs text-zinc-500">
              Make sure your SOCIALBU_API_KEY is set in your .env file and that you have connected accounts in SocialBu.
            </p>
          </div>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="border border-zinc-800 bg-zinc-950 p-12 mt-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <Instagram className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">No accounts connected</h3>
            <p className="text-zinc-500 mb-6">
              Connect your social media accounts in SocialBu dashboard to get started
            </p>
            <Button
              onClick={() => window.open('https://socialbu.com', '_blank')}
              variant="outline"
              className="border-zinc-800"
            >
              Open SocialBu Dashboard
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-6">
          <Card className="border border-zinc-800 bg-zinc-950 p-6 mb-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Setup Instructions</h3>
            <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
              <li>Copy the account IDs below that you want to use for auto-scheduling</li>
              <li>Add them to your <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-xs">.env</code> file:</li>
              <li className="ml-6 font-mono text-xs bg-zinc-900 p-2 rounded mt-1">
                NEXT_PUBLIC_SOCIALBU_DEFAULT_ACCOUNTS={accounts.filter(a => a.is_active).map(a => a.id).join(',')}
              </li>
              <li>Restart your dev server for changes to take effect</li>
            </ol>
          </Card>

          <div className="grid gap-4">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className="border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors"
              >
                <div className="p-6 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${getPlatformColor(account.type)} flex items-center justify-center text-white`}>
                    {getPlatformIcon(account.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-zinc-200">
                        {account.name || account.username}
                      </h3>
                      {account.is_active ? (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                          Inactive
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 capitalize">
                        {account.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-500">@{account.username}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-600 mb-1">Account ID</p>
                    <code className="text-lg font-mono font-bold text-violet-400 bg-zinc-900 px-3 py-1 rounded">
                      {account.id}
                    </code>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {accounts.length > 0 && (
            <Card className="border border-zinc-800 bg-zinc-950 p-6 mt-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Testing</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Test your SocialBu integration by approving a post from the Pending tab. It will automatically schedule to your configured accounts.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.location.href = '/pending'}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500"
                >
                  Go to Pending Posts
                </Button>
                <Button
                  onClick={() => window.open('https://socialbu.com/developers/docs', '_blank')}
                  size="sm"
                  variant="outline"
                  className="border-zinc-800"
                >
                  View API Docs
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

