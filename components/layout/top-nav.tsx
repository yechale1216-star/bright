"use client"

import React from "react"
import { ModeToggle } from "@/components/mode-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Menu, GraduationCap, Sun, Moon, Search, CalendarDays } from "lucide-react"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils/utils"
import { useAuth } from "@/lib/context/auth-context"
import { useSchool } from "@/lib/context/school-context"
import { useTheme } from "@/components/theme-provider"
import { CommandPalette } from "@/components/ui/command-palette"
import { useCalendar } from "@/lib/context/calendar-context"
import { AcademicYearBadge } from "@/components/school/academic-year-badge"

interface TopNavProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function TopNav({ onMenuClick, showMenuButton = false }: TopNavProps) {
  const router = useRouter()
  const pathname = usePathname() || ""
  const { settings } = useSchoolSettings()
  const { activeSchool } = useSchool()
  const { user, logout } = useAuth()
  const [logoError, setLogoError] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)
  const [cachedLogo, setCachedLogo] = React.useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const { calendarPreference, setCalendarPreference } = useCalendar()

  // Portal-specific search prompt and profile destination
  const portalInfo = React.useMemo(() => {
    const role = (user?.role || "").toLowerCase()
    if (role === "parent" || pathname.startsWith("/parent")) {
      return { searchLabel: "Search parent portal...", profileTarget: "/parent/profile" }
    }
    if (role === "staff" || role === "staff_member" || pathname.startsWith("/school/staff")) {
      return { searchLabel: "Search staff portal...", profileTarget: "/school/staff/profile" }
    }
    if (role === "teacher" || pathname.startsWith("/school/teacher")) {
      return { searchLabel: "Search teacher portal...", profileTarget: "/school/teacher/profile" }
    }
    if (role === "registrar" || pathname.startsWith("/school/registrar")) {
      return { searchLabel: "Search registrar portal...", profileTarget: "/school/registrar/profile" }
    }
    if (role === "discipline_officer" || pathname.startsWith("/school/discipline-officer")) {
      return { searchLabel: "Search discipline portal...", profileTarget: "/school/discipline-officer/profile" }
    }
    if (role === "admin" || role === "school_admin" || role === "super_admin" || pathname.startsWith("/school/admin")) {
      return { searchLabel: "Search admin console...", profileTarget: "/school/admin/profile" }
    }
    return { searchLabel: "Search commands...", profileTarget: "/login" }
  }, [user?.role, pathname])

  React.useEffect(() => {
    setMounted(true)
    // Fetch cached logo from IndexedDB for instant display
    import("@/lib/utils/indexeddb-store").then(({ getCachedSchoolLogo }) => {
      getCachedSchoolLogo(activeSchool?.id || user?.schoolId).then(logo => {
        if (logo) setCachedLogo(logo)
      })
    }).catch(() => {})
  }, [activeSchool?.id, user?.schoolId])

  const rawSchoolName = settings?.schoolName || settings?.school_name || activeSchool?.name || user?.schoolName || "Bright Path"
  const schoolName = !rawSchoolName || rawSchoolName.trim().toLowerCase() === "addis hiwot" || rawSchoolName.trim().toLowerCase() === "bright path" ? "Bright Path" : rawSchoolName
  const schoolLogo = activeSchool ? (activeSchool.logo || "") : (user?.schoolLogo || "")
  const logoUrl = schoolLogo || cachedLogo || "/bright-path-logo.png"

  const handleLogout = async () => {
    await logout()
  }

  const initials = user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs pt-safe">
        <div className="w-full flex h-16 items-center px-3 sm:px-4 md:px-8 gap-2 sm:gap-4 max-w-full box-border">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-0.5 sm:mr-1 md:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-primary/10 transition-all active:scale-90 shrink-0"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-4 flex-1 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20 shadow-inner">
              {logoUrl && !logoError ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="bg-primary/5 w-full h-full flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm md:text-lg font-black tracking-tight text-foreground truncate uppercase min-w-0">
                {schoolName}
              </h1>
            </div>
          </div>

          {/* Desktop Command Palette Search Trigger */}
          <div className="hidden md:flex items-center flex-1 max-w-sm">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl transition-all shadow-2xs group"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
              <span className="truncate">{portalInfo.searchLabel}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            {/* Calendar Mode Toggle */}
            <button
              onClick={() => setCalendarPreference(calendarPreference === 'ethiopian' ? 'gregorian' : 'ethiopian')}
              title={`Switch to ${calendarPreference === 'ethiopian' ? 'Gregorian' : 'Ethiopian'} Calendar`}
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-border/60 bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all shadow-2xs"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{calendarPreference === 'ethiopian' ? 'EC' : 'GC'}</span>
            </button>

            {/* Academic Year Badge */}
            <AcademicYearBadge className="hidden sm:inline-flex" />

            <div className="hidden sm:block">
              <ModeToggle />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-10 rounded-full p-0 border border-border/50 hover:border-primary/30 transition-all shadow-2xs">
                  <Avatar className="h-8 w-8 md:h-9 md:w-9">
                    <AvatarImage src={user?.profile_photo || undefined} />
                    <AvatarFallback className="text-[10px] md:text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-2xl p-2" align="end" forceMount>
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="opacity-50" />
                <DropdownMenuItem className="rounded-xl h-10 gap-2 font-semibold" onClick={() => {
                  router.push(portalInfo.profileTarget)
                }}>
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {mounted && (
                  <>
                    <DropdownMenuSeparator className="opacity-50 sm:hidden" />
                    <DropdownMenuItem 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                      className="rounded-xl h-10 gap-2 font-semibold sm:hidden"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="opacity-50" />
                <DropdownMenuItem onClick={handleLogout} className="rounded-xl h-10 gap-2 font-semibold text-rose-500 focus:bg-rose-50 focus:text-rose-600">
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  )
}

