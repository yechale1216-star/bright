"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { parentDb, type ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { formatLocalizedDate, formatEthiopianDateDMY, formatEthiopianDateTimeDMY } from "@/lib/utils/date-utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  Bell, CheckCheck, Trash2, BellOff,
  Clock, XCircle, Megaphone,
  AlertTriangle, Info, UserX, X, ChevronRight,
  Filter, RefreshCw, GraduationCap, ShieldAlert,
  LogOut, Loader2, Sparkles, CheckCircle2,
} from "lucide-react"

function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false
  const token = localStorage.getItem("attendance_token")
  const user = localStorage.getItem("attendance_current_user")
  return !!(token && user)
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return formatEthiopianDateDMY(date)
}


function groupNotificationsByDay(notifications: ParentNotification[]): { label: string; items: ParentNotification[] }[] {
  const groups: { [key: string]: ParentNotification[] } = {}
  for (const n of notifications) {
    const label = getDayLabel(n.createdAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

const TYPE_CONFIG: Record<string, {
  icon: React.ReactNode
  bg: string
  border: string
  badge: string
  badgeText: string
  accentBar: string
  glow: string
  dot: string
}> = {
  absent: {
    icon: <XCircle className="w-5 h-5 text-rose-400" />,
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
    badge: "bg-rose-500/15 text-rose-300 border border-rose-500/25",
    badgeText: "ABSENT",
    accentBar: "from-rose-500 to-rose-600",
    glow: "shadow-rose-500/10",
    dot: "bg-rose-400",
  },
  late: {
    icon: <Clock className="w-5 h-5 text-amber-400" />,
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    badge: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    badgeText: "LATE",
    accentBar: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/10",
    dot: "bg-amber-400",
  },
  announcement: {
    icon: <Megaphone className="w-5 h-5 text-blue-400" />,
    bg: "bg-blue-500/8",
    border: "border-blue-500/20",
    badge: "bg-blue-500/15 text-blue-300 border border-blue-500/25",
    badgeText: "SCHOOL",
    accentBar: "from-blue-500 to-indigo-500",
    glow: "shadow-blue-500/10",
    dot: "bg-blue-400",
  },
  emergency: {
    icon: <ShieldAlert className="w-5 h-5 text-red-400" />,
    bg: "bg-red-600/10",
    border: "border-red-500/25",
    badge: "bg-red-600/20 text-red-200 border border-red-500/30",
    badgeText: "URGENT",
    accentBar: "from-red-500 to-rose-600",
    glow: "shadow-red-500/15",
    dot: "bg-red-400",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
    bg: "bg-orange-500/8",
    border: "border-orange-500/20",
    badge: "bg-orange-500/15 text-orange-300 border border-orange-500/25",
    badgeText: "WARNING",
    accentBar: "from-orange-500 to-amber-500",
    glow: "shadow-orange-500/10",
    dot: "bg-orange-400",
  },
  info: {
    icon: <Info className="w-5 h-5 text-sky-400" />,
    bg: "bg-sky-500/8",
    border: "border-sky-500/20",
    badge: "bg-sky-500/15 text-sky-300 border border-sky-500/25",
    badgeText: "INFO",
    accentBar: "from-sky-500 to-blue-500",
    glow: "shadow-sky-500/10",
    dot: "bg-sky-400",
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type?.toLowerCase()] ?? {
    icon: <Bell className="w-5 h-5 text-slate-400" />,
    bg: "bg-slate-800/30",
    border: "border-slate-700/30",
    badge: "bg-slate-700/40 text-slate-400 border border-slate-700/30",
    badgeText: (type || "INFO").toUpperCase(),
    accentBar: "from-slate-600 to-slate-700",
    glow: "shadow-slate-500/5",
    dot: "bg-slate-500",
  }
}

function TodayStatusPanel({ notifications }: { notifications: ParentNotification[] }) {
  const todayNotes = notifications.filter(n => getDayLabel(n.createdAt) === "Today")
  const absentToday = todayNotes.filter(n => n.type === "absent").length
  const lateToday = todayNotes.filter(n => n.type === "late").length
  const warningToday = todayNotes.filter(n => n.type === "warning").length
  const allGood = absentToday === 0 && lateToday === 0 && warningToday === 0

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-white/5 p-4 mb-4">
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-30 ${allGood ? "bg-emerald-500" : "bg-rose-500"}`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-xl flex items-center justify-center ${allGood ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
              {allGood
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <GraduationCap className="w-4 h-4 text-rose-400" />
              }
            </div>
            <span className="text-xs font-bold text-slate-300 tracking-wide">Today's Snapshot</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            {formatEthiopianDateDMY(new Date())}
          </span>
        </div>
        {allGood ? (
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-400">All Clear Today ??</p>
              <p className="text-xs text-slate-500 mt-0.5">No attendance issues reported</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { count: absentToday, label: "Absent", color: "text-rose-400", activeBg: "bg-rose-500/12 border-rose-500/25" },
              { count: lateToday, label: "Late", color: "text-amber-400", activeBg: "bg-amber-500/12 border-amber-500/25" },
              { count: warningToday, label: "Warning", color: "text-orange-400", activeBg: "bg-orange-500/12 border-orange-500/25" },
            ].map(({ count, label, color, activeBg }) => (
              <div key={label} className={`rounded-xl p-2.5 text-center border transition-all ${count > 0 ? activeBg : "bg-white/3 border-white/5"}`}>
                <div className={`text-xl font-black ${count > 0 ? color : "text-slate-600"}`}>{count}</div>
                <div className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${count > 0 ? color : "text-slate-600"}`}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SignedOutWall() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center gap-6 max-w-xs">
        <div className="relative">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/8 flex items-center justify-center shadow-2xl">
            <UserX className="h-10 w-10 text-slate-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">You're signed out</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Sign in to your Zetime account to see attendance alerts and school announcements.
          </p>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all rounded-2xl font-bold text-white text-sm shadow-lg shadow-emerald-900/40"
        >
          <LogOut className="h-4 w-4 rotate-180" />
          Sign In to View Notifications
        </button>
      </div>
    </div>
  )
}

function NotificationCard({
  notification, cfg, title, message, time, onRead, onDelete,
}: {
  notification: ParentNotification
  cfg: ReturnType<typeof getTypeConfig>
  title: string
  message: string
  time: string
  onRead: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const isUnread = !notification.isRead
  return (
    <div
      onClick={isUnread ? onRead : undefined}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer ${
        isUnread
          ? `${cfg.bg} ${cfg.border} shadow-lg ${cfg.glow} hover:border-white/15 active:scale-[0.99]`
          : "bg-white/3 border-white/5 hover:bg-white/5 active:scale-[0.99]"
      }`}
    >
      {isUnread && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${cfg.accentBar} rounded-l-2xl`} />
      )}
      <div className={`flex items-start gap-3 p-4 ${isUnread ? "pl-5" : "pl-4"}`}>
        <div className={`relative shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center border ${cfg.bg} ${cfg.border}`}>
          {cfg.icon}
          {isUnread && (
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-[#070d1a]`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg tracking-widest uppercase ${cfg.badge}`}>
                {cfg.badgeText}
              </span>
              {notification.student?.fullName && (
                <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                  <GraduationCap className="w-2.5 h-2.5" />
                  {notification.student.fullName.split(" ")[0]}
                </span>
              )}
            </div>
            <button
              onClick={onDelete}
              className="h-7 w-7 rounded-xl bg-white/4 flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-90 shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className={`text-sm font-bold leading-snug ${isUnread ? "text-white" : "text-slate-400"}`}>{title}</p>
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">{message}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-600 font-medium flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{time}
            </span>
            {!isUnread && (
              <span className="text-[9px] font-bold text-slate-600 flex items-center gap-1 uppercase tracking-wider">
                <CheckCheck className="w-3 h-3 text-emerald-600" />Read
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ParentNotifications() {
  const { t, language } = useLanguage()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [notificationsList, setNotificationsList] = useState<ParentNotification[]>([])
  const [filterType, setFilterType] = useState<"all" | "absent" | "late" | "announcement" | "emergency" | "warning">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<ParentNotification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const loggedIn = isLoggedIn()
    if (!loggedIn) { setSignedOut(true); setAuthChecked(true); setIsLoading(false); return }
    setAuthChecked(true)
    loadData()
  }, [])

  const fetchNotificationsList = useCallback(async (phone: string) => {
    const list = await parentDb.getNotifications(phone)
    setNotificationsList(list)
  }, [])

  const loadData = async () => {
    const userStr = localStorage.getItem("attendance_current_user") || localStorage.getItem("auth_user") || sessionStorage.getItem("auth_user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
        const phone = user.phone || user.phoneNumber
        if (phone) {
          await fetchNotificationsList(phone)
        }
      } catch (e) { console.error("[Notifications] Load error:", e) }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!authChecked || signedOut) return
    const handler = () => { setIsLoading(true); loadData() }
    window.addEventListener("studentChanged", handler)
    return () => window.removeEventListener("studentChanged", handler)
  }, [authChecked, signedOut])

  const handleMarkAsRead = async (notificationId: string) => {
    if (!currentUser?.phone) return
    const success = await parentDb.markNotificationAsRead(notificationId)
    if (success) {
      setNotificationsList(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n))
      window.dispatchEvent(new Event("refreshNotifications"))
    }
  }

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    setNotificationsList(prev => prev.filter(n => n.id !== notificationId))
    if (selectedNotif?.id === notificationId) setSelectedNotif(null)
    window.dispatchEvent(new Event("refreshNotifications"))
    try {
      await parentDb.deleteNotification(notificationId)
    } catch (err) {
      console.error("[Notifications] Delete error:", err)
      if (currentUser?.phone) await fetchNotificationsList(currentUser.phone)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!currentUser?.phone) return
    const success = await parentDb.markAllNotificationsAsRead(currentUser.phone)
    if (success) {
      setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })))
      window.dispatchEvent(new Event("refreshNotifications"))
    }
  }

  const handleRefresh = async () => {
    if (!currentUser?.phone) return
    setIsRefreshing(true)
    await fetchNotificationsList(currentUser.phone)
    setIsRefreshing(false)
  }

  const formatNotificationTime = (dateStr: string) =>
    formatEthiopianDateTimeDMY(dateStr)

  const localizeNotification = (notification: ParentNotification): { title: string; message: string } => {
    const studentName = notification.student?.fullName?.split(" ")[0] || ""
    const isFemale = notification.student?.gender?.toLowerCase() === "female"
    const suffix = isFemale ? "_f" : ""
    const formattedDate = formatEthiopianDateDMY(notification.createdAt)
    const vars = {
      name: studentName,
      StudentName: studentName,
      "Parent Name": "ወላጅ",
      parentName: "ወላጅ",
      date: formattedDate,
      Date: formattedDate,
    }
    switch (notification.type as string) {
      case "absent": return { title: t(("alert_absent_title" + suffix) as any, vars), message: t(("alert_absent_msg" + suffix) as any, vars) }
      case "late": return { title: t(("alert_late_title" + suffix) as any, vars), message: t(("alert_late_msg" + suffix) as any, vars) }
      case "excused": return { title: t(("alert_excused_title" + suffix) as any, vars), message: t(("alert_excused_msg" + suffix) as any, vars) }
      case "warning": return { title: t(("alert_warning_title" + suffix) as any, vars), message: t(("alert_warning_msg" + suffix) as any, vars) }
      default: return { title: notification.title, message: notification.message }
    }
  }

  if (!authChecked || (authChecked && signedOut)) return <SignedOutWall />
  if (isLoading) return <PageSkeleton variant="cards" />

  const unreadCount = notificationsList.filter(n => !n.isRead).length
  const totalCount = notificationsList.length

  const filtered = notificationsList.filter(n => {
    const matchesType = filterType === "all" || n.type === filterType
    const matchesUnread = !showUnreadOnly || !n.isRead
    const { title, message } = localizeNotification(n)
    const matchesSearch = !searchTerm || title.toLowerCase().includes(searchTerm.toLowerCase()) || message.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesType && matchesUnread && matchesSearch
  })
  const grouped = groupNotificationsByDay(filtered)

  const filterOptions: { key: typeof filterType; label: string; emoji: string; activeColor: string }[] = [
    { key: "all", label: "All", emoji: "🔔", activeColor: "bg-white/10 text-white border-white/20" },
    { key: "absent", label: "Absent", emoji: "❌", activeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
    { key: "late", label: "Late", emoji: "⏰", activeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    { key: "announcement", label: "School", emoji: "📢", activeColor: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    { key: "emergency", label: "Urgent", emoji: "🚨", activeColor: "bg-red-500/15 text-red-300 border-red-500/30" },
    { key: "warning", label: "Warning", emoji: "⚠️", activeColor: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  ]

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100 relative overflow-x-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-[#070d1a]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="px-4 py-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-indigo-400" />
                </div>
                <h1 className="text-xl font-black text-white tracking-tight">Notifications</h1>
              </div>
              <p className="text-xs pl-11 mt-0.5">
                {unreadCount > 0
                  ? <span className="text-indigo-400 font-bold">{unreadCount} unread • {totalCount} total</span>
                  : <span className="text-slate-500">All caught up!</span>
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Mark all read</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-9 w-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
                title="Refresh notifications"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Search Bar & Unread Toggle */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Search alerts by title or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                showUnreadOnly ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showUnreadOnly ? "bg-indigo-400 animate-pulse" : "bg-slate-500"}`} />
              Unread only ({unreadCount})
            </button>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS CONTENT */}
      <div className="px-4 pb-32 pt-4 max-w-4xl mx-auto">
        {notificationsList.some(n => getDayLabel(n.createdAt) === "Today") && (
          <TodayStatusPanel notifications={notificationsList} />
        )}

        {/* Filter chips */}
        {notificationsList.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
            {filterOptions.map(opt => {
              const count = opt.key === "all"
                ? notificationsList.length
                : notificationsList.filter(n => n.type === opt.key).length
              if (opt.key !== "all" && count === 0) return null
              return (
                <button
                  key={opt.key}
                  onClick={() => setFilterType(opt.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                    filterType === opt.key
                      ? opt.activeColor
                      : "text-slate-500 border-white/6 bg-white/3 hover:text-slate-300 hover:bg-white/6"
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${filterType === opt.key ? "bg-white/20" : "bg-white/8"}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-white/3 border border-white/6 rounded-2xl p-8 max-w-sm mx-auto my-8">
            <div className="rounded-full bg-slate-800/60 p-4 border border-white/10">
              <BellOff className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-200">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No notifications yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/5" />
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/3 border border-white/5">
                    {label === "Today" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />}
                    {label}
                    <span className="text-slate-700">• {items.length}</span>
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/5" />
                </div>
                <div className="space-y-2.5">
                  {items.map(notification => {
                    const cfg = getTypeConfig(notification.type)
                    const { title, message } = localizeNotification(notification)
                    return (
                      <div
                        key={notification.id}
                        onClick={() => {
                          if (!notification.isRead) handleMarkAsRead(notification.id)
                          setSelectedNotif(notification)
                        }}
                      >
                        <NotificationCard
                          notification={notification}
                          cfg={cfg}
                          title={title}
                          message={message}
                          time={formatNotificationTime(notification.createdAt)}
                          onRead={() => handleMarkAsRead(notification.id)}
                          onDelete={(e) => handleDelete(e, notification.id)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setSelectedNotif(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/10">
                  {selectedNotif.type}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{localizeNotification(selectedNotif).title}</h3>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/3 border border-white/5 text-sm text-slate-300 leading-relaxed">
              {localizeNotification(selectedNotif).message}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <span>{formatNotificationTime(selectedNotif.createdAt)}</span>
              {selectedNotif.student?.fullName && (
                <span className="flex items-center gap-1 font-medium text-indigo-300">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {selectedNotif.student.fullName}
                </span>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={(e) => handleDelete(e, selectedNotif.id)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => setSelectedNotif(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
