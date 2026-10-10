"use client"

import { useState, useEffect } from "react"
import { 
  Megaphone, 
  Plus, 
  Search, 
  Trash2, 
  Clock, 
  Bell, 
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Edit2,
  RefreshCw,
  Eye,
  Users,
  GraduationCap,
  Globe,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { notifications } from "@/lib/utils/notifications"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { format } from "date-fns"
import { useAuth } from "@/lib/context/auth-context"
import { queryCache } from "@/lib/utils/query-cache"
import { apiUrl } from "@/lib/api-config"

const API_URL = apiUrl;

type AnnouncementAudience = "GENERAL" | "PARENTS" | "STAFF";

interface Announcement {
  id: string
  title: string
  message: string
  type: "announcement" | "emergency" | "info"
  targetAudience?: AnnouncementAudience | string
  createdAt: string
  isRead?: boolean
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [audienceFilter, setAudienceFilter] = useState<"ALL" | AnnouncementAudience>("ALL")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // View Modal state
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  // Delete Modal state
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use AuthContext as the single source of truth for tenant identity.
  const { user: authUser } = useAuth()
  const confirmedSchoolId = authUser?.schoolId || "single-school"

  // Derive auth headers from the confirmed context
  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : ""
    return {
      "Accept": "application/json",
      Authorization: `Bearer ${token || ""}`,
      "x-school-id": confirmedSchoolId,
    }
  }

  // Form State
  const [newAnnouncement, setNewAnnouncement] = useState<{
    title: string
    message: string
    type: "announcement" | "emergency" | "info"
    targetAudience: AnnouncementAudience
  }>({
    title: "",
    message: "",
    type: "announcement",
    targetAudience: "GENERAL"
  })

  useEffect(() => {
    if (!confirmedSchoolId) return

    fetchAnnouncements()

    // Background polling for "instant" updates (every 10 seconds)
    const pollInterval = setInterval(() => {
      fetchAnnouncements(true)
    }, 10000)

    return () => clearInterval(pollInterval)
  }, [confirmedSchoolId])

  const fetchAnnouncements = async (isBackground = false) => {
    if (!isBackground && announcements.length === 0) setIsLoading(true)
    if (!confirmedSchoolId) {
      console.warn("[Announcements] fetchAnnouncements skipped — no confirmed schoolId")
      setIsLoading(false)
      return
    }
    try {
      const data = await queryCache.fetch(
        `announcements_${confirmedSchoolId}`,
        async () => {
          const res = await fetch(`${API_URL}/api/announcements`, {
            headers: getAuthHeaders()
          })
          if (!res.ok) {
            if (res.status === 401) {
              const { authService } = await import("@/lib/auth/auth");
              authService.handleUnauthorized();
              return [];
            }
            const text = await res.text()
            throw new Error(text || `HTTP ${res.status}`)
          }
          const json = await res.json()
          return json.success ? json.data : []
        },
        { staleTime: 30_000, persist: false }
      )
      setAnnouncements(data)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnouncement.title || !newAnnouncement.message) {
      notifications.warning("Missing Fields", "Please provide both title and message.")
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingId 
        ? `${API_URL}/api/announcements/${editingId}`
        : `${API_URL}/api/announcements`
      
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newAnnouncement)
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.success) {
        const audienceLabel = newAnnouncement.targetAudience === 'PARENTS' ? 'Parents' : newAnnouncement.targetAudience === 'STAFF' ? 'School Staff' : 'Everyone';
        notifications.success(
          editingId ? "Updated" : "Published", 
          editingId ? "Announcement updated successfully." : `Your announcement is live for ${audienceLabel}.`
        )
        queryCache.invalidate("announcements_")
        setIsCreateModalOpen(false)
        resetForm()
        fetchAnnouncements()
      }
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to publish announcement")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNewAnnouncement({ title: "", message: "", type: "announcement", targetAudience: "GENERAL" })
    setEditingId(null)
  }

  const startEdit = (announcement: Announcement) => {
    const rawAudience = (announcement.targetAudience || "GENERAL").toUpperCase() as AnnouncementAudience
    setNewAnnouncement({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      targetAudience: ["GENERAL", "PARENTS", "STAFF"].includes(rawAudience) ? rawAudience : "GENERAL"
    })
    setEditingId(announcement.id)
    setIsCreateModalOpen(true)
  }

  const handleView = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setIsViewModalOpen(true)
  }

  const handleConfirmDelete = (announcement: Announcement) => {
    setDeletingAnnouncement(announcement)
    setIsDeleteModalOpen(true)
  }

  const executeDelete = async () => {
    if (!deletingAnnouncement) return
    setIsDeleting(true)
    try {
      let res = await fetch(`${API_URL}/api/announcements/${deletingAnnouncement.id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      })

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/parent/notifications/${deletingAnnouncement.id}`, {
          method: "DELETE",
          headers: getAuthHeaders()
        })
      }

      if (res.ok) {
        notifications.success("Deleted", "Announcement removed successfully.")
        queryCache.invalidate("announcements_")
        setAnnouncements(prev => prev.filter(a => a.id !== deletingAnnouncement.id))
        setIsDeleteModalOpen(false)
        if (isViewModalOpen && selectedAnnouncement?.id === deletingAnnouncement.id) {
          setIsViewModalOpen(false)
          setSelectedAnnouncement(null)
        }
      } else {
        const text = await res.text()
        throw new Error(text || "Failed to delete announcement")
      }
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to delete announcement")
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter announcements by search and audience
  const filteredAnnouncements = announcements.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.message.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (!matchesSearch) return false

    if (audienceFilter === "ALL") return true

    const currentAudience = (a.targetAudience || "GENERAL").toUpperCase()
    if (audienceFilter === "GENERAL") {
      return currentAudience === "GENERAL" || !a.targetAudience
    }
    return currentAudience === audienceFilter
  })

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "emergency": return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "info": return <Info className="w-4 h-4 text-blue-500" />
      default: return <Megaphone className="w-4 h-4 text-emerald-500" />
    }
  }

  const getTypeStyles = (type: string) => {
    switch(type) {
      case "emergency": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
      case "info": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
      default: return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
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

  const parentsCount = announcements.filter(a => (a.targetAudience || "").toUpperCase() === "PARENTS").length
  const staffCount = announcements.filter(a => (a.targetAudience || "").toUpperCase() === "STAFF").length
  const generalCount = announcements.filter(a => !a.targetAudience || (a.targetAudience || "").toUpperCase() === "GENERAL").length

  const stats = [
    { label: "Total Broadcasts", value: announcements.length, icon: Megaphone, bg: "bg-primary/10", text: "text-primary" },
    { label: "Parents Only", value: parentsCount, icon: Users, bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
    { label: "Staff Only", value: staffCount, icon: GraduationCap, bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
    { label: "General (Everyone)", value: generalCount, icon: Globe, bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="typography-page-title text-slate-900 dark:text-white">
              Announcements & Broadcasts
            </h1>
            <p className="typography-helper text-slate-500 dark:text-slate-400 mt-1">
              Publish targeted broadcasts to parents, school staff, or the entire school community.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnnouncements()}
              className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold px-5 shadow-sm shadow-primary/20 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.text)} />
              </div>
              <div className="min-w-0">
                <p className="typography-label text-slate-500 dark:text-slate-400 text-xs truncate">{stat.label}</p>
                <p className={cn("text-xl font-bold tracking-tight", stat.text)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Content ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

          {/* Toolbar with Audience Filter Tabs and Search */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="typography-section-title text-slate-900 dark:text-white">Broadcast History</h2>
                <p className="typography-helper text-slate-500 dark:text-slate-400 mt-0.5">
                  {filteredAnnouncements.length} announcement{filteredAnnouncements.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search announcements…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Audience Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: "ALL", label: "All Audiences", icon: Filter, count: announcements.length },
                { id: "GENERAL", label: "General — Everyone", icon: Globe, count: generalCount },
                { id: "PARENTS", label: "Parents Only", icon: Users, count: parentsCount },
                { id: "STAFF", label: "School Staff", icon: GraduationCap, count: staffCount },
              ].map(tab => {
                const isActive = audienceFilter === tab.id
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAudienceFilter(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                      isActive
                        ? "bg-primary text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                      isActive ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Announcement List */}
          <div className="p-4 sm:p-5">
            {isLoading ? (
              <PageSkeleton variant="cards" />
            ) : filteredAnnouncements.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                  <Megaphone className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="typography-card-title text-slate-700 dark:text-slate-300">No announcements found</h3>
                  <p className="typography-helper text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchTerm 
                      ? "No results match your search term."
                      : audienceFilter !== "ALL"
                      ? `No announcements found for ${audienceFilter === 'PARENTS' ? 'Parents' : audienceFilter === 'STAFF' ? 'School Staff' : 'General'}.`
                      : "Create your first broadcast to communicate with your school community."}
                  </p>
                </div>
                {!searchTerm && (
                  <Button
                    onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Announcement
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnnouncements.map((announcement) => {
                  const audBadge = getAudienceBadge(announcement.targetAudience)
                  const AudIcon = audBadge.icon

                  return (
                    <div
                      key={announcement.id}
                      onClick={() => handleView(announcement)}
                      className="group cursor-pointer flex items-start gap-3.5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all shadow-xs"
                    >
                      {/* Type Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5",
                        getTypeStyles(announcement.type)
                      )}>
                        {getTypeIcon(announcement.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className="typography-card-title text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors text-sm sm:text-base font-bold">
                            {announcement.title}
                          </h4>

                          {/* Audience Badge */}
                          <Badge
                            className={cn(
                              "text-[10px] px-2 py-0.5 h-5 font-semibold border flex items-center gap-1 shrink-0",
                              audBadge.className
                            )}
                          >
                            <AudIcon className="w-3 h-3" />
                            <span>{audBadge.label}</span>
                          </Badge>

                          {/* Priority Badge */}
                          <Badge
                            className={cn(
                              "text-[10px] px-2 py-0.5 h-5 font-semibold border capitalize shrink-0",
                              getTypeStyles(announcement.type)
                            )}
                          >
                            {announcement.type === "announcement" ? "Standard" : announcement.type === "info" ? "Info" : "Emergency"}
                          </Badge>
                        </div>

                        <p className="typography-body text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed text-xs sm:text-sm">
                          {announcement.message}
                        </p>

                        <div className="flex items-center gap-4 mt-2.5">
                          <span className="typography-helper text-slate-400 flex items-center gap-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(announcement.createdAt), 'MMM dd, yyyy')}
                          </span>
                          <span className="typography-helper text-slate-400 flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(announcement.createdAt), 'hh:mm a')}
                          </span>
                        </div>
                      </div>

                      {/* Actions Toolbar */}
                      <div 
                        className="flex items-center gap-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(announcement)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(announcement)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit Announcement"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConfirmDelete(announcement)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer with last-updated hint */}
          {!isLoading && announcements.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <p>Auto-refreshes every 10 seconds</p>
              <p>Last updated: {format(lastUpdated, 'hh:mm a')}</p>
            </div>
          )}
        </div>

        {/* ── Create / Edit Dialog ── */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[580px] max-h-[90vh] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
            <DialogHeader className="bg-primary p-6 md:p-7 text-white relative overflow-hidden shrink-0">
              <div className="absolute -top-4 -right-4 opacity-10">
                <Megaphone className="w-32 h-32 rotate-12" />
              </div>
              <DialogTitle className="text-xl font-bold flex items-center gap-3 relative z-10">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingId ? "Edit Announcement" : "New Announcement Broadcast"}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 mt-1.5 relative z-10 text-xs sm:text-sm">
                {editingId
                  ? "Modify your existing broadcast to update target recipients."
                  : "Target your broadcast to Parents, School Staff, or the entire school community."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAnnouncement} className="p-5 sm:p-7 bg-card dark:bg-slate-900 flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 pb-2">
                
                {/* 1. Audience Selector */}
                <div className="space-y-2">
                  <Label className="typography-label text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-bold">
                    <Users className="w-4 h-4 text-primary" />
                    Target Audience *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: "GENERAL" as AnnouncementAudience,
                        title: "General",
                        sub: "Parents & Staff",
                        icon: Globe,
                        color: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      },
                      {
                        id: "PARENTS" as AnnouncementAudience,
                        title: "Parents",
                        sub: "Parent Portal Only",
                        icon: Users,
                        color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                      },
                      {
                        id: "STAFF" as AnnouncementAudience,
                        title: "School Staff",
                        sub: "Teachers & Staff",
                        icon: GraduationCap,
                        color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }
                    ].map(option => {
                      const isSelected = newAnnouncement.targetAudience === option.id
                      const OptionIcon = option.icon
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setNewAnnouncement(prev => ({ ...prev, targetAudience: option.id }))}
                          className={cn(
                            "p-3 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-1.5 cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-xs"
                              : "border-border bg-card hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center", isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                              <OptionIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                              isSelected ? "border-primary bg-primary text-white" : "border-slate-300 dark:border-slate-600"
                            )}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-xs text-foreground leading-tight">{option.title}</p>
                            <p className="text-[10px] text-muted-foreground">{option.sub}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Announcement Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="typography-label text-slate-700 dark:text-slate-300 font-bold">
                    Announcement Title *
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. School Resumes Next Week"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-11 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 3. Priority Level */}
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="typography-label text-slate-700 dark:text-slate-300 font-bold">
                    Priority Level *
                  </Label>
                  <Select
                    value={newAnnouncement.type}
                    onValueChange={(val: any) => setNewAnnouncement(prev => ({ ...prev, type: val }))}
                  >
                    <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      <SelectItem value="announcement" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-emerald-500" />
                          <span>Standard Announcement</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="info" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-500" />
                          <span>General Information</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="emergency" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span>High Priority Alert</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Message Content */}
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="typography-label text-slate-700 dark:text-slate-300 font-bold">
                    Message Content *
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Write your announcement message here…"
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[110px] max-h-[200px] focus:ring-2 focus:ring-primary/20 resize-y overflow-y-auto"
                  />
                </div>
              </div>

              <DialogFooter className="flex items-center gap-3 pt-4 border-t border-border shrink-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 flex-1 border-slate-200 dark:border-slate-700"
                  onClick={() => { setIsCreateModalOpen(false); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20 h-11 flex-1 rounded-xl font-semibold"
                >
                  {isSubmitting ? "Processing…" : editingId ? "Save Changes" : "Publish Broadcast"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── View Announcement Dialog ── */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[580px] max-h-[90vh] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
            {selectedAnnouncement && (() => {
              const audBadge = getAudienceBadge(selectedAnnouncement.targetAudience)
              const AudIcon = audBadge.icon

              return (
                <>
                  <DialogHeader className={cn(
                    "p-6 md:p-7 text-white relative overflow-hidden shrink-0",
                    selectedAnnouncement.type === "emergency" ? "bg-rose-600 dark:bg-rose-700" :
                    selectedAnnouncement.type === "info" ? "bg-blue-600 dark:bg-blue-700" : "bg-primary"
                  )}>
                    <div className="absolute -top-4 -right-4 opacity-10">
                      <Megaphone className="w-32 h-32 rotate-12" />
                    </div>
                    <div className="flex items-center gap-2 mb-2 relative z-10 flex-wrap">
                      <Badge className="bg-white/20 text-white hover:bg-white/30 border-none capitalize px-2.5 py-0.5 text-xs font-semibold">
                        {selectedAnnouncement.type === "announcement" ? "Standard Announcement" : selectedAnnouncement.type === "info" ? "General Information" : "Emergency Alert"}
                      </Badge>
                      <Badge className="bg-white/25 text-white hover:bg-white/35 border-none px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                        <AudIcon className="w-3 h-3" />
                        <span>{audBadge.label}</span>
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl md:text-2xl font-bold relative z-10 leading-snug">
                      {selectedAnnouncement.title}
                    </DialogTitle>
                    <DialogDescription className="text-white/80 mt-1.5 relative z-10 text-xs flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(selectedAnnouncement.createdAt), 'MMM dd, yyyy')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(selectedAnnouncement.createdAt), 'hh:mm a')}
                      </span>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-6 md:p-7 bg-card dark:bg-slate-900 flex flex-col flex-1 overflow-hidden min-h-0 space-y-4">
                    <div className="overflow-y-auto max-h-[50vh] pr-2 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider">Targeted Recipients:</span>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <AudIcon className="w-3.5 h-3.5 text-primary" />
                          {audBadge.label}
                        </span>
                      </div>
                      <div className="typography-body text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm">
                        {selectedAnnouncement.message}
                      </div>
                    </div>

                    <DialogFooter className="flex items-center gap-2 pt-4 border-t border-border shrink-0 sm:justify-between flex-wrap">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          onClick={() => {
                            setIsViewModalOpen(false);
                            startEdit(selectedAnnouncement);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2 text-primary" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl h-10 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          onClick={() => {
                            setIsViewModalOpen(false);
                            handleConfirmDelete(selectedAnnouncement);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                      <Button
                        type="button"
                        className="rounded-xl h-10 px-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold w-full sm:w-auto mt-2 sm:mt-0"
                        onClick={() => setIsViewModalOpen(false)}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  </div>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ── */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-card dark:bg-slate-900 border-none shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete Announcement
                </DialogTitle>
                <DialogDescription className="typography-body text-slate-500 dark:text-slate-400 text-sm">
                  Are you sure you want to delete <span className="font-semibold text-slate-700 dark:text-slate-300">"{deletingAnnouncement?.title}"</span>? This broadcast will be removed for all targeted recipients.
                </DialogDescription>
              </div>
            </div>

            <DialogFooter className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-10 flex-1 border-slate-200 dark:border-slate-700"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white h-10 flex-1 rounded-xl font-semibold shadow-sm shadow-rose-600/20"
              >
                {isDeleting ? "Deleting..." : "Delete Broadcast"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile FAB — only on small screens */}
        <div className="sm:hidden fixed bottom-24 right-6 z-50">
          <Button
            onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
            className="h-14 w-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/40 flex items-center justify-center p-0 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>

      </div>
    </div>
  )
}
