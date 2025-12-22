import { createServiceClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Clock, CheckCircle2, Calendar, Send, Archive, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getStats() {
  const supabase = createServiceClient()
  
  const [pending, approved, scheduled, posted, archived] = await Promise.all([
    supabase.from('event_discovery').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('event_discovery').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('event_discovery').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('event_discovery').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
    supabase.from('event_discovery').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
  ])

  if (pending.error) console.error('Pending count error:', pending.error)
  if (approved.error) console.error('Approved count error:', approved.error)
  if (scheduled.error) console.error('Scheduled count error:', scheduled.error)
  if (posted.error) console.error('Posted count error:', posted.error)
  if (archived.error) console.error('Archived count error:', archived.error)

  return {
    pending: pending.count || 0,
    approved: approved.count || 0,
    scheduled: scheduled.count || 0,
    posted: posted.count || 0,
    archived: archived.count || 0,
  }
}

const statCards = [
  { key: 'pending', label: 'Pending Review', icon: Clock, href: '/pending', color: 'from-amber-500 to-orange-500' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2, href: '/approved', color: 'from-emerald-500 to-green-500' },
  { key: 'scheduled', label: 'Scheduled', icon: Calendar, href: '/scheduled', color: 'from-violet-500 to-purple-500' },
  { key: 'posted', label: 'Posted', icon: Send, href: '/posted', color: 'from-blue-500 to-cyan-500' },
  { key: 'archived', label: 'Archived', icon: Archive, href: '/archived', color: 'from-zinc-500 to-zinc-600' },
]

export default async function HomePage() {
  let stats = { pending: 0, approved: 0, scheduled: 0, posted: 0, archived: 0 }
  
  try {
    stats = await getStats()
  } catch (error) {
    // Supabase not configured yet - show empty state
    console.error('Failed to fetch stats:', error)
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-zinc-400">
          Content curation overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const count = stats[stat.key as keyof typeof stats]
          
          return (
            <Link key={stat.key} href={stat.href}>
              <Card className="p-5 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  {stat.key === 'pending' && count > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>
                <p className="text-2xl font-bold text-white mb-0.5">{count}</p>
                <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {stat.label}
                </p>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-zinc-900 border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Quick Stats</h3>
              <p className="text-sm text-zinc-500">Content pipeline overview</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Total posts tracked</span>
              <span className="font-medium">{total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Awaiting review</span>
              <span className="font-medium text-amber-400">{stats.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Ready to post</span>
              <span className="font-medium text-violet-400">{stats.scheduled}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-zinc-900 border-zinc-800">
          <h3 className="font-semibold text-white mb-4">API Endpoint</h3>
          <div className="rounded-lg bg-zinc-950 p-4 font-mono text-sm">
            <p className="text-zinc-500 mb-2"># Send Apify posts to ingest</p>
            <p className="text-emerald-400">POST /api/ingest</p>
            <p className="text-zinc-600 mt-2">{"{"}</p>
            <p className="text-zinc-400 ml-4">&quot;posts&quot;: [ApifyPost, ...]</p>
            <p className="text-zinc-600">{"}"}</p>
          </div>
        </Card>
      </div>

      {/* Empty State */}
      {total === 0 && (
        <Card className="mt-6 p-8 bg-zinc-900 border-zinc-800 border-dashed text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
          <p className="text-zinc-500 max-w-md mx-auto">
            Configure your Apify scraper to send posts to <code className="text-violet-400">/api/ingest</code> to get started.
          </p>
        </Card>
      )}
    </div>
  )
}
