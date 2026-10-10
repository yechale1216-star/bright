'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, User, CheckSquare, BarChart2, BookOpen,
  Settings, LogOut, MessageSquare, Phone, TrendingUp, Calendar,
  X, ChevronRight, Megaphone, MessageCircle, ShieldAlert, ShieldCheck, UserCheck,
  GraduationCap, FileText, Bus, Layers, Award, BarChart3, Clock,
  ScanFace, PieChart, ClipboardList, History
} from 'lucide-react'
import { cn } from "@/lib/utils/utils"

import { useAuth } from '@/lib/context/auth-context'
import { useSchool } from '@/lib/context/school-context'
import { AuthGuard } from '@/components/auth/auth-guard'
import { useRouter } from 'next/navigation'
import { notifications } from '@/lib/utils/notifications'
import { useUnread } from '@/lib/context/unread-context'
import { TopNav } from '@/components/layout/top-nav'
import { DeveloperBrand } from '@/components/developer-brand'

export interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  children?: Array<{ href: string; label: string }>;
  roles?: string[];
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

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

  const isActive = (path: string) => {
    if (!pathname) return false;
    const [targetPath] = path.split('?');
    if (path.includes('?')) {
      return pathname === targetPath;
    }
    return pathname === path || (path === '/school/admin/teachers' && pathname.startsWith('/school/admin/teacher-assignments'));
  };

  const isCommunicationPage = pathname?.includes('/communication')
  const { totalUnreadCount } = useUnread()

  const userRole = (user?.role || '').toLowerCase()
  const isExecutiveAdmin = ['admin', 'school_admin', 'super_admin'].includes(userRole)

  const portalTitle = React.useMemo(() => {
    switch (userRole) {
      case 'academic_head': return 'Academic Console'
      case 'librarian': return 'Library Desk'
      case 'transport_manager': return 'Transport Desk'
      case 'staff_attendance_officer':
      case 'hr_officer': return 'HR & Attendance'
      case 'registrar': return 'Registrar Hub'
      case 'discipline_officer': return 'Discipline Hub'
      default: return 'Admin Portal'
    }
  }, [userRole])

  const handleLogout = async () => {
    await logout()
    notifications.info("Logged Out", "You have been successfully logged out")
  }

  const allNavGroups: NavGroup[] = [
    {
      id: 'main',
      title: '',
      items: [
        { href: '/school/admin',                 icon: <LayoutDashboard className="w-5 h-5" />,  label: 'Dashboard' },
        { href: '/school/admin/students',         icon: <Users className="w-5 h-5" />,           label: 'Students',          roles: ['admin', 'school_admin', 'super_admin', 'registrar'] },
        { href: '/school/admin/teachers',         icon: <UserCheck className="w-5 h-5" />,       label: 'Teachers & Staff',  roles: ['admin', 'school_admin', 'super_admin', 'academic_head', 'staff_attendance_officer', 'hr_officer'] },
        { href: '/school/admin/academic-structure', icon: <Layers className="w-5 h-5" />,        label: 'Academics',         roles: ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar'] },
        {
          href: '/school/admin/assessments',
          icon: <GraduationCap className="w-5 h-5" />,
          label: 'Assessments',
          roles: ['admin', 'school_admin', 'super_admin', 'academic_head'],
          children: [
            { href: '/school/admin/assessments/types', label: 'Assessment Types' },
            { href: '/school/admin/assessments/templates', label: 'Assessment Templates' },
            { href: '/school/admin/assessments/configurations', label: 'Grade & Subject Configuration' },
            { href: '/school/admin/assessments/policy', label: 'Assessments' },
            { href: '/school/admin/assessments/submissions', label: 'Mark Submission & Approval' },
            { href: '/school/admin/assessments/reports', label: 'Assessment Reports' },
          ],
        },
        { href: '/school/admin/attendance',       icon: <CheckSquare className="w-5 h-5" />,     label: 'Attendance',        roles: ['admin', 'school_admin', 'super_admin', 'academic_head', 'discipline_officer'] },
        { href: '/school/admin/staff-attendance', icon: <Clock className="w-5 h-5" />,           label: 'Staff Attendance',  roles: ['admin', 'school_admin', 'super_admin', 'staff_attendance_officer', 'hr_officer'] },
        { href: '/school/admin/discipline',       icon: <ShieldAlert className="w-5 h-5" />,     label: 'Discipline',        roles: ['admin', 'school_admin', 'super_admin', 'discipline_officer'] },
        { href: '/school/admin/users-and-roles',  icon: <ShieldCheck className="w-5 h-5" />,     label: 'Users & Roles',     roles: ['admin', 'school_admin', 'super_admin'] },
        { href: '/school/admin/announcements',    icon: <Megaphone className="w-5 h-5" />,       label: 'Announcements' },
        { href: '/school/admin/communication',    icon: <MessageSquare className="w-5 h-5" />,   label: 'Communication',     badge: totalUnreadCount > 0 ? totalUnreadCount : undefined },
        { href: '/school/admin/settings',         icon: <Settings className="w-5 h-5" />,        label: 'Settings',          roles: ['admin', 'school_admin', 'super_admin'] },
      ],
    },
  ];

  const visibleNavGroups = React.useMemo(() => {
    return allNavGroups.map(group => {
      const filteredItems = group.items.filter(item => {
        if (!item.roles) return true;
        if (isExecutiveAdmin) return true;
        return item.roles.includes(userRole);
      });
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, isExecutiveAdmin, totalUnreadCount]);

  const allowedAdminRoles = [
    'admin',
    'school_admin',
    'super_admin',
    'academic_head',
    'librarian',
    'transport_manager',
    'staff_attendance_officer',
    'hr_officer',
    'registrar',
    'discipline_officer',
  ]

  if (!isMounted) return null

  return (
    <AuthGuard allowedRoles={allowedAdminRoles}>
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
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-card/80 backdrop-blur-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm tracking-tight text-foreground">{portalTitle}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'School Admin'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground ml-auto">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto min-h-0 py-4 px-3 space-y-4 no-scrollbar">
                  {visibleNavGroups.map(group => (
                    <div key={group.id} className="space-y-1">
                      <div className="px-3 pt-2 pb-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                          {group.title}
                        </p>
                      </div>
                      {group.items.map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                          <div className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold group",
                            isActive(item.href) ? 'bg-primary/15 text-primary shadow-sm font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-primary/5 hover:text-primary'
                          )}>
                            <span className={cn(
                              "transition-colors flex-shrink-0",
                              isActive(item.href) ? 'text-primary' : 'text-primary/70 group-hover:text-primary'
                            )}>{item.icon}</span>
                            <span className="flex-1 truncate">{item.label}</span>
                            {(item as any).badge && (
                              <span className="h-5 min-w-[20px] px-1.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                                {(item as any).badge}
                              </span>
                            )}
                            {isActive(item.href) && !(item as any).badge && <ChevronRight className="w-4 h-4" />}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </nav>

                <div className="shrink-0 p-4 border-t border-border/80 text-center bg-card/50">
                  <DeveloperBrand type="powered" />
                </div>
              </aside>

              <aside className={cn(
                "hidden md:flex border-r border-border bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl flex-col relative z-20 transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
              )}>
                <div className="h-16 px-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm tracking-tight text-foreground">{portalTitle}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.name || 'School Admin'}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                      "p-1.5 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                      isCollapsed && "mx-auto mt-2"
                    )}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", !isCollapsed && "rotate-180")} />
                  </button>
                </div>

                <nav className="flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar">
                  {visibleNavGroups.map(group => (
                    <div key={group.id} className="space-y-1">
                      {!isCollapsed && group.title ? (
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                            {group.title}
                          </p>
                        </div>
                      ) : isCollapsed ? (
                        <div className="my-2 border-t border-border/50" />
                      ) : null}
                      {group.items.map(item => (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          active={isActive(item.href) || (Boolean(item.children) && Boolean(pathname?.startsWith('/school/admin/assessments')))}
                          isCollapsed={isCollapsed}
                          badge={(item as any).badge}
                          children={item.children}
                          currentPath={pathname}
                        />
                      ))}
                    </div>
                  ))}
                </nav>

                <div className={cn("p-4 border-t border-border/80 text-center bg-card/50", isCollapsed && "hidden")}>
                  <DeveloperBrand type="powered" collapsed={isCollapsed} />
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
                      <MobileTabLink href="/school/admin/students" icon={<Users className="w-5 h-5" />} label="Students" active={isActive('/school/admin/students')} />
                      <MobileTabLink href="/school/admin/attendance" icon={<CheckSquare className="w-5 h-5" />} label="Attendance" active={isActive('/school/admin/attendance')} />
                      <MobileTabLink href="/school/admin/announcements" icon={<Megaphone className="w-5 h-5" />} label="Alerts" active={isActive('/school/admin/announcements')} />
                      <MobileTabLink href="/school/admin/communication" icon={<MessageCircle className="w-5 h-5" />} label="Chat" active={isActive('/school/admin/communication')} badge={totalUnreadCount > 0 ? totalUnreadCount : undefined} />
                    </div>
                  </nav>
                )}
              </div>
            </div>
    </AuthGuard>
  )
}

