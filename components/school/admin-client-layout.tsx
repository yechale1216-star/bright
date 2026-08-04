'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, User, CheckSquare, BarChart2, BookOpen,
  Settings, LogOut, MessageSquare, Phone, TrendingUp,
  X, ChevronRight, Megaphone, MessageCircle, ShieldAlert, ShieldCheck
} from 'lucide-react'
import { cn } from "@/lib/utils/utils"

import { useAuth } from '@/lib/context/auth-context'
import { useSchool } from '@/lib/context/school-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { useRouter } from 'next/navigation'
import { notifications } from '@/lib/utils/notifications'
import { Logo } from '@/components/logo'
import { TopNav } from '@/components/layout/top-nav'




export default function SchoolAdminClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const { user, logout } = useAuth()
  const { clearSchoolContext } = useSchool()
  const [isMounted, setIsMounted] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [showBottomNav, setShowBottomNav] = React.useState(true)
  const [lastScrollY, setLastScrollY] = React.useState(0)

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop
    const diff = currentScrollY - lastScrollY

    if (diff > 5 && currentScrollY > 100) {
      setShowBottomNav(false)
    } else if (diff < -5) {
      setShowBottomNav(true)
    }
    setLastScrollY(currentScrollY)
  }

  React.useEffect(() => {
    const handleChatScroll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.direction === 'down') {
        setShowBottomNav(false);
      } else if (customEvent.detail?.direction === 'up') {
        setShowBottomNav(true);
      }
    };

    window.addEventListener('chat-scroll', handleChatScroll);
    return () => window.removeEventListener('chat-scroll', handleChatScroll);
  }, []);

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    (window as any).goBack = () => router.push('/school/admin')
  }, [router])


  React.useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path
  const isCommunicationPage = pathname?.includes('/communication')

  const handleLogout = async () => {
    await logout()
    notifications.info("Logged Out", "You have been successfully logged out")
  }

  if (!isMounted) return null

  const allNavItems = [
    { href: '/school/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', show: true },
    { href: '/school/admin/announcements', icon: <Megaphone className="w-5 h-5" />, label: 'Announcements', show: true },
    { href: '/school/admin/communication', icon: <MessageSquare className="w-5 h-5" />, label: 'Communication', show: true },
    { href: '/school/admin/calls', icon: <Phone className="w-5 h-5" />, label: 'Calls', show: true },
    { href: '/school/admin/students', icon: <Users className="w-5 h-5" />, label: 'Students', show: true },
    { href: '/school/admin/teachers', icon: <User className="w-5 h-5" />, label: 'Teachers', show: true },
    { href: '/school/admin/users-and-roles', icon: <ShieldCheck className="w-5 h-5" />, label: 'Users & Roles', show: true },
    { href: '/school/admin/teacher-assignments', icon: <BookOpen className="w-5 h-5" />, label: 'Assignments', show: true },
    { href: '/school/admin/attendance', icon: <CheckSquare className="w-5 h-5" />, label: 'Attendance', show: true },
    { href: '/school/admin/attendance-by-grade', icon: <BarChart2 className="w-5 h-5" />, label: 'Analytics', show: true },
    { href: '/school/admin/reports', icon: <BookOpen className="w-5 h-5" />, label: 'Reports', show: true },
    { href: '/school/admin/discipline', icon: <ShieldAlert className="w-5 h-5" />, label: 'Discipline', show: true },
    { href: '/school/admin/promotion', icon: <TrendingUp className="w-5 h-5" />, label: 'Promotion', show: true },
    { href: '/school/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings', show: true },
    { href: '/school/admin/profile', icon: <User className="w-5 h-5" />, label: 'Profile', show: true },
  ]

  return (
    <AuthGuard allowedRoles={['admin', 'school_admin']}>
      <div className="flex h-screen bg-background dark:bg-slate-950 flex-col md:flex-row relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" />
              </div>

              {sidebarOpen && (
                <div
                  className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              <aside
                className={cn(
                  "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card dark:bg-slate-900 border-r border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out overflow-hidden",
                  sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80 backdrop-blur-xl">
                  <Logo size="sm" href="/school/admin" />
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto min-h-0 py-4 px-3 space-y-1 no-scrollbar">
                  {allNavItems.map(item => (
                    <Link key={item.href} href={item.href}>
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold group",
                        isActive(item.href) ? 'bg-primary/15 text-primary shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}>
                        <span className={isActive(item.href) ? 'text-primary' : 'text-slate-500 group-hover:text-foreground'}>{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {isActive(item.href) && <ChevronRight className="w-4 h-4" />}
                      </div>
                    </Link>
                  ))}

                </nav>

                <div className="shrink-0 p-3 border-t border-border space-y-1.5">
                  <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition text-sm font-semibold">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </aside>

              <aside className={cn(
                "hidden md:flex border-r border-border bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl flex-col relative z-20 transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
              )}>
                <div className="h-16 px-4 border-b border-border flex items-center justify-between">
                  {!isCollapsed && <Logo size="sm" href="/school/admin" />}
                  {isCollapsed && (
                    <div className="mx-auto">
                      <Logo size="sm" href="/school/admin" iconOnly />
                    </div>
                  )}
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                      "p-2 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                      isCollapsed && "mx-auto mt-2"
                    )}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <X className="w-5 h-5 opacity-0 hover:opacity-100 hidden" />}
                  </button>
                </div>

                <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto no-scrollbar">
                  {allNavItems.map(item => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={isActive(item.href)}
                      isCollapsed={isCollapsed}
                    />
                  ))}
                </nav>

                <div className="p-3 border-t border-border">
                  <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Sign Out" : undefined}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition text-sm font-semibold",
                      isCollapsed ? "justify-center p-3" : "px-4 py-2.5"
                    )}
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span>Sign Out</span>}
                  </button>
                </div>
              </aside>

              <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
                {!isCommunicationPage && <TopNav showMenuButton onMenuClick={() => setSidebarOpen(true)} />}

                <main
                  className={cn(
                    "flex-1 flex flex-col overflow-auto relative min-h-0",
                    !isCommunicationPage && "pb-20 md:pb-0"
                  )}
                  onScroll={handleMainScroll}
                >
                  <div className="flex-1 flex flex-col min-h-0">
                    {children}
                  </div>
                </main>

                {!isCommunicationPage && (
                  <nav className={cn(
                    "md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/80 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] pb-safe",
                    !showBottomNav ? "translate-y-full" : "translate-y-0"
                  )}>
                    <div className="flex items-stretch justify-around h-16 px-2">
                      <MobileTabLink href="/school/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="Home" active={isActive('/school/admin')} />
                      <MobileTabLink href="/school/admin/announcements" icon={<Megaphone className="w-5 h-5" />} label="Alerts" active={isActive('/school/admin/announcements')} />
                      <MobileTabLink href="/school/admin/attendance-by-grade" icon={<BarChart2 className="w-5 h-5" />} label="Stats" active={isActive('/school/admin/attendance-by-grade')} />
                      <MobileTabLink href="/school/admin/attendance" icon={<CheckSquare className="w-5 h-5" />} label="Presence" active={isActive('/school/admin/attendance')} />
                      <MobileTabLink href="/school/admin/communication" icon={<MessageCircle className="w-5 h-5" />} label="Chat" active={isActive('/school/admin/communication')} />
                    </div>
                  </nav>
                )}
              </div>
            </div>
    </AuthGuard>
  )
}

