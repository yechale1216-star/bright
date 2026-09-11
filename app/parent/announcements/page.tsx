"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Megaphone, 
  Search, 
  Clock, 
  Bell, 
  AlertTriangle,
  Info,
  Calendar,
  ChevronRight,
  Filter,
  Users,
  Globe,
  RefreshCw,
  CheckCheck,
  CheckCircle2,
  X,
  GraduationCap,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog"
import { parentDatabase, ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { formatLocalizedDate, formatLocalizedTime } from "@/lib/utils/date-utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { cn } from "@/lib/utils/utils"
import { toast } from "sonner"

export default function AnnouncementsPage() {
  const { t, language } = useLanguage()
  const [announcements, setAnnouncements] = useState<ParentNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<"ALL" | "EMERGENCY" | "PARENTS" | "GENERAL" | "UNREAD">("ALL")
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<ParentNotification | null>(null)
  const [activeStudent, setActiveStudent] = useState<any>(null)

  // Load active child from localStorage
  const loadActiveStudent = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const studentId = localStorage.getItem("parent_selected_student_id")
      const studentsStr = localStorage.getItem("parent_students")
      if (studentsStr) {
        const studentList = JSON.parse(studentsStr)
        if (Array.isArray(studentList)) {
          const found = studentId ? studentList.find((s: any) => s.id === studentId) : studentList[0]
          setActiveStudent(found || null)
        }
      }
    } catch {
      setActiveStudent(null)
    }
  }, [])

  // Fetch announcements
  const fetchAnnouncements = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const userStr = localStorage.getItem("attendance_current_user") || 
                      localStorage.getItem("auth_user") || 
                      sessionStorage.getItem("auth_user")
      if (userStr) {
        const user = JSON.parse(userStr)
        const phone = user.phone || user.phoneNumber || ""
        const list = await parentDatabase.getNotifications(phone)
        // Filter to broadcast announcements and emergencies
        const filtered = list.filter(n => 
          n.type === "announcement" || 
          n.type === "emergency" || 
          n.type === "info" || 
          n.category === "ANNOUNCEMENT"
        )
        setAnnouncements(filtered)
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
      toast.error(language === "am" ? "ማስታወቂያዎችን መጫን አልተቻለም" : "Failed to load announcements")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [language])

  useEffect(() => {
    loadActiveStudent()
    fetchAnnouncements()

    const handleStudentChanged = () => {
      loadActiveStudent()
      fetchAnnouncements(true)
    }

    window.addEventListener("studentChanged", handleStudentChanged)
    window.addEventListener("userSessionChanged", handleStudentChanged)

    return () => {
      window.removeEventListener("studentChanged", handleStudentChanged)
      window.removeEventListener("userSessionChanged", handleStudentChanged)
    }
  }, [loadActiveStudent, fetchAnnouncements])

  // Mark single notification as read
  const handleMarkAsRead = async (item: ParentNotification) => {
    if (item.isRead) return
    // Optimistic UI update
    setAnnouncements(prev => prev.map(a => a.id === item.id ? { ...a, isRead: true } : a))
    try {
      await parentDatabase.markNotificationAsRead(item.id)
      toast.success(language === "am" ? "እንደተነበበ ተመዝግቧል" : "Marked as read")
    } catch (err) {
      console.error("Error marking as read:", err)
    }
  }

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    const unreadCount = announcements.filter(a => !a.isRead).length
    if (unreadCount === 0) return

    const userStr = localStorage.getItem("attendance_current_user") || 
                    localStorage.getItem("auth_user") || 
                    sessionStorage.getItem("auth_user")
    if (!userStr) return

    const user = JSON.parse(userStr)
    const phone = user.phone || user.phoneNumber || ""

    setAnnouncements(prev => prev.map(a => ({ ...a, isRead: true })))
    try {
      await parentDatabase.markAllNotificationsAsRead(phone)
      toast.success(language === "am" ? "ሁሉም ማስታወቂያዎች እንደተነበቡ ተደርገዋል" : "All notices marked as read")
    } catch (err) {
      console.error("Error marking all read:", err)
      fetchAnnouncements(true)
    }
  }

  // Filtered list
  const filteredList = useMemo(() => {
    return announcements.filter(a => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchTitle = a.title.toLowerCase().includes(query)
        const matchMsg = a.message.toLowerCase().includes(query)
        const matchChild = a.student?.fullName.toLowerCase().includes(query)
        if (!matchTitle && !matchMsg && !matchChild) return false
      }

      // Tab filter
      if (activeFilter === "EMERGENCY") {
        return a.type === "emergency" || a.priority === "URGENT" || a.priority === "HIGH"
      }
      if (activeFilter === "PARENTS") {
        return (a.targetAudience || "").toUpperCase() === "PARENTS"
      }
      if (activeFilter === "GENERAL") {
        return !a.targetAudience || (a.targetAudience || "").toUpperCase() === "GENERAL"
      }
      if (activeFilter === "UNREAD") {
        return !a.isRead
      }

      return true
    })
  }, [announcements, searchTerm, activeFilter])

  // Counts for KPI & Pills
  const counts = useMemo(() => {
    const total = announcements.length
    const emergency = announcements.filter(a => a.type === "emergency" || a.priority === "URGENT" || a.priority === "HIGH").length
    const parents = announcements.filter(a => (a.targetAudience || "").toUpperCase() === "PARENTS").length
    const unread = announcements.filter(a => !a.isRead).length
    const general = announcements.filter(a => !a.targetAudience || (a.targetAudience || "").toUpperCase() === "GENERAL").length
    return { total, emergency, parents, unread, general }
  }, [announcements])

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "emergency":
        return {
          icon: AlertTriangle,
          badgeCls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          barCls: "bg-rose-500",
          dotCls: "bg-rose-500 animate-pulse",
          glowCls: "from-rose-500/10 to-transparent",
          iconContainer: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
        }
      case "info":
        return {
          icon: Info,
          badgeCls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
          barCls: "bg-blue-500",
          dotCls: "bg-blue-500",
          glowCls: "from-blue-500/10 to-transparent",
          iconContainer: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
        }
      default:
        return {
          icon: Megaphone,
          badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          barCls: "bg-emerald-500",
          dotCls: "bg-emerald-500",
          glowCls: "from-emerald-500/10 to-transparent",
          iconContainer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        }
    }
  }

  const getAudienceBadge = (audience?: string) => {
    const aud = (audience || "GENERAL").toUpperCase()
    if (aud === "PARENTS") {
      return {
        label: language === "am" ? "ለወላጆች ብቻ" : "Parents Only",
        icon: Users,
        cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
      }
    }
    return {
      label: language === "am" ? "ጠቅላላ ት/ቤት" : "School-wide",
      icon: Globe,
      cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
    }
  }

  return (
    <div className="relative space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto pb-32 sm:pb-28 md:pb-12 min-w-0 overflow-hidden animate-in fade-in duration-300">

      {/* ── Ambient Background Blur (Containment prevents mobile scrollbar jitter) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 max-w-full">
        <div className="absolute top-10 left-0 w-72 sm:w-80 h-72 sm:h-80 bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-72 sm:w-80 h-72 sm:h-80 bg-indigo-500/10 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 left-1/3 w-72 sm:w-80 h-72 sm:h-80 bg-teal-500/10 rounded-full blur-[100px]" />
      </div>

      {/* ── 1. Frosted Glass Mobile-First Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-white/40 dark:border-white/10 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl p-4 sm:p-6 md:p-7 shadow-xl shadow-emerald-500/5 flex flex-col gap-3.5 sm:gap-4 w-full min-w-0"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

        <div className="flex items-center gap-3 sm:gap-4 z-10 min-w-0 flex-1 w-full">
          <div className="p-2.5 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 shrink-0">
            <Megaphone className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {language === "am" ? "የትምህርት ቤት ማስታወቂያዎች" : "School Announcements"}
              </h1>
              {activeStudent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 max-w-[160px]">
                  <GraduationCap className="w-3 h-3 shrink-0" />
                  <span className="truncate">{activeStudent.fullName}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-2 break-words">
              {language === "am" 
                ? "ኦፊሴላዊ የትምህርት ቤት ዜናዎች፣ አስቸኳይ መልዕክቶች እና መግለጫዎች" 
                : "Official broadcasts, newsletters, notices, and emergency alerts from school leadership"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full justify-between sm:justify-end z-10 shrink-0 border-t pt-2.5 border-border/40 sm:border-t-0 sm:pt-0">
          {counts.unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-9 px-3.5 rounded-xl border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold gap-1.5 shadow-2xs active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{language === "am" ? "ሁሉንም አንብብ" : "Mark All Read"}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnnouncements(true)}
            disabled={isRefreshing}
            className="h-9 px-3.5 rounded-xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 text-xs font-semibold gap-1.5 shadow-2xs ml-auto active:scale-95"
            title={language === "am" ? "ማደስ" : "Refresh Announcements"}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", isRefreshing && "animate-spin text-emerald-600")} />
            <span className="hidden xs:inline">{language === "am" ? "አድስ" : "Refresh"}</span>
          </Button>
        </div>
      </motion.div>

      {/* ── 2. Glanceable 4-Col KPI Metrics on Phones & Tablets ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full min-w-0">
        {[
          {
            id: "ALL" as const,
            label: language === "am" ? "ጠቅላላ ማስታወቂያ" : "Total Broadcasts",
            count: counts.total,
            icon: Megaphone,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            active: activeFilter === "ALL"
          },
          {
            id: "EMERGENCY" as const,
            label: language === "am" ? "አስቸኳይ / ማንቂያ" : "Alerts & Urgent",
            count: counts.emergency,
            icon: AlertTriangle,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10 border-rose-500/20",
            pulse: counts.emergency > 0,
            active: activeFilter === "EMERGENCY"
          },
          {
            id: "PARENTS" as const,
            label: language === "am" ? "ለወላጆች ብቻ" : "Parents Only",
            count: counts.parents,
            icon: Users,
            color: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-500/10 border-indigo-500/20",
            active: activeFilter === "PARENTS"
          },
          {
            id: "UNREAD" as const,
            label: language === "am" ? "ያልተነበቡ" : "Unread Notices",
            count: counts.unread,
            icon: Bell,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
            active: activeFilter === "UNREAD"
          },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <button
              key={kpi.id}
              onClick={() => setActiveFilter(kpi.id)}
              className={cn(
                "p-3 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer active:scale-[0.97] w-full min-w-0",
                kpi.active
                  ? "bg-white dark:bg-slate-800 border-primary shadow-md shadow-primary/5 ring-2 ring-primary/20"
                  : "bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
              )}
            >
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span className={cn("p-1.5 sm:p-2 rounded-xl border shrink-0", kpi.bg, kpi.color)}>
                  <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", kpi.pulse && "animate-bounce")} />
                </span>
                <span className={cn("text-base sm:text-2xl font-black tracking-tight shrink-0", kpi.color)}>
                  {isLoading ? "—" : kpi.count}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 truncate block max-w-full">
                {kpi.label}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── 3. Search & Horizontally Scrollable Pills ── */}
      <div className="space-y-2.5 w-full min-w-0 max-w-full overflow-hidden">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder={language === "am" ? "ማስታወቂያዎችን ይፈልጉ..." : "Search broadcasts, keywords, or student name..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 rounded-2xl h-11 text-sm shadow-xs focus-visible:ring-primary/20 w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 overscroll-contain touch-pan-x w-full max-w-full min-w-0">
          {[
            { id: "ALL" as const, label: language === "am" ? "ሁሉም" : "All Broadcasts", count: counts.total, icon: Filter },
            { id: "EMERGENCY" as const, label: language === "am" ? "አስቸኳይ" : "Urgent / Alerts", count: counts.emergency, icon: AlertTriangle },
            { id: "PARENTS" as const, label: language === "am" ? "ለወላጆች" : "Parents Only", count: counts.parents, icon: Users },
            { id: "GENERAL" as const, label: language === "am" ? "ጠቅላላ" : "General", count: counts.general, icon: Globe },
            { id: "UNREAD" as const, label: language === "am" ? "ያልተነበቡ" : "Unread", count: counts.unread, icon: Bell },
          ].map(pill => {
            const isActive = activeFilter === pill.id
            const PillIcon = pill.icon
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                )}
              >
                <PillIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{pill.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-black shrink-0",
                  isActive 
                    ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900" 
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                )}>
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 4. Announcements List (Mobile-First Cards) ── */}
      <div className="space-y-3 w-full min-w-0">
        {isLoading ? (
          <PageSkeleton variant="cards" />
        ) : filteredList.length === 0 ? (
          <Card className="border-border/40 shadow-none bg-muted/5 rounded-3xl border-dashed py-16 text-center w-full min-w-0">
            <CardContent className="flex flex-col items-center gap-3 px-4">
              <div className="p-4 bg-muted/20 rounded-full">
                <Bell className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-bold text-base text-foreground">
                {language === "am" ? "ምንም ማስታወቂያ አልተገኘም" : "No announcements found"}
              </h3>
              <p className="text-muted-foreground text-xs max-w-sm">
                {searchTerm
                  ? (language === "am" ? "የፈለጉትን ቃል የያዘ ማስታወቂያ የለም። ፍለጋዎን ይቀይሩ።" : "No results match your search keywords. Try clearing the search.")
                  : (language === "am" ? "አዳዲስ የትምህርት ቤት ማስታወቂያዎች ሲወጡ እዚህ ይታያሉ።" : "Check back later for school updates, event notices, and leadership announcements.")}
              </p>
              {(searchTerm || activeFilter !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearchTerm(""); setActiveFilter("ALL"); }}
                  className="rounded-xl mt-2 text-xs font-bold active:scale-95"
                >
                  {language === "am" ? "ሁሉንም አሳይ" : "Clear Filters"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredList.map((item) => {
              const typeCfg = getTypeStyles(item.type)
              const TypeIcon = typeCfg.icon
              const audBadge = getAudienceBadge(item.targetAudience)
              const AudIcon = audBadge.icon

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="w-full min-w-0"
                >
                  <div
                    onClick={() => setSelectedAnnouncement(item)}
                    className={cn(
                      "group relative rounded-2xl sm:rounded-3xl border bg-white/90 dark:bg-slate-900/90 backdrop-blur-md overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 flex flex-col w-full min-w-0 cursor-pointer active:scale-[0.99]",
                      !item.isRead ? "border-emerald-500/40 dark:border-emerald-500/30 ring-1 ring-emerald-500/15" : "border-slate-200/80 dark:border-slate-800"
                    )}
                  >
                    {/* Left vertical accent indicator bar */}
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 sm:w-2", typeCfg.barCls)} />

                    <div className="pl-4 sm:pl-5 pr-3.5 sm:pr-5 py-3.5 sm:py-4 space-y-2.5 w-full min-w-0">
                      {/* Top Meta Bar */}
                      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Type Badge */}
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                            typeCfg.badgeCls
                          )}>
                            <TypeIcon className="w-3 h-3 shrink-0" />
                            {item.type}
                          </span>

                          {/* Audience Badge */}
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                            audBadge.cls
                          )}>
                            <AudIcon className="w-3 h-3 shrink-0" />
                            {audBadge.label}
                          </span>

                          {/* Specific Student Badge (if targeted) */}
                          {item.student && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                              <GraduationCap className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{item.student.fullName}</span>
                            </span>
                          )}
                        </div>

                        {/* Date & Time */}
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold shrink-0 ml-auto">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatLocalizedDate(item.createdAt, language, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="hidden xs:inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatLocalizedTime(item.createdAt, language)}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" title="Unread" />
                          )}
                        </div>
                      </div>

                      {/* Announcement Title */}
                      <div className="group-hover:text-primary transition-colors">
                        <h3 className="font-black text-sm sm:text-base text-foreground leading-snug break-words">
                          {item.title}
                        </h3>
                      </div>

                      {/* Announcement Excerpt */}
                      <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-foreground/90 text-xs sm:text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
                          {item.message}
                        </p>
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="flex items-center justify-between pt-2 gap-2 border-t border-border/40">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAnnouncement(item);
                          }}
                          className="inline-flex items-center gap-1.5 py-1 text-xs font-bold text-primary hover:underline active:opacity-75"
                        >
                          <span>{language === "am" ? "ሙሉውን አንብብ" : "Read Full Notice"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-1.5">
                          {!item.isRead ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(item);
                              }}
                              className="h-8 px-3 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold gap-1.5 active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === "am" ? "እንደተነበበ ምልክት አድርግ" : "Mark as Read"}</span>
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/80 px-2 py-1">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{language === "am" ? "ተነቧል" : "Read"}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── 5. Mobile-First Announcement Detail Dialog (Bottom-Sheet Feel) ── */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] sm:max-w-lg max-h-[88dvh] rounded-t-[28px] rounded-b-[20px] sm:rounded-[28px] p-0 flex flex-col overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl"
        >
          {selectedAnnouncement && (() => {
            const typeCfg = getTypeStyles(selectedAnnouncement.type)
            const TypeIcon = typeCfg.icon
            const audBadge = getAudienceBadge(selectedAnnouncement.targetAudience)
            const AudIcon = audBadge.icon

            return (
              <>
                {/* Mobile Drag Indicator */}
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

                {/* Modal Header */}
                <div className={cn("p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/50 bg-gradient-to-r relative shrink-0", typeCfg.glowCls)}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider border", typeCfg.badgeCls)}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {selectedAnnouncement.type}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border", audBadge.cls)}>
                        <AudIcon className="w-3.5 h-3.5" />
                        {audBadge.label}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedAnnouncement(null)}
                      className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <DialogTitle className="text-base sm:text-lg font-black text-foreground leading-snug break-words">
                    {selectedAnnouncement.title}
                  </DialogTitle>

                  <div className="flex items-center gap-3 mt-2 text-[11px] sm:text-xs text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatLocalizedDate(selectedAnnouncement.createdAt, language, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatLocalizedTime(selectedAnnouncement.createdAt, language)}
                    </span>
                  </div>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain space-y-3.5">
                  {selectedAnnouncement.student && (
                    <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center gap-2 text-xs sm:text-sm">
                      <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <span className="font-bold text-purple-900 dark:text-purple-300">
                          {language === "am" ? "ለተማሪ የተላከ: " : "Notice concerning: "}
                        </span>
                        <span className="font-semibold text-purple-700 dark:text-purple-400">
                          {selectedAnnouncement.student.fullName}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {selectedAnnouncement.message}
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <DialogFooter className="p-3.5 sm:p-4 bg-muted/20 border-t border-border/50 flex flex-row items-center justify-between gap-2.5 pb-safe shrink-0">
                  {!selectedAnnouncement.isRead ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        handleMarkAsRead(selectedAnnouncement)
                        setSelectedAnnouncement(null)
                      }}
                      className="rounded-xl h-10 px-4 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1 sm:flex-initial justify-center active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">{language === "am" ? "እንደተነበበ ምልክት አድርግ" : "Mark as Read"}</span>
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCheck className="w-4 h-4" />
                      <span>{language === "am" ? "ይህ ማስታወቂያ ተነቧል" : "Already read"}</span>
                    </span>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAnnouncement(null)}
                    className="rounded-xl h-10 px-4 text-xs sm:text-sm font-bold shrink-0 ml-auto active:scale-95"
                  >
                    {language === "am" ? "ዝጋ" : "Close"}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
