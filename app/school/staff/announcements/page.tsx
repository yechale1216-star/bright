"use client"

import { useState, useEffect } from "react"
import {
  Megaphone,
  Search,
  Bell,
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  X,
  GraduationCap,
  Globe,
  Filter,
  Calendar,
  Users,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { format } from "date-fns"
import { useAuth } from "@/lib/context/auth-context"
import { queryCache } from "@/lib/utils/query-cache"
import { apiUrl } from "@/lib/api-config"
import { notifications } from "@/lib/utils/notifications"

const API_URL = apiUrl

interface Announcement {
  id: string
  title: string
  message: string
  type: "announcement" | "emergency" | "info"
  targetAudience?: "GENERAL" | "STAFF" | "PARENTS" | string
  createdAt: string
  isRead?: boolean
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "emergency": return <AlertTriangle className="w-4 h-4 text-red-500" />
    case "info": return <Info className="w-4 h-4 text-blue-500" />
    default: return <Megaphone className="w-4 h-4 text-emerald-500" />
  }
}

const getTypeStyles = (type: string) => {
  switch (type) {
    case "emergency": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
    case "info": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
    default: return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case "emergency": return "Emergency Alert"
    case "info": return "General Information"
    default: return "Standard Announcement"
  }
}

const getAudienceBadge = (audience?: string) => {
  const aud = (audience || "GENERAL").toUpperCase()
  switch (aud) {
    case "PARENTS":
      return {
        label: "Parents Only",
        icon: Users,
        className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
      }
    case "STAFF":
      return {
        label: "School Staff",
        icon: GraduationCap,
        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
      }
    default:
      return {
        label: "General (Everyone)",
        icon: Globe,
        className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
      }
  }
}

