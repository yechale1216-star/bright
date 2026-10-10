'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Clock, ScanFace, Users, User, MessageSquare, UserCheck,
  ChevronRight, X
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { useAuth } from '@/lib/context/auth-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TopNav } from '@/components/layout/top-nav'
import { DeveloperBrand } from '@/components/developer-brand'

const navItems = [
  { href: '/school/staff-hr', icon: Clock, label: 'Live Staff Attendance', exact: true },
  { href: '/school/staff-hr/biometrics', icon: ScanFace, label: 'Biometric Face Registration' },
  { href: '/school/staff-hr/staff', icon: Users, label: 'Staff Directory' },
  { href: '/school/staff-hr/staff-attendance', icon: UserCheck, label: 'My Attendance' },
  { href: '/school/staff-hr/communication', icon: MessageSquare, label: 'Communication' },
  { href: '/school/staff-hr/profile', icon: User, label: 'My Profile' },
]

export default function StaffHrClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, sessionReady } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  if (!isMounted || !sessionReady) return null

  return (
    <AuthGuard allowedRoles={['staff_attendance_officer', 'hr_officer', 'admin', 'school_admin', 'super_admin']}>
      <div className="flex h-screen bg-background flex-col md:flex-row relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px]" />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col shadow-2xl transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">HR & Operations Desk</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user?.name || 'HR Officer'}</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold group',
                  isActive(item.href, item.exact)
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive(item.href, item.exact) && <ChevronRight className="w-4 h-4" />}
                </div>
              </Link>
            ))}
          </nav>
          <div className="shrink-0 p-4 border-t border-border text-center bg-card/50">
            <DeveloperBrand type="powered" />
          </div>
        </aside>

        {/* Desktop Sidebar */}
        <aside className={cn(
          'hidden md:flex border-r border-border bg-card/80 backdrop-blur-xl flex-col relative z-20 transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-64'
        )}>
          <div className="h-16 px-4 border-b border-border flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0 text-teal-600 dark:text-teal-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">HR & Operations Desk</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.name || 'HR Officer'}</p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="mx-auto w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Clock className="w-5 h-5" />
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn('p-2 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors', isCollapsed && 'mx-auto mt-2')}
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', !isCollapsed && 'rotate-180')} />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} title={isCollapsed ? item.label : undefined}>
                <div className={cn(
                  'flex items-center gap-3 rounded-xl transition-all text-sm font-semibold group',
                  isCollapsed ? 'justify-center p-3' : 'px-4 py-2.5',
                  isActive(item.href, item.exact)
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-teal-500/5 hover:text-teal-600 dark:hover:text-teal-400'
                )}>
                  <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive(item.href, item.exact) ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground group-hover:text-teal-500")} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            ))}
          </nav>
          <div className={cn("p-4 border-t border-border/80 text-center bg-card/50", isCollapsed && "hidden")}>
            <DeveloperBrand type="powered" collapsed={isCollapsed} />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <TopNav showMenuButton onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex flex-col overflow-auto pb-4">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
