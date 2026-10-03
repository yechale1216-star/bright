"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Command } from "cmdk"
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  User, 
  UserCheck,
  UserPlus,
  GraduationCap,
  CheckSquare, 
  BarChart2, 
  BarChart3,
  BookOpen, 
  Settings, 
  Megaphone, 
  MessageSquare, 
  ShieldAlert, 
  ShieldCheck,
  TrendingUp, 
  CalendarDays,
  Calendar,
  Bell,
  Tag,
  Sliders,
  ClipboardList,
  Building2,
  LogOut,
  Moon,
  Sun,
  Lock,
  ArrowRight,
  Sparkles
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/context/auth-context"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils/utils"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PortalType = 'admin' | 'teacher' | 'staff' | 'parent' | 'registrar' | 'discipline_officer' | 'restricted'

interface CommandItem {
  title: string
  subtitle?: string
  href: string
  icon: React.ElementType
  keywords?: string[]
}

interface PortalConfig {
  id: PortalType
  name: string
  badgeClass: string
  searchPlaceholder: string
  navigation: CommandItem[]
  quickActions: CommandItem[]
}

/**
 * Determine the user's active portal with strict security enforcement.
 * Lower-privilege users (e.g. staff, parents, teachers) CANNOT access or see
 * commands, links, or actions from higher-privilege portals.
 */