export default function StaffAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [audienceFilter, setAudienceFilter] = useState<"ALL" | "GENERAL" | "STAFF">("ALL")
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Delete state
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { user: authUser } = useAuth()
  const confirmedSchoolId = authUser?.schoolId || "single-school"

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : ""
    return {
      Accept: "application/json",
      Authorization: `Bearer ${token || ""}`,
      "x-school-id": confirmedSchoolId,
      "x-requested-role": "staff",
    }
  }

  const fetchAnnouncements = async (background = false) => {
    if (!confirmedSchoolId) return
    if (!background) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const data = await queryCache.fetch(
        `announcements_staff_${confirmedSchoolId}`,
        async () => {
          const res = await fetch(`${API_URL}/api/announcements`, {
            headers: getAuthHeaders(),
          })
          if (!res.ok) throw new Error("Failed to fetch")
          const json = await res.json()
          return json.success ? json.data : []
        },
        { staleTime: 30_000, persist: false }
      )
      setAnnouncements(Array.isArray(data) ? data : [])
      setLastUpdated(new Date())
    } catch {
      setAnnouncements([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const executeDelete = async () => {
    if (!deletingAnnouncement) return
    setIsDeleting(true)
    try {
      const res = await fetch(`${API_URL}/api/announcements/${deletingAnnouncement.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to delete announcement")
      }
      notifications.success("Deleted", "Announcement removed successfully.")
      queryCache.invalidate("announcements_staff_")
      setAnnouncements(prev => prev.filter(a => a.id !== deletingAnnouncement.id))
      setDeletingAnnouncement(null)
      // Close detail modal if it was the same item
      if (selectedAnnouncement?.id === deletingAnnouncement.id) {
        setSelectedAnnouncement(null)
      }
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to delete announcement")
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!confirmedSchoolId) return
    fetchAnnouncements()
    const interval = setInterval(() => fetchAnnouncements(true), 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedSchoolId])

  if (isLoading) return <PageSkeleton variant="dashboard" />

  const staffOnlyCount = announcements.filter(a => (a.targetAudience || "").toUpperCase() === "STAFF").length
  const generalCount = announcements.filter(a => !a.targetAudience || (a.targetAudience || "").toUpperCase() === "GENERAL").length

  const filtered = announcements.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.message.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (audienceFilter === "ALL") return true
    const currentAud = (a.targetAudience || "GENERAL").toUpperCase()
    if (audienceFilter === "GENERAL") return currentAud === "GENERAL" || !a.targetAudience
    return currentAud === audienceFilter
  })

  const stats = [
    { label: "Total Broadcasts", value: announcements.length, icon: Megaphone, bg: "bg-primary/10", text: "text-primary" },
    { label: "Staff Only", value: staffOnlyCount, icon: GraduationCap, bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
    { label: "General (Everyone)", value: generalCount, icon: Globe, bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Megaphone className="w-6 h-6 text-primary" />
              Staff Announcements
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              School-wide broadcasts &amp; staff notices
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnnouncements(true)}
            disabled={isRefreshing}
            className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 self-start sm:self-auto"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className={cn("w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.text)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight truncate">{stat.label}</p>
                <p className={cn("text-xl font-bold tracking-tight leading-tight", stat.text)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base">Broadcast History</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {filtered.length} announcement{filtered.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search announcements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            {/* Audience Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "ALL", label: "All Notices", icon: Filter, count: announcements.length },
                { id: "STAFF", label: "Staff Only", icon: GraduationCap, count: staffOnlyCount },
                { id: "GENERAL", label: "General (Everyone)", icon: Globe, count: generalCount },
              ].map(tab => {
                const isActive = audienceFilter === tab.id
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAudienceFilter(tab.id as "ALL" | "GENERAL" | "STAFF")}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer",
                      isActive
                        ? "bg-primary text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 rounded-full font-bold",
                      isActive ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* List */}
          <div className="p-4 sm:p-5">
            {filtered.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                  <Bell className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                    {searchTerm ? "No results found" : "No announcements yet"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchTerm ? "Try a different search term" : "Check back later for school updates"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((ann) => {
                  const audBadge = getAudienceBadge(ann.targetAudience)
                  const AudIcon = audBadge.icon
                  return (
                    <div
                      key={ann.id}
                      className="group flex items-start gap-3.5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all shadow-xs"
                    >
                      {/* Type Icon */}
                      <button
                        onClick={() => setSelectedAnnouncement(ann)}
                        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5 cursor-pointer"
                        style={{ background: "transparent" }}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          getTypeStyles(ann.type)
                        )}>
                          {getTypeIcon(ann.type)}
                        </div>
                      </button>

                      {/* Content — clickable */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setSelectedAnnouncement(ann)}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors text-sm flex-1">
                            {ann.title}
                          </h4>
                          <Badge className={cn(
                            "text-[10px] px-2 py-0.5 h-5 font-semibold border flex items-center gap-1 shrink-0",
                            audBadge.className
                          )}>
                            <AudIcon className="w-3 h-3" />
                            <span>{audBadge.label}</span>
                          </Badge>
                          <Badge className={cn(
                            "text-[10px] px-2 py-0.5 h-5 font-semibold border capitalize shrink-0",
                            getTypeStyles(ann.type)
                          )}>
                            {ann.type === "announcement" ? "Standard" : ann.type === "info" ? "Info" : "Emergency"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {ann.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2.5">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(ann.createdAt), "MMM dd, yyyy")}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(ann.createdAt), "hh:mm a")}
                          </span>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingAnnouncement(ann)
                        }}
                        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!isLoading && announcements.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <p>Auto-refreshes every 30 seconds</p>
              <p>Last updated: {format(lastUpdated, "hh:mm a")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAnnouncement && (() => {
        const audBadge = getAudienceBadge(selectedAnnouncement.targetAudience)
        const AudIcon = audBadge.icon
        const headerBg =
          selectedAnnouncement.type === "emergency" ? "bg-rose-600 dark:bg-rose-700" :
          selectedAnnouncement.type === "info" ? "bg-blue-600 dark:bg-blue-700" : "bg-primary"

        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <div
              className="w-full max-w-lg bg-card rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[80vh] sm:max-h-[88vh] min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn("p-6 text-white relative overflow-hidden shrink-0", headerBg)}>
                <div className="absolute -top-4 -right-4 opacity-10">
                  <Megaphone className="w-32 h-32 rotate-12" />
                </div>
                <div className="flex items-center gap-2 mb-2 relative z-10 flex-wrap">
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-none capitalize px-2.5 py-0.5 text-xs font-semibold">
                    {getTypeLabel(selectedAnnouncement.type)}
                  </Badge>
                  <Badge className="bg-white/25 text-white hover:bg-white/35 border-none px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                    <AudIcon className="w-3 h-3" />
                    <span>{audBadge.label}</span>
                  </Badge>
                </div>
                <h2 className="text-xl font-bold relative z-10 leading-snug pr-8">
                  {selectedAnnouncement.title}
                </h2>
                <div className="text-white/80 mt-1.5 relative z-10 text-xs flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(selectedAnnouncement.createdAt), "MMM dd, yyyy")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(selectedAnnouncement.createdAt), "hh:mm a")}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="absolute top-4 right-4 z-10 p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider">Targeted Recipients:</span>
                    <Badge className={cn("text-[10px] font-semibold border flex items-center gap-1", audBadge.className)}>
                      <AudIcon className="w-3 h-3" />
                      {audBadge.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {selectedAnnouncement.message}
                  </p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pt-3 pb-5 sm:pb-6 bg-card dark:bg-slate-900 shrink-0 flex gap-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  onClick={() => {
                    setDeletingAnnouncement(selectedAnnouncement)
                    setSelectedAnnouncement(null)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  variant="outline"
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Delete Confirmation Modal */}
      {deletingAnnouncement && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => !isDeleting && setDeletingAnnouncement(null)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Red accent bar */}
            <div className="h-1.5 w-full bg-rose-500" />
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Delete Announcement</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      &ldquo;{deletingAnnouncement.title}&rdquo;
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 border-slate-200 dark:border-slate-700"
                  onClick={() => setDeletingAnnouncement(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm shadow-rose-600/20"
                  onClick={executeDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}