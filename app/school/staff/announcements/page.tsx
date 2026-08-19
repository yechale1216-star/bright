"use client"

import { useState, useEffect } from "react"
import {
  Megaphone,
  Search,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
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

const API_URL = apiUrl

interface Announcement {
  id: string
  title: string
  message: string
  type: "announcement" | "emergency" | "info"
  createdAt: string
  isRead?: boolean
}

const typeConfig = {
  emergency: {
    label: "Emergency",
    icon: AlertTriangle,
    badgeClass: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    dotClass: "bg-rose-500",
    cardClass: "border-l-rose-500",
  },
  announcement: {
    label: "Announcement",
    icon: Megaphone,
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    dotClass: "bg-primary",
    cardClass: "border-l-primary",
  },
  info: {
    label: "Info",
    icon: Info,
    badgeClass: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    dotClass: "bg-sky-500",
    cardClass: "border-l-sky-500",
  },
}

export default function StaffAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { user: authUser } = useAuth()
  const confirmedSchoolId = authUser?.schoolId || ""

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : ""
    return {
      Accept: "application/json",
      Authorization: `Bearer ${token || ""}`,
      "x-school-id": confirmedSchoolId,
    }
  }

  const fetchAnnouncements = async (background = false) => {
    if (!confirmedSchoolId) return
    if (!background) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const data = await queryCache.fetchWithCache(
        `announcements_${confirmedSchoolId}`,
        60_000,
        async () => {
          const res = await fetch(`${API_URL}/api/announcements`, {
            headers: getAuthHeaders(),
          })
          if (!res.ok) throw new Error("Failed to fetch")
          return res.json()
        }
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

  useEffect(() => {
    if (!confirmedSchoolId) return
    fetchAnnouncements()
    const interval = setInterval(() => fetchAnnouncements(true), 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedSchoolId])

  if (isLoading) return <PageSkeleton variant="dashboard" />

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Announcements
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            School-wide broadcasts and alerts
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchAnnouncements(true)}
          disabled={isRefreshing}
          className="shrink-0"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: announcements.length, icon: Megaphone, color: "text-primary", bg: "bg-primary/10" },
          {
            label: "Today",
            value: announcements.filter(
              (a) => new Date(a.createdAt).toDateString() === new Date().toDateString()
            ).length,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Urgent",
            value: announcements.filter((a) => a.type === "emergency").length,
            icon: AlertTriangle,
            color: "text-rose-600",
            bg: "bg-rose-500/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-3 flex flex-col items-center gap-1 text-center shadow-sm"
          >
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <span className="text-xl font-black text-foreground">{stat.value}</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search announcements…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-card border-border rounded-xl"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-muted-foreground">
            {searchTerm ? "No results found" : "No announcements yet"}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {searchTerm ? "Try a different search term" : "Check back later for school updates"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((ann) => {
            const cfg = typeConfig[ann.type] ?? typeConfig.announcement
            const Icon = cfg.icon
            return (
              <button
                key={ann.id}
                onClick={() => setSelectedAnnouncement(ann)}
                className={cn(
                  "w-full text-left rounded-2xl border border-border bg-card shadow-sm p-4 border-l-4 transition-all hover:shadow-md hover:bg-card/80 active:scale-[0.99]",
                  cfg.cardClass
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0", cfg.badgeClass.split(" ").slice(-2).join(" "), "bg-opacity-10")}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate flex-1">{ann.title}</span>
                      <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 shrink-0", cfg.badgeClass)}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {ann.message}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/70">
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(ann.createdAt), "MMM d, yyyy · h:mm a")}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground/50 pb-2">
        Last updated {format(lastUpdated, "h:mm a")}
      </p>

      {/* Detail Modal */}
      {selectedAnnouncement && (() => {
        const cfg = typeConfig[selectedAnnouncement.type] ?? typeConfig.announcement
        const Icon = cfg.icon
        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <div
              className="w-full max-w-lg bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn("h-1.5 w-full", cfg.dotClass.replace("bg-", "bg-"))} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center border", cfg.badgeClass)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <Badge variant="outline" className={cn("text-[10px] font-bold mb-1", cfg.badgeClass)}>
                        {cfg.label}
                      </Badge>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(selectedAnnouncement.createdAt), "MMMM d, yyyy · h:mm a")}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="font-extrabold text-lg text-foreground mb-3 leading-snug">
                  {selectedAnnouncement.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedAnnouncement.message}
                </p>
              </div>
              <div className="px-5 pb-5">
                <Button
                  className="w-full rounded-xl"
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
    </div>
  )
}
