'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  GraduationCap, Layers, Award, FileText, User, MessageSquare, UserCheck,
  ChevronRight, X, LayoutDashboard, CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { useAuth } from '@/lib/context/auth-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TopNav } from '@/components/layout/top-nav'
import { DeveloperBrand } from '@/components/developer-brand'

interface NavItem {
  href: string
  icon: any
  label: string
  exact?: boolean
  children?: Array<{ href: string; label: string }>
}

const navItems: NavItem[] = [
  { href: '/school/academic-head', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/school/academic-head/academic-structure', icon: Layers, label: 'Academic Structure' },
  { href: '/school/academic-head/timetables', icon: CalendarDays, label: 'Timetables' },
  {
    href: '/school/academic-head/assessments',
    icon: GraduationCap,
    label: 'Assessments',
    children: [
      { href: '/school/academic-head/assessments/submissions', label: 'Mark Submissions & Approval' },
      { href: '/school/academic-head/assessments/bulk-assignment', label: 'Bulk Assessment Assignment' },
      { href: '/school/academic-head/assessments/policy', label: 'Assessment Policy' },
      { href: '/school/academic-head/assessments/reports', label: 'Assessment Reports' },
      { href: '/school/academic-head/assessments/types', label: 'Assessment Types' },
      { href: '/school/academic-head/assessments/templates', label: 'Assessment Templates' },
      { href: '/school/academic-head/assessments/configurations', label: 'Grade & Subject Config' },
    ],
  },
  { href: '/school/academic-head/exams', icon: Award, label: 'Exams & Grades' },
  { href: '/school/academic-head/report-cards', icon: FileText, label: 'Report Cards' },
  { href: '/school/academic-head/staff-attendance', icon: UserCheck, label: 'My Attendance' },
  { href: '/school/academic-head/communication', icon: MessageSquare, label: 'Communication' },
  { href: '/school/academic-head/profile', icon: User, label: 'My Profile' },
]

function AcademicNavItem({
  item,
  pathname,
  isCollapsed = false,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  isCollapsed?: boolean
  onNavigate?: () => void
}) {
  const hasChildren = Boolean(item.children && item.children.length > 0)
  const isParentActive = item.exact
    ? pathname === item.href
    : (pathname === item.href || pathname.startsWith(item.href + '/') || Boolean(item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))))

  const [manuallyExpanded, setManuallyExpanded] = useState<boolean | null>(null)

  useEffect(() => {
    setManuallyExpanded(null)
  }, [pathname])

  const expanded = hasChildren && (manuallyExpanded !== null ? manuallyExpanded : isParentActive)

  if (hasChildren && !isCollapsed) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setManuallyExpanded(!expanded)}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-semibold group cursor-pointer text-left',
            isParentActive
              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold'
              : 'text-foreground/70 hover:bg-violet-500/10 hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <item.icon className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              isParentActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
            )} />
            <span className="truncate">{item.label}</span>
          </div>
          <ChevronRight className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0',
            expanded && 'rotate-90 text-violet-600 dark:text-violet-400'
          )} />
        </button>

        {expanded && (
          <div className="pl-9 pr-2 py-1 space-y-1">
            {item.children!.map((child) => {
              const isChildActive = pathname === child.href
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                >
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors block truncate',
                      isChildActive
                        ? 'bg-violet-600 text-white font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-violet-500/10'
                    )}
                  >
                    {child.label}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const targetHref = hasChildren ? item.children![0].href : item.href

  return (
    <Link
      href={targetHref}
      title={isCollapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <div className={cn(
        'flex items-center gap-3 rounded-xl transition-all text-sm font-semibold group',
        isCollapsed ? 'justify-center p-3' : 'px-4 py-2.5',
        isParentActive
          ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold'
          : 'text-foreground/70 hover:bg-violet-500/10 hover:text-foreground'
      )}>
        <item.icon className={cn(
          "w-5 h-5 flex-shrink-0 transition-colors",
          isParentActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
        {!isCollapsed && isParentActive && !hasChildren && (
          <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
        )}
      </div>
    </Link>
  )
}

export default function AcademicHeadClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, sessionReady } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (!isMounted || !sessionReady) return null

  return (
    <AuthGuard allowedRoles={['academic_head', 'admin', 'school_admin', 'super_admin']}>
      <div className="flex h-screen bg-background flex-col md:flex-row relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px]" />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
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
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Academic Console</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user?.name || 'Academic Dean'}</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.map(item => (
              <AcademicNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
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
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-violet-600 dark:text-violet-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">Academic Console</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.name || 'Academic Dean'}</p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="mx-auto w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <GraduationCap className="w-5 h-5" />
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn('p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors', isCollapsed && 'mx-auto mt-2')}
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', !isCollapsed && 'rotate-180')} />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {navItems.map(item => (
              <AcademicNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                isCollapsed={isCollapsed}
              />
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