function resolveAuthorizedPortal(role?: string, pathname: string = ""): PortalType {
  const normalizedRole = (role || "").toLowerCase().trim()

  // 1. Staff isolation: staff members are strictly locked to staff portal
  if (normalizedRole === "staff" || normalizedRole === "staff_member") {
    return "staff"
  }

  // 2. Parent isolation: parents are strictly locked to parent portal
  if (normalizedRole === "parent") {
    return "parent"
  }

  // 3. Teacher isolation: teachers can only access teacher portal
  if (normalizedRole === "teacher") {
    return "teacher"
  }

  // 4. Registrar isolation: registrar can only access registrar portal
  if (normalizedRole === "registrar") {
    return "registrar"
  }

  // 5. Discipline Officer isolation: locked to discipline officer portal
  if (normalizedRole === "discipline_officer") {
    return "discipline_officer"
  }

  // 6. Administrator roles: can access admin console, or view portal context if currently navigating it
  if (
    normalizedRole === "admin" || 
    normalizedRole === "school_admin" || 
    normalizedRole === "super_admin"
  ) {
    if (pathname.startsWith("/school/teacher")) return "teacher"
    if (pathname.startsWith("/school/staff")) return "staff"
    if (pathname.startsWith("/school/registrar")) return "registrar"
    if (pathname.startsWith("/school/discipline-officer")) return "discipline_officer"
    return "admin"
  }

  // 7. Context fallback based on path ONLY IF user role isn't already assigned
  if (!normalizedRole) {
    if (pathname.startsWith("/parent")) return "parent"
    if (pathname.startsWith("/school/staff")) return "staff"
    if (pathname.startsWith("/school/teacher")) return "teacher"
    if (pathname.startsWith("/school/registrar")) return "registrar"
    if (pathname.startsWith("/school/discipline-officer")) return "discipline_officer"
    return "restricted"
  }

  // Unknown role - default to staff for security
  return "staff"
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname() || ""
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const runCommand = React.useCallback((command: () => void) => {
    onOpenChange(false)
    command()
  }, [onOpenChange])

  // Resolve authorized portal
  const activePortal = resolveAuthorizedPortal(user?.role, pathname)

  // Portal-specific command registries
  const portalConfigs: Record<PortalType, PortalConfig> = {
    // ── STAFF PORTAL (Completely isolated: no admin or parent commands) ──
    staff: {
      id: "staff",
      name: "Staff Portal",
      badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      searchPlaceholder: "Search staff portal, attendance, announcements...",
      navigation: [
        { title: "Staff Dashboard", subtitle: "Overview and daily status", href: "/school/staff", icon: LayoutDashboard, keywords: ["home", "main"] },
        { title: "My Attendance", subtitle: "View clock-in records and attendance history", href: "/school/staff/attendance", icon: UserCheck, keywords: ["clock in", "check in", "history", "time"] },
        { title: "Messages & Communication", subtitle: "Chat with administration and teachers", href: "/school/staff/communication", icon: MessageSquare, keywords: ["chat", "inbox"] },
        { title: "Staff Announcements", subtitle: "Official notices and school updates", href: "/school/staff/announcements", icon: Megaphone, keywords: ["news", "alerts"] },
        { title: "My Profile", subtitle: "Personal account and contact information", href: "/school/staff/profile", icon: User, keywords: ["account", "details"] },
      ],
      quickActions: [
        { title: "View Attendance Records", subtitle: "Check your recent attendance history", href: "/school/staff/attendance", icon: UserCheck },
        { title: "Read School Notices", subtitle: "Check the latest published announcements", href: "/school/staff/announcements", icon: Megaphone },
        { title: "Open Staff Messages", subtitle: "View unread communications", href: "/school/staff/communication", icon: MessageSquare },
        { title: "Update Profile Info", subtitle: "Review your personal profile", href: "/school/staff/profile", icon: User },
      ]
    },

    // ── PARENT PORTAL (Completely isolated: no admin or staff commands) ──
    parent: {
      id: "parent",
      name: "Parent Portal",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      searchPlaceholder: "Search parent portal, children, attendance, notices...",
      navigation: [
        { title: "Parent Dashboard", subtitle: "Student status and quick metrics", href: "/parent/dashboard", icon: LayoutDashboard, keywords: ["home", "children"] },
        { title: "Child Attendance", subtitle: "Daily and monthly attendance records", href: "/parent/attendance", icon: Calendar, keywords: ["present", "absent", "records"] },
        { title: "Communication & Chat", subtitle: "Message child's teachers and school", href: "/parent/communication", icon: MessageSquare, keywords: ["messages", "chat", "teacher"] },
        { title: "School Announcements", subtitle: "Official bulletins and notices", href: "/parent/announcements", icon: Megaphone, keywords: ["news", "alerts", "circulars"] },
        { title: "Discipline Records", subtitle: "Student incident and behavior updates", href: "/parent/discipline", icon: ShieldAlert, keywords: ["conduct", "behavior", "cases"] },
        { title: "Notifications", subtitle: "Recent activity and alerts", href: "/parent/notifications", icon: Bell, keywords: ["unread", "alerts"] },
        { title: "Parent Profile", subtitle: "Emergency contacts and personal info", href: "/parent/profile", icon: User, keywords: ["account", "phone", "settings"] },
        { title: "Switch School", subtitle: "Switch between registered schools", href: "/parent/school-select", icon: Building2, keywords: ["institution", "change"] },
      ],
      quickActions: [
        { title: "View Today's Attendance", subtitle: "Check if your child arrived at school", href: "/parent/attendance", icon: CheckSquare },
        { title: "Message Child's Teacher", subtitle: "Start a conversation with teachers", href: "/parent/communication", icon: MessageSquare },
        { title: "Check Discipline Incidents", subtitle: "View any reported school incidents", href: "/parent/discipline", icon: ShieldAlert },
        { title: "Read Announcements", subtitle: "Stay informed on school events", href: "/parent/announcements", icon: Megaphone },
      ]
    },

    // ── TEACHER PORTAL (Teacher tools only) ──
    teacher: {
      id: "teacher",
      name: "Teacher Portal",
      badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800",
      searchPlaceholder: "Search teacher portal, classes, attendance...",
      navigation: [
        { title: "Teacher Dashboard", subtitle: "Daily schedule and summaries", href: "/school/teacher", icon: LayoutDashboard, keywords: ["home", "overview"] },
        { title: "Take Student Attendance", subtitle: "Record presence for assigned classes", href: "/school/teacher/attendance", icon: CheckSquare, keywords: ["roll call", "mark attendance", "present", "absent"] },
        { title: "My Staff Attendance", subtitle: "Clock in and view your attendance", href: "/school/teacher/staff-attendance", icon: UserCheck, keywords: ["biometric", "check in", "hours"] },
        { title: "My Assigned Classes", subtitle: "Class rosters, sections, and students", href: "/school/teacher/classes", icon: BookOpen, keywords: ["courses", "students", "sections"] },
        { title: "Attendance Reports", subtitle: "Monthly class attendance statistics", href: "/school/teacher/reports", icon: BarChart2, keywords: ["analytics", "export", "stats"] },
        { title: "Communication", subtitle: "Chat with parents, administration, and colleagues", href: "/school/teacher/communication", icon: MessageSquare, keywords: ["chat", "messages"] },
        { title: "Discipline Incidents", subtitle: "Report and track student disciplinary cases", href: "/school/teacher/discipline", icon: ShieldAlert, keywords: ["conduct", "report case", "incident"] },
        { title: "Teacher Profile", subtitle: "View your faculty profile and credentials", href: "/school/teacher/profile", icon: User, keywords: ["account", "personal"] },
      ],
      quickActions: [
        { title: "Record Class Attendance", subtitle: "Mark student attendance today", href: "/school/teacher/attendance", icon: CheckSquare },
        { title: "Clock In (Staff Attendance)", subtitle: "Check in your attendance for today", href: "/school/teacher/staff-attendance", icon: UserCheck },
        { title: "Report Discipline Case", subtitle: "Log a student disciplinary issue", href: "/school/teacher/discipline", icon: ShieldAlert },
        { title: "Send Message to Parents", subtitle: "Communicate with class families", href: "/school/teacher/communication", icon: MessageSquare },
      ]
    },

    // ── REGISTRAR PORTAL ──
    registrar: {
      id: "registrar",
      name: "Registrar Portal",
      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
      searchPlaceholder: "Search registrar directory, admissions, reports...",
      navigation: [
        { title: "Registrar Dashboard", subtitle: "Enrollment metrics and status", href: "/school/registrar", icon: LayoutDashboard, keywords: ["home"] },
        { title: "Student Directory", subtitle: "Search and manage all enrolled students", href: "/school/registrar/students", icon: Users, keywords: ["roster", "students", "records"] },
        { title: "Register New Student", subtitle: "Student intake and admission form", href: "/school/registrar/register", icon: UserPlus, keywords: ["enroll", "new admission"] },
        { title: "Enrollment Reports", subtitle: "Export student lists and enrollment statistics", href: "/school/registrar/reports", icon: BarChart2, keywords: ["analytics", "export"] },
        { title: "My Staff Attendance", subtitle: "Check in and view attendance records", href: "/school/registrar/staff-attendance", icon: UserCheck, keywords: ["biometric", "clock in"] },
        { title: "Communication", subtitle: "Direct messaging with school staff", href: "/school/registrar/communication", icon: MessageSquare, keywords: ["chat"] },
        { title: "Registrar Profile", subtitle: "Personal account and settings", href: "/school/registrar/profile", icon: User, keywords: ["account"] },
      ],
      quickActions: [
        { title: "Register New Student", subtitle: "Open new student admission form", href: "/school/registrar/register", icon: UserPlus },
        { title: "Search Student Directory", subtitle: "Find student by ID, name, or grade", href: "/school/registrar/students", icon: Users },
        { title: "Generate Enrollment Reports", subtitle: "Download registration summary", href: "/school/registrar/reports", icon: BarChart2 },
        { title: "Record My Attendance", subtitle: "Clock in for today's shift", href: "/school/registrar/staff-attendance", icon: UserCheck },
      ]
    },

    // ── DISCIPLINE OFFICER PORTAL ──
    discipline_officer: {
      id: "discipline_officer",
      name: "Discipline Portal",
      badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
      searchPlaceholder: "Search cases, student incidents, actions...",
      navigation: [
        { title: "Discipline Analytics", subtitle: "Incident metrics, trends, and overview", href: "/school/discipline-officer", icon: BarChart3, keywords: ["dashboard", "home"] },
        { title: "Discipline Cases Directory", subtitle: "Search, filter, and review all incident records", href: "/school/discipline-officer/incidents", icon: ClipboardList, keywords: ["cases", "records"] },
        { title: "Incident Categories", subtitle: "Manage offenses and severity classification", href: "/school/discipline-officer/categories", icon: Tag, keywords: ["rules", "types"] },
        { title: "Disciplinary Actions", subtitle: "Configure corrective measures and penalties", href: "/school/discipline-officer/actions", icon: Sliders, keywords: ["consequences", "actions"] },
        { title: "Discipline Reports", subtitle: "Export official incident reports", href: "/school/discipline-officer/reports", icon: BarChart2, keywords: ["analytics", "export"] },
        { title: "Students Directory", subtitle: "Review student conduct histories", href: "/school/discipline-officer/students", icon: Users, keywords: ["profiles"] },
        { title: "My Staff Attendance", subtitle: "Check in and view attendance records", href: "/school/discipline-officer/staff-attendance", icon: UserCheck, keywords: ["clock in"] },
        { title: "Officer Profile", subtitle: "Personal account and preferences", href: "/school/discipline-officer/profile", icon: User, keywords: ["account"] },
      ],
      quickActions: [
        { title: "Report New Incident", subtitle: "Log a disciplinary infraction", href: "/school/discipline-officer/new-incident", icon: ShieldAlert },
        { title: "Review Open Cases", subtitle: "Filter cases needing immediate review", href: "/school/discipline-officer/incidents", icon: ClipboardList },
        { title: "Manage Offense Categories", subtitle: "Update rule definitions", href: "/school/discipline-officer/categories", icon: Tag },
        { title: "Record My Attendance", subtitle: "Clock in for today's duty", href: "/school/discipline-officer/staff-attendance", icon: UserCheck },
      ]
    },

    // ── SCHOOL ADMIN PORTAL (Full administrative suite) ──
    admin: {
      id: "admin",
      name: "Admin Console",
      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
      searchPlaceholder: "Search admin console, settings, staff, users...",
      navigation: [
        { title: "Admin Dashboard", subtitle: "Institution overview and analytics", href: "/school/admin", icon: LayoutDashboard, keywords: ["home", "main"] },
        { title: "Students Management", subtitle: "Student roster, enrollment, and profiles", href: "/school/admin/students", icon: Users, keywords: ["enrolled", "learners"] },
        { title: "Teachers Management", subtitle: "Faculty profiles, credentials, and schedules", href: "/school/admin/teachers", icon: GraduationCap, keywords: ["faculty", "instructors"] },
        { title: "Users & Roles", subtitle: "System access control and permissions", href: "/school/admin/users-and-roles", icon: ShieldCheck, keywords: ["security", "accounts", "passwords", "roles"] },
        { title: "Student Attendance", subtitle: "Daily student attendance tracking and logs", href: "/school/admin/attendance", icon: CheckSquare, keywords: ["roll call", "present", "absent"] },
        { title: "Attendance by Grade", subtitle: "Grade-level breakdown and comparisons", href: "/school/admin/attendance-by-grade", icon: BarChart2, keywords: ["analytics", "grades"] },
        { title: "Staff Attendance Management", subtitle: "Biometric and staff check-in records", href: "/school/admin/staff-attendance", icon: UserCheck, keywords: ["employees", "timesheet", "clock in"] },
        { title: "Discipline Management", subtitle: "Incident tracking and disciplinary actions", href: "/school/admin/discipline", icon: ShieldAlert, keywords: ["conduct", "behavior", "cases"] },
        { title: "Teacher Assignments", subtitle: "Assign classes, subjects, and sections", href: "/school/admin/teacher-assignments", icon: BookOpen, keywords: ["curriculum", "classes"] },
        { title: "Student Promotion", subtitle: "End-of-year academic class progression", href: "/school/admin/promotion", icon: TrendingUp, keywords: ["academic progression", "next year"] },
        { title: "Academic Years", subtitle: "Manage academic terms and calendars", href: "/school/admin/academic-years", icon: CalendarDays, keywords: ["terms", "calendar", "ethiopian"] },
        { title: "Announcements", subtitle: "Publish school-wide announcements and notices", href: "/school/admin/announcements", icon: Megaphone, keywords: ["news", "broadcast", "circular"] },
        { title: "Communication", subtitle: "School messaging hub and direct chat", href: "/school/admin/communication", icon: MessageSquare, keywords: ["chat", "inbox"] },
        { title: "Reports & Analytics", subtitle: "Exportable institutional intelligence reports", href: "/school/admin/reports", icon: BarChart2, keywords: ["export", "csv", "audit"] },
        { title: "School Settings", subtitle: "Institution profile, branding, and policies", href: "/school/admin/settings", icon: Settings, keywords: ["logo", "identity", "config"] },
        { title: "Admin Profile", subtitle: "Administrator account settings", href: "/school/admin/profile", icon: User, keywords: ["account", "password"] },
      ],
      quickActions: [
        { title: "Add New Student", subtitle: "Enroll a new learner into the school", href: "/school/admin/students", icon: Users },
        { title: "Add New Teacher", subtitle: "Create a faculty account and assign classes", href: "/school/admin/teachers", icon: GraduationCap },
        { title: "Post School Announcement", subtitle: "Broadcast notice to parents and staff", href: "/school/admin/announcements", icon: Megaphone },
        { title: "Manage User Permissions", subtitle: "Edit role privileges and account statuses", href: "/school/admin/users-and-roles", icon: ShieldCheck },
        { title: "Review Staff Biometric Attendance", subtitle: "Monitor employee clock-ins", href: "/school/admin/staff-attendance", icon: UserCheck },
        { title: "Edit School Configurations", subtitle: "Adjust school settings and branding", href: "/school/admin/settings", icon: Settings },
      ]
    },

    // ── RESTRICTED / UNKNOWN ──
    restricted: {
      id: "restricted",
      name: "Command Center",
      badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
      searchPlaceholder: "Search preferences...",
      navigation: [],
      quickActions: []
    }
  }

  const currentConfig = portalConfigs[activePortal] || portalConfigs.restricted

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl shadow-2xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl">
        <DialogTitle className="sr-only">{currentConfig.name} Command Palette</DialogTitle>
        
        <Command className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-400 dark:text-slate-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-3.5 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:rounded-2xl [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          
          {/* Top Search Input with Portal Badge */}
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800/80 px-4 py-1 gap-2">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <Command.Input
              placeholder={currentConfig.searchPlaceholder}
              className="flex h-14 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 text-foreground font-medium"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0", currentConfig.badgeClass)}>
                {currentConfig.name}
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-lg">
                ESC
              </kbd>
            </div>
          </div>

          <Command.List className="max-h-[380px] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-8 text-center text-sm text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">No matching commands found</p>
              <p className="text-xs text-slate-400 mt-0.5">Filtered strictly for {currentConfig.name}</p>
            </Command.Empty>
            
            {/* Quick Actions Specific to this Portal */}
            {currentConfig.quickActions.length > 0 && (
              <Command.Group heading="Quick Actions">
                {currentConfig.quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Command.Item
                      key={action.title}
                      value={`${action.title} ${action.subtitle || ''} action`}
                      onSelect={() => runCommand(() => router.push(action.href))}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-xs tracking-tight text-slate-900 dark:text-white truncate">{action.title}</p>
                          {action.subtitle && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{action.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Navigation Pages Specific to this Portal */}
            {currentConfig.navigation.length > 0 && (
              <Command.Group heading={`${currentConfig.name} Navigation`}>
                {currentConfig.navigation.map((item) => {
                  const Icon = item.icon
                  const searchWords = [item.title, item.subtitle || '', ...(item.keywords || [])].join(' ')
                  return (
                    <Command.Item
                      key={item.href}
                      value={searchWords}
                      onSelect={() => runCommand(() => router.push(item.href))}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-xs tracking-tight text-slate-900 dark:text-white truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-medium text-slate-400/80 dark:text-slate-600 shrink-0">
                        {item.href.replace('/school', '')}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* System Preferences (Safe for all users) */}
            <Command.Group heading="Preferences & Session">
              <Command.Item
                value="Toggle Light Dark Theme Mode color scheme"
                onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group aria-selected:bg-amber-500/10 aria-selected:text-amber-600"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white">Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Toggle interface color theme</p>
                </div>
              </Command.Item>

              <Command.Item
                value="Sign Out Logout terminate session exit"
                onSelect={() => runCommand(() => logout())}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 cursor-pointer transition-colors group aria-selected:bg-rose-500/10"
              >
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-xs text-rose-600 dark:text-rose-400">Sign Out</p>
                  <p className="text-[11px] text-rose-500/70">Safely log out of your {currentConfig.name} session</p>
                </div>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Security status footer */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/30">
            <span className="flex items-center gap-1.5 font-medium">
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Isolated Command Scope: <strong className="text-slate-700 dark:text-slate-300 font-bold">{currentConfig.name}</strong></span>
            </span>
            <span className="text-[10px] font-mono">Role: {user?.role || 'authorized'}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
