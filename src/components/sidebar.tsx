'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ProfileSwitcher } from '@/components/profile-switcher'
import { 
  Clock, 
  Calendar, 
  Send, 
  Archive,
  LayoutDashboard,
  Users
} from 'lucide-react'

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Scrape Now', href: '/scrape', icon: Clock },
  { name: 'Pending', href: '/pending', icon: Clock, badge: true },
  { name: 'Scheduled', href: '/scheduled', icon: Calendar },
  { name: 'Posted', href: '/posted', icon: Send },
  { name: 'Archived', href: '/archived', icon: Archive },
  { name: 'Accounts', href: '/accounts', icon: Users },
]

interface SidebarProps {
  counts?: Record<string, number>
}

export function Sidebar({ counts = {} }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-zinc-800 flex-shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">BN</span>
        </div>
        <span className="font-semibold text-white tracking-tight">BlankNightlife</span>
      </div>
      
      <nav className="flex flex-col gap-1 p-4 w-full flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const count = counts[item.name.toLowerCase()] || 0
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.name}</span>
              {item.badge && count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500/20 px-1.5 text-xs font-medium text-violet-400">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <ProfileSwitcher />
    </aside>
  )
}

