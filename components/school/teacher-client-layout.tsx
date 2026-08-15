'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, LogOut, User, CheckSquare, BarChart2, BookOpen, 
  MessageSquare, X, ChevronRight, ShieldBan, HeadphonesIcon, Sun, Moon, Sparkles, ShieldAlert, GraduationCap
} from 'lucide-react'
import { useAuth } from '@/lib/context/auth-context'
import { useSchool } from '@/lib/context/school-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { useRouter } from 'next/navigation'
import { notifications } from '@/lib/utils/notifications'
import { cn } from '@/lib/utils/utils'
import { useTheme } from '@/components/theme-provider'
import { TopNav } from '@/components/layout/top-nav'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LanguageProvider } from '@/lib/context/language-context'
import { Button } from '@/components/ui/button'
import { useUnread } from '@/lib/context/unread-context'
import { DeveloperBrand } from '@/components/developer-brand'

export default function TeacherClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TeacherClientLayoutContent>{children}</TeacherClientLayoutContent>
  )
}

function TeacherClientLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showBottomNav, setShowBottomNav] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const { totalUnreadCount } = useUnread()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      setShowBottomNav(false)
    } else {
      setShowBottomNav(true)
    }
    setLastScrollY(currentScrollY)
  }

  const isActive = (path: string) => pathname === path
  const isCommunicationPage = pathname?.includes('/communication')

  const handleLogout = async () => {
    await logout()
    notifications.info("Logged Out", "You have been successfully logged out")
  }

  if (!mounted) return <PageSkeleton variant="dashboard" />

  const navItems = [
    { href: "/school/teacher", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
    { href: "/school/teacher/communication", icon: <MessageSquare className="w-5 h-5" />, label: "Messages", badge: totalUnreadCount > 0 ? totalUnreadCount : undefined },
    { href: "/school/teacher/attendance", icon: <CheckSquare className="w-5 h-5" />, label: "Attendance" },
    { href: "/school/teacher/classes", icon: <BookOpen className="w-5 h-5" />, label: "Classes" },
    { href: "/school/teacher/reports", icon: <BarChart2 className="w-5 h-5" />, label: "Reports" },
    { href: "/school/teacher/profile", icon: <User className="w-5 h-5" />, label: "Profile" },
  ]

  return (
    <AuthGuard allowedRoles={['teacher']}>
      <LanguageProvider>
            <div className="flex h-screen bg-background dark:bg-slate-950 flex-col md:flex-row relative overflow-hidden">
              
              <aside className="hidden md:flex w-64 border-r border-border bg-card/70 dark:bg-slate-900/70 backdrop-blur-xl flex-col relative z-20">
                <div className="h-16 px-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <GraduationCap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm tracking-tight text-foreground">Teacher Portal</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'Teacher'}</p>
                    </div>
                  </div>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
                  {navItems.map(item => (
                    <NavLink 
                      key={item.href} 
                      href={item.href} 
                      icon={item.icon} 
                      label={item.label} 
                      active={isActive(item.href)}
                      badge={item.badge}
                    />
                  ))}

                  <button
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer group mt-2"
                  >
                    <div className="flex items-center gap-3">
                      {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    <div className={cn("w-8 h-4 rounded-full p-0.5 transition-colors", isDark ? "bg-primary" : "bg-slate-300 dark:bg-slate-700")}>
                      <div className={cn("w-3 h-3 rounded-full bg-white transition-transform", isDark ? "translate-x-4" : "translate-x-0")} />
                    </div>
                  </button>
                </nav>
                <div className="p-4 border-t border-border mt-auto text-center bg-card/50">
                  <DeveloperBrand type="powered" />
                </div>
              </aside>

              {sidebarOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              )}
              <aside className={cn(
                "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card dark:bg-slate-900 border-r border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out overflow-hidden",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              )}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-card/80 backdrop-blur-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <GraduationCap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm tracking-tight text-foreground">Teacher Portal</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'Teacher'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground ml-auto">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                 <nav className="flex-1 overflow-y-auto min-h-0 p-4 space-y-1">
                   {navItems.map(item => (
                     <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                        <div className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mb-1 group transition-all",
                          isActive(item.href) ? 'bg-primary/15 text-primary font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-primary/5 hover:text-primary'
                        )}>
                          <span className={isActive(item.href) ? 'text-primary' : 'text-primary/70 group-hover:text-primary'}>{item.icon}</span>
                          <span className="flex-1">{item.label}</span>
                          {isActive(item.href) && <ChevronRight className="w-4 h-4" />}
                        </div>
                     </Link>
                   ))}

                   <button
                     onClick={() => setTheme(isDark ? 'light' : 'dark')}
                     className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold mb-1 text-muted-foreground hover:bg-muted transition-all cursor-pointer group mt-1"
                   >
                     <div className="flex items-center gap-3">
                       {isDark ? <Moon className="w-5 h-5 text-slate-500" /> : <Sun className="w-5 h-5 text-slate-500" />}
                       <span className="flex-1 text-left">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                     </div>
                     <div className="flex h-5 w-9 items-center rounded-full bg-primary/20 px-0.5 pointer-events-none">
                       <div className={cn(
                         "h-4 w-4 rounded-full bg-primary shadow transition-transform duration-300",
                         isDark ? 'translate-x-4' : 'translate-x-0'
                       )} />
                     </div>
                   </button>
                </nav>
                 <div className="shrink-0 p-4 border-t border-border text-center bg-card/50 pb-safe">
                   <DeveloperBrand type="powered" />
                 </div>
              </aside>

              <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
                {!isCommunicationPage && <TopNav showMenuButton onMenuClick={() => setSidebarOpen(true)} />}
                <main 
                  className={cn("flex-1 flex flex-col overflow-auto focus:outline-none relative", !isCommunicationPage && "pb-20 md:pb-0")}
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
                      <MobileTabLink href="/school/teacher" icon={<LayoutDashboard className="w-5 h-5" />} label="Home" active={isActive('/school/teacher')} />
                      <MobileTabLink href="/school/teacher/communication" icon={<MessageSquare className="w-5 h-5" />} label="Chat" active={isActive('/school/teacher/communication')} />
                      <MobileTabLink href="/school/teacher/attendance" icon={<CheckSquare className="w-5 h-5" />} label="Check" active={isActive('/school/teacher/attendance')} />
                      <MobileTabLink href="/school/teacher/classes" icon={<BookOpen className="w-5 h-5" />} label="Classes" active={isActive('/school/teacher/classes')} />
                      <MobileTabLink href="/school/teacher/profile" icon={<User className="w-5 h-5" />} label="Profile" active={isActive('/school/teacher/profile')} />
                    </div>
                  </nav>
                )}
              </div>
            </div>
        </LanguageProvider>
    </AuthGuard>
  )
}

function NavLink({ href, icon, label, active, badge }: { href: string, icon: React.ReactNode, label: string, active: boolean, badge?: number }) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold grow-0 group relative",
        active ? "bg-primary/15 text-primary shadow-sm font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-primary/5 hover:text-primary"
      )}>
        <div className="flex items-center gap-3">
          <span className={active ? "text-primary" : "text-primary/70 group-hover:text-primary"}>{icon}</span>
          <span>{label}</span>
        </div>
        {badge && (
          <span className="h-5 min-w-[20px] px-1.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-sm">
            {badge}
          </span>
        )}
      </div>
    </Link>
  )
}

function MobileTabLink({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active: boolean }) {
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