function NavLink({
  href,
  icon,
  label,
  active,
  isCollapsed,
  badge,
  children,
  currentPath,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  isCollapsed?: boolean;
  badge?: number;
  children?: Array<{ href: string; label: string }>;
  currentPath?: string;
}) {
  const [expanded, setExpanded] = useState(
    Boolean(currentPath?.startsWith('/school/admin/assessments') && label === 'Assessments')
  );

  const hasChildren = Boolean(children && children.length > 0 && !isCollapsed);

  return (
    <div className="space-y-1">
      <Link
        href={hasChildren ? children![0].href : href}
        onClick={(e) => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
        }}
        title={isCollapsed ? label : undefined}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl transition-all duration-200 text-sm font-semibold group cursor-pointer',
            isCollapsed ? 'justify-center p-3' : 'px-4 py-2.5',
            active || (hasChildren && expanded)
              ? 'bg-primary/15 text-primary shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-primary/5 hover:text-primary'
          )}
        >
          <span
            className={cn(
              'transition-colors flex-shrink-0',
              active ? 'text-primary' : 'text-primary/70 group-hover:text-primary'
            )}
          >
            {icon}
          </span>
          {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
          {!isCollapsed && badge && (
            <span className="ml-auto h-5 min-w-[20px] px-1.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-sm">
              {badge}
            </span>
          )}
          {!isCollapsed && hasChildren && (
            <ChevronRight
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200 ml-auto',
                expanded && 'rotate-90 text-primary'
              )}
            />
          )}
        </div>
      </Link>

      {/* Submenu Children */}
      {hasChildren && expanded && (
        <div className="pl-9 pr-2 py-1 space-y-1">
          {children!.map((child) => {
            const isChildActive = currentPath === child.href;
            return (
              <Link key={child.href} href={child.href}>
                <div
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors block truncate',
                    isChildActive
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {child.label}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
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