function NavLink({ href, icon, label, active, isCollapsed }: { href: string, icon: React.ReactNode, label: string, active: boolean, isCollapsed?: boolean }) {
  return (
    <Link href={href} title={isCollapsed ? label : undefined}>
      <div className={cn(
        "flex items-center gap-3 rounded-xl transition-all duration-200 text-sm font-semibold group",
        isCollapsed ? "justify-center p-3" : "px-4 py-2.5",
        active ? 'bg-primary/15 text-primary shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}>
        <span className={cn(
          "transition-colors flex-shrink-0",
          active ? 'text-primary' : 'text-slate-500 group-hover:text-foreground'
        )}>{icon}</span>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </div>
    </Link>
  )
}

function MobileTabLink({ href, icon, label, active, badge }: { href: string, icon: React.ReactNode, label: string, active: boolean, badge?: number }) {
  return (
    <Link href={href} className="flex-1 relative group active:scale-95 transition-transform duration-100">
      <div className={cn(
        "flex flex-col items-center justify-center gap-1 h-full transition-all duration-300",
        active ? 'text-primary' : 'text-muted-foreground/60'
      )}>
        <div className={cn(
          "relative p-1 rounded-xl transition-all duration-300",
          active ? "bg-primary/10 scale-110" : ""
        )}>
          {icon}
          {active && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
          )}
          {badge !== undefined && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full ring-2 ring-background">
              {badge}
            </span>
          )}
        </div>
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest transition-all duration-300",
          active ? "opacity-100 translate-y-0" : "opacity-40"
        )}>
          {label}
        </span>
      </div>
    </Link>
  )
}
