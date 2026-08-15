'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  ClipboardList,
  Tag,
  Sliders,
  GraduationCap,
  User,
  LogOut,
  X,
  ChevronRight,
  Scale,
  Sparkles,
  ShieldAlert,
  PieChart
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { useAuth } from '@/lib/context/auth-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TopNav } from '@/components/layout/top-nav'
import { notifications } from '@/lib/utils/notifications'
import { DeveloperBrand } from '@/components/developer-brand'

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    group: 'DISCIPLINE MANAGEMENT',
    items: [
      { href: '/school/discipline-officer', icon: BarChart3, label: 'Dashboard & Analytics', exact: true },
      { href: '/school/discipline-officer/incidents', icon: ClipboardList, label: 'Discipline Cases Directory' },
      { href: '/school/discipline-officer/categories', icon: Tag, label: 'Incident Categories' },
      { href: '/school/discipline-officer/actions', icon: Sliders, label: 'Disciplinary Actions' },
    ],
  },
  {
    group: 'ACCOUNT',
    items: [
      { href: '/school/discipline-officer/profile', icon: User, label: 'My Profile' },
    ],
  },
]

export default function DisciplineOfficerClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    await logout()
    notifications.info('Logged Out', 'You have been successfully logged out')
  }

  if (!isMounted) return null

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className={cn('flex items-center justify-between px-5 py-4 border-b border-border/80', mobile && 'flex items-center')}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Scale className="w-5 h-5 text-amber-500" />
          </div>
          {(!isCollapsed || mobile) && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-foreground">Conduct Portal</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
              </div>
              <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'Officer'}</p>
            </div>
          )}
        </div>

        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground ml-auto">
            <X className="w-5 h-5" />
          </button>
        )}

        {!mobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn('p-1.5 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors', isCollapsed && 'mx-auto mt-2')}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform duration-300', !isCollapsed && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {(!isCollapsed || mobile) && (
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href, item.exact)
              return (
                <Link key={item.href} href={item.href} title={!mobile && isCollapsed ? item.label : undefined}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-xl transition-all duration-200 text-sm font-semibold relative group',
                      !mobile && isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2.5',
                      active
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-foreground'
                    )}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-500 rounded-r-full" />
                    )}
                    <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', active ? 'text-amber-500' : 'text-slate-400 group-hover:text-foreground')} />
                    {(mobile || !isCollapsed) && <span className="truncate">{item.label}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer Branding */}
      <div className={cn("p-4 border-t border-border/80 text-center bg-card/50", !mobile && isCollapsed && "hidden")}>
        <DeveloperBrand type="powered" collapsed={!mobile && isCollapsed} />
      </div>
    </div>
  )

  return (
    <AuthGuard allowedRoles={['discipline_officer']}>
      <div className="flex h-screen bg-background flex-col md:flex-row relative overflow-hidden">
        {/* Background glow graphics */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px]" />
        </div>

        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Mobile Drawer Sidebar */}
        <aside
          className={cn(
            'md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col shadow-2xl transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarContent mobile />
        </aside>

        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden md:flex border-r border-border bg-card/80 backdrop-blur-xl flex-col relative z-20 transition-all duration-300',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          <SidebarContent />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <TopNav showMenuButton onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex flex-col overflow-auto">{children}</main>
        </div>
      </div>
    </AuthGuard>
  )
}
