'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  UserCheck,
  MessageSquare,
  User,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { useAuth } from '@/lib/context/auth-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TopNav } from '@/components/layout/top-nav'
import { notifications } from '@/lib/utils/notifications'
import { DeveloperBrand } from '@/components/developer-brand'
import { useUnread } from '@/lib/context/unread-context'
import { PageSkeleton } from '@/components/ui/page-skeleton'

const navItems = [
  { href: '/school/staff', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/school/staff/attendance', icon: UserCheck, label: 'My Attendance' },
  { href: '/school/staff/communication', icon: MessageSquare, label: 'Announcements & Messages' },
  { href: '/school/staff/profile', icon: User, label: 'My Profile' },
]

export default function StaffClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, sessionReady } = useAuth()
  const { totalUnreadCount } = useUnread()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    await logout()
    notifications.info('Logged Out', 'You have been successfully logged out')
  }

  if (!isMounted || !sessionReady) return <PageSkeleton variant="dashboard" />

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background flex-col md:flex-row relative overflow-hidden">
        {/* Decorative Background glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            'md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col shadow-2xl transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Staff Portal</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user?.name}</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.href.includes('communication') && totalUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                      {totalUnreadCount}
                    </span>
                  )}
                  <ChevronRight className={cn('w-4 h-4 opacity-40', active && 'opacity-80')} />
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-border mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r border-border bg-card/80 backdrop-blur-xl flex-col relative z-20">
          <div className="h-16 px-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-primary/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-foreground">Staff Portal</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'Staff Member'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4 shrink-0 transition-transform group-hover:scale-110', active ? 'text-primary-foreground' : 'text-primary')} />
                    <span>{item.label}</span>
                  </div>
                  {item.href.includes('communication') && totalUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                      {totalUnreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-border mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
          <DeveloperBrand />
        </div>
      </div>
    </AuthGuard>
  )
}
