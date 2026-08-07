"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { parentDb, type ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { formatEthiopianDateDMY, formatEthiopianDateTimeDMY } from "@/lib/utils/date-utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  Bell, CheckCheck, Trash2, BellOff,
  Clock, XCircle, AlertTriangle, Info,
  UserX, X, Search, RefreshCw,
  GraduationCap, ShieldAlert, LogOut,
  CheckCircle2, ChevronRight, Sparkles, ArrowLeft,
} from "lucide-react"

// ── Auth helper ───────────────────────────────────────────────────────────────
function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false
  const token = localStorage.getItem("attendance_token")
  const user = localStorage.getItem("attendance_current_user")
  return !!(token && user)
}

// ── Date grouping ─────────────────────────────────────────────────────────────
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

function groupNotificationsByDay(
  notifications: ParentNotification[]
): { label: string; items: ParentNotification[] }[] {
  const groups: { [key: string]: ParentNotification[] } = {}
  for (const n of notifications) {
    const label = getDayLabel(n.createdAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

// ── Type configurations ───────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  icon: React.ReactNode
  iconBg: string
  iconBorder: string
  pillBg: string
  pillText: string
  accentColor: string
  label: string
}> = {
  absent: {
    icon: <XCircle className="w-[18px] h-[18px]" />,
    iconBg: "bg-rose-500/15",
    iconBorder: "border-rose-500/25",
    pillBg: "bg-rose-500/15",
    pillText: "text-rose-400",
    accentColor: "bg-rose-500",
    label: "ABSENT",
  },
  late: {
    icon: <Clock className="w-[18px] h-[18px]" />,
    iconBg: "bg-amber-500/15",
    iconBorder: "border-amber-500/25",
    pillBg: "bg-amber-500/15",
    pillText: "text-amber-400",
    accentColor: "bg-amber-500",
    label: "LATE",
  },
  emergency: {
    icon: <ShieldAlert className="w-[18px] h-[18px]" />,
    iconBg: "bg-red-500/15",
    iconBorder: "border-red-500/25",
    pillBg: "bg-red-500/15",
    pillText: "text-red-400",
    accentColor: "bg-red-500",
    label: "URGENT",
  },
  warning: {
    icon: <AlertTriangle className="w-[18px] h-[18px]" />,
    iconBg: "bg-orange-500/15",
    iconBorder: "border-orange-500/25",
    pillBg: "bg-orange-500/15",
    pillText: "text-orange-400",
    accentColor: "bg-orange-500",
    label: "WARNING",
  },
  info: {
    icon: <Info className="w-[18px] h-[18px]" />,
    iconBg: "bg-sky-500/15",
    iconBorder: "border-sky-500/25",
    pillBg: "bg-sky-500/15",
    pillText: "text-sky-400",
    accentColor: "bg-sky-500",
    label: "INFO",
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type?.toLowerCase()] ?? {
    icon: <Bell className="w-[18px] h-[18px]" />,
    iconBg: "bg-slate-700/40",
    iconBorder: "border-slate-700/40",
    pillBg: "bg-slate-700/30",
    pillText: "text-slate-400",
    accentColor: "bg-slate-500",
    label: (type || "INFO").toUpperCase(),
  }
}

// ── Today Snapshot ────────────────────────────────────────────────────────────
function TodaySnapshot({ notifications }: { notifications: ParentNotification[] }) {
  const todayNotes = notifications.filter(n => getDayLabel(n.createdAt) === "Today")
  const absent = todayNotes.filter(n => n.type === "absent").length
  const late = todayNotes.filter(n => n.type === "late").length
  const warning = todayNotes.filter(n => n.type === "warning").length
  const allGood = absent === 0 && late === 0 && warning === 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-800/80 p-4 mb-3">
      {/* Glow */}
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none ${allGood ? "bg-emerald-400" : "bg-rose-500"}`} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${allGood ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
            {allGood
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <GraduationCap className="w-4 h-4 text-rose-400" />
            }
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Today's Snapshot</p>
            <p className="text-[10px] text-slate-600 font-medium">{formatEthiopianDateDMY(new Date())}</p>
          </div>
        </div>

        {allGood ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-400">All Clear</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {absent > 0 && (
              <div className="text-center px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <p className="text-base font-black text-rose-400 leading-none">{absent}</p>
                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wide mt-0.5">Absent</p>
              </div>
            )}
            {late > 0 && (
              <div className="text-center px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-base font-black text-amber-400 leading-none">{late}</p>
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide mt-0.5">Late</p>
              </div>
            )}
            {warning > 0 && (
              <div className="text-center px-2.5 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-base font-black text-orange-400 leading-none">{warning}</p>
                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-wide mt-0.5">Warn</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Signed-out wall ───────────────────────────────────────────────────────────
function SignedOutWall() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center gap-6 max-w-xs w-full">
        <div className="relative">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/8 flex items-center justify-center shadow-2xl">
            <UserX className="h-9 w-9 text-slate-500" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white">You're signed out</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Sign in to see your attendance alerts and notifications.
          </p>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white text-sm active:scale-[0.98] transition-transform shadow-xl shadow-indigo-900/40"
        >
          <LogOut className="h-4 w-4 rotate-180" />
          Sign In
        </button>
      </div>
    </div>
  )
}

// ── Notification Card ─────────────────────────────────────────────────────────
function NotificationCard({
  notification, cfg, title, message, time, onDelete, onClick,
}: {
  notification: ParentNotification
  cfg: ReturnType<typeof getTypeConfig>
  title: string
  message: string
  time: string
  onDelete: (e: React.MouseEvent) => void
  onClick: () => void
}) {
  const isUnread = !notification.isRead

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left relative overflow-hidden rounded-2xl border transition-all duration-200 active:scale-[0.985] ${
        isUnread
          ? "bg-white/[0.04] border-white/10 shadow-lg"
          : "bg-white/[0.02] border-white/[0.05]"
      }`}
    >
      {/* Left accent bar for unread */}
      {isUnread && (
        <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${cfg.accentColor} opacity-80`} />
      )}

      <div className="flex items-start gap-3 p-3.5 pl-4">
        {/* Icon */}
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${cfg.iconBg} ${cfg.iconBorder} ${cfg.pillText} mt-0.5`}>
          {cfg.icon}
          {/* Unread dot on icon */}
          {isUnread && (
            <span className={`absolute top-3 left-3.5 w-2 h-2 rounded-full ${cfg.accentColor} ring-2 ring-[#060c18]`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: pill + student + delete */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${cfg.pillBg} ${cfg.pillText}`}>
                {cfg.label}
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
              className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title */}
          <p className={`text-sm font-semibold leading-snug truncate ${isUnread ? "text-white" : "text-slate-400"}`}>
            {title}
          </p>

          {/* Message preview */}
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
            {message}
          </p>

          {/* Bottom row: time + read badge */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {time}
            </span>
            {!isUnread ? (
              <span className="text-[9px] font-bold text-slate-600 flex items-center gap-1 uppercase tracking-wider">
                <CheckCheck className="w-3 h-3 text-emerald-600" />Read
              </span>
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ParentNotifications() {
  const { t } = useLanguage()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [notificationsList, setNotificationsList] = useState<ParentNotification[]>([])
  const [filterType, setFilterType] = useState<"all" | "absent" | "late" | "emergency" | "warning">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<ParentNotification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── Auth & load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn()) { setSignedOut(true); setAuthChecked(true); setIsLoading(false); return }
    setAuthChecked(true)
    loadData()
  }, [])

  const fetchNotificationsList = useCallback(async (phone: string) => {
    const list = await parentDb.getNotifications(phone)
    setNotificationsList(list)
  }, [])

  const loadData = async () => {
    const userStr =
      localStorage.getItem("attendance_current_user") ||
      localStorage.getItem("auth_user") ||
      sessionStorage.getItem("auth_user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
        const phone = user.phone || user.phoneNumber
        if (phone) await fetchNotificationsList(phone)
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

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleMarkAsRead = async (id: string) => {
    if (!currentUser?.phone) return
    const ok = await parentDb.markNotificationAsRead(id)
    if (ok) {
      setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      window.dispatchEvent(new Event("refreshNotifications"))
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setNotificationsList(prev => prev.filter(n => n.id !== id))
    if (selectedNotif?.id === id) setSelectedNotif(null)
    window.dispatchEvent(new Event("refreshNotifications"))
    try {
      await parentDb.deleteNotification(id)
    } catch {
      if (currentUser?.phone) await fetchNotificationsList(currentUser.phone)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!currentUser?.phone) return
    const ok = await parentDb.markAllNotificationsAsRead(currentUser.phone)
    if (ok) {
      setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })))
      window.dispatchEvent(new Event("refreshNotifications"))
    }
  }

  const handleRefresh = async () => {
    if (!currentUser?.phone || isRefreshing) return
    setIsRefreshing(true)
    await fetchNotificationsList(currentUser.phone)
    setIsRefreshing(false)
  }

  // ── Localization ────────────────────────────────────────────────────────────
  const localizeNotification = (n: ParentNotification): { title: string; message: string } => {
    const studentName = n.student?.fullName?.split(" ")[0] || ""
    const isFemale = n.student?.gender?.toLowerCase() === "female"
    const suffix = isFemale ? "_f" : ""
    const formattedDate = formatEthiopianDateDMY(n.createdAt)
    const vars = {
      name: studentName, StudentName: studentName,
      "Parent Name": "ወላጅ", parentName: "ወላጅ",
      date: formattedDate, Date: formattedDate,
    }
    switch (n.type as string) {
      case "absent":  return { title: t(("alert_absent_title"  + suffix) as any, vars), message: t(("alert_absent_msg"  + suffix) as any, vars) }
      case "late":    return { title: t(("alert_late_title"    + suffix) as any, vars), message: t(("alert_late_msg"    + suffix) as any, vars) }
      case "excused": return { title: t(("alert_excused_title" + suffix) as any, vars), message: t(("alert_excused_msg" + suffix) as any, vars) }
      case "warning": return { title: t(("alert_warning_title" + suffix) as any, vars), message: t(("alert_warning_msg" + suffix) as any, vars) }
      default:        return { title: n.title, message: n.message }
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!authChecked || (authChecked && signedOut)) return <SignedOutWall />
  if (isLoading) return <PageSkeleton variant="cards" />

  // ── Derived data ────────────────────────────────────────────────────────────
  const unreadCount = notificationsList.filter(n => !n.isRead).length
  const totalCount = notificationsList.length

  const filtered = notificationsList.filter(n => {
    const matchesType = filterType === "all" || n.type === filterType
    const matchesUnread = !showUnreadOnly || !n.isRead
    const { title, message } = localizeNotification(n)
    const q = searchTerm.toLowerCase()
    const matchesSearch = !q || title.toLowerCase().includes(q) || message.toLowerCase().includes(q)
    return matchesType && matchesUnread && matchesSearch
  })
  const grouped = groupNotificationsByDay(filtered)

  const filterOptions: { key: typeof filterType; label: string; emoji: string }[] = [
    { key: "all",       label: "All",     emoji: "🔔" },
    { key: "absent",    label: "Absent",  emoji: "❌" },
    { key: "late",      label: "Late",    emoji: "⏰" },
    { key: "emergency", label: "Urgent",  emoji: "🚨" },
    { key: "warning",   label: "Warning", emoji: "⚠️" },
  ]

  const filterActiveClass: Record<string, string> = {
    all:       "bg-white/10 text-white border-white/20",
    absent:    "bg-rose-500/15 text-rose-300 border-rose-500/30",
    late:      "bg-amber-500/15 text-amber-300 border-amber-500/30",
    emergency: "bg-red-500/15 text-red-300 border-red-500/30",
    warning:   "bg-orange-500/15 text-orange-300 border-orange-500/30",
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060c18] text-slate-100 relative overflow-x-hidden rounded-3xl">

      {/* Ambient glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[280px] bg-violet-600/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[260px] h-[260px] bg-indigo-600/6 rounded-full blur-[80px] pointer-events-none" />

      {/* ── Sticky Header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#060c18]/85 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="px-4 pt-4 pb-3 max-w-2xl mx-auto">

          {/* Title row */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              {/* Back arrow */}
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white active:scale-90 transition-all shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h1 className="text-[17px] font-black text-white tracking-tight leading-none">Notifications</h1>
                <p className="text-[11px] mt-0.5">
                  {unreadCount > 0
                    ? <span className="text-violet-400 font-semibold">{unreadCount} unread · {totalCount} total</span>
                    : <span className="text-slate-500">All caught up</span>
                  }
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-[11px] font-bold text-violet-400 active:scale-95 transition-transform"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Mark read</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center active:scale-95 transition-transform"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Search + Unread toggle */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notifications…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8.5 pr-8 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/40 transition-colors"
                style={{ paddingLeft: "2.25rem" }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${
                showUnreadOnly
                  ? "bg-violet-500/15 text-violet-300 border-violet-500/25"
                  : "bg-white/[0.04] text-slate-500 border-white/8"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showUnreadOnly ? "bg-violet-400 animate-pulse" : "bg-slate-600"}`} />
              {unreadCount}
            </button>
          </div>

          {/* Filter chips */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {filterOptions.map(opt => {
                const count = opt.key === "all"
                  ? totalCount
                  : notificationsList.filter(n => n.type === opt.key).length
                if (opt.key !== "all" && count === 0) return null
                const isActive = filterType === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFilterType(opt.key)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all active:scale-95 ${
                      isActive ? filterActiveClass[opt.key] : "text-slate-500 border-white/[0.06] bg-white/[0.03] hover:text-slate-300"
                    }`}
                  >
                    <span className="text-[10px]">{opt.emoji}</span>
                    {opt.label}
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-white/8"}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-28 pt-4 max-w-2xl mx-auto">

        {/* Today snapshot (only if there are today notifications) */}
        {notificationsList.some(n => getDayLabel(n.createdAt) === "Today") && (
          <TodaySnapshot notifications={notificationsList} />
        )}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center">
              <BellOff className="w-7 h-7 text-slate-600" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-300">All caught up!</p>
              <p className="text-sm text-slate-600 mt-1">
                {searchTerm || filterType !== "all" || showUnreadOnly
                  ? "No notifications match your filters."
                  : "No notifications yet."}
              </p>
            </div>
            {(searchTerm || filterType !== "all" || showUnreadOnly) && (
              <button
                onClick={() => { setSearchTerm(""); setFilterType("all"); setShowUnreadOnly(false) }}
                className="text-xs font-bold text-violet-400 underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Day divider */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="h-px flex-1 bg-white/[0.05]" />
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] shrink-0">
                    {label === "Today" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    )}
                    {label}
                    <span className="text-slate-700">· {items.length}</span>
                  </span>
                  <div className="h-px flex-1 bg-white/[0.05]" />
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.map(notification => {
                    const cfg = getTypeConfig(notification.type)
                    const { title, message } = localizeNotification(notification)
                    return (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        cfg={cfg}
                        title={title}
                        message={message}
                        time={formatEthiopianDateTimeDMY(notification.createdAt)}
                        onClick={() => {
                          if (!notification.isRead) handleMarkAsRead(notification.id)
                          setSelectedNotif(notification)
                        }}
                        onDelete={e => handleDelete(e, notification.id)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {selectedNotif && (() => {
        const cfg = getTypeConfig(selectedNotif.type)
        const { title, message } = localizeNotification(selectedNotif)
        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Bottom sheet on mobile, centered modal on sm+ */}
            <div className="bg-[#0d1527] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-250 relative overflow-hidden">

              {/* Coloured header strip */}
              <div className={`h-1 w-full ${cfg.accentColor} opacity-60`} />

              <div className="p-5 space-y-4">
                {/* Close */}
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Icon + type pill + title */}
                <div className="flex items-start gap-3 pr-8">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${cfg.iconBg} ${cfg.iconBorder} ${cfg.pillText}`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1 ${cfg.pillBg} ${cfg.pillText}`}>
                      {cfg.label}
                    </span>
                    <h3 className="text-[15px] font-bold text-white leading-snug">{title}</h3>
                  </div>
                </div>

                {/* Message body */}
                <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed">
                  {message}
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {formatEthiopianDateTimeDMY(selectedNotif.createdAt)}
                  </span>
                  {selectedNotif.student?.fullName && (
                    <span className="flex items-center gap-1.5 font-semibold text-violet-400">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {selectedNotif.student.fullName}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={e => handleDelete(e, selectedNotif.id)}
                    className="flex-1 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[13px] font-bold text-rose-400 active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="flex-1 py-3 rounded-xl bg-white/8 hover:bg-white/12 text-[13px] font-bold text-white active:scale-[0.97] transition-transform"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
