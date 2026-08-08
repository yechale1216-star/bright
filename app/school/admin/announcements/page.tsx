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
  RefreshCw
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

interface Announcement {
  id: string
  title: string
  message: string
  type: "announcement" | "emergency" | "info"
  createdAt: string
  isRead: boolean
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Use AuthContext as the single source of truth for tenant identity.
  // NEVER read x-school-id or attendance_token directly from localStorage in page
  // components — those values can be stale immediately after onboarding.
  const { user: authUser } = useAuth()
  const confirmedSchoolId = authUser?.schoolId || ""

  // Derive auth headers from the confirmed context — not raw localStorage.
  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : ""
    return {
      "Accept": "application/json",
      Authorization: `Bearer ${token || ""}`,
      "x-school-id": confirmedSchoolId,
    }
  }

  // Form State
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    type: "announcement" as "announcement" | "emergency" | "info"
  })

  useEffect(() => {
    // Do not fetch until the authenticated tenant context is confirmed.
    // This is the primary guard against cross-tenant announcement leaks.
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
      if (!isBackground) {
        notifications.error("Error", "Failed to load announcements")
      }
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
        notifications.success(
          editingId ? "Updated" : "Published", 
          editingId ? "Announcement updated successfully." : "Your announcement is now live on the parent portal."
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
    setNewAnnouncement({ title: "", message: "", type: "announcement" })
    setEditingId(null)
  }

  const startEdit = (announcement: Announcement) => {
    setNewAnnouncement({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type
    })
    setEditingId(announcement.id)
    setIsCreateModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement? This will remove it for all parents.")) return

    try {
      const res = await fetch(`${API_URL}/api/parent/notifications/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      })

      if (res.ok) {
        notifications.success("Deleted", "Announcement removed.")
        setAnnouncements(prev => prev.filter(a => a.id !== id))
      }
    } catch (error) {
      notifications.error("Error", "Failed to delete announcement")
    }
  }

  const filteredAnnouncements = announcements.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  const stats = [
    { label: "Total Broadcasts", value: announcements.length, icon: Megaphone, bg: "bg-primary/10", text: "text-primary" },
    { label: "Today's Alerts", value: announcements.filter(a => new Date(a.createdAt).toDateString() === new Date().toDateString()).length, icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-600" },
    { label: "High Priority", value: announcements.filter(a => a.type === 'emergency').length, icon: Bell, bg: "bg-rose-500/10", text: "text-rose-600" }
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="typography-page-title text-slate-900 dark:text-white">
              Announcements
            </h1>
            <p className="typography-helper text-slate-500 dark:text-slate-400 mt-1">
              Broadcast messages and alerts to all parents in your school portal.
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className={cn("w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.text)} />
              </div>
              <div>
                <p className="typography-label text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className={cn("text-2xl font-bold tracking-tight", stat.text)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Content ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
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

          {/* Announcement List */}
          <div className="p-5">
            {isLoading ? (
              <PageSkeleton variant="cards" />
            ) : filteredAnnouncements.length === 0 ? (
              <div className="py-24 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                  <Megaphone className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="typography-card-title text-slate-700 dark:text-slate-300">No announcements yet</h3>
                  <p className="typography-helper text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchTerm ? "No results match your search." : "Create your first broadcast to notify all parents."}
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
                {filteredAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all"
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
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="typography-card-title text-slate-900 dark:text-white truncate">
                          {announcement.title}
                        </h4>
                        <Badge
                          className={cn(
                            "text-[10px] px-2 py-0 h-5 font-semibold border capitalize",
                            getTypeStyles(announcement.type)
                          )}
                        >
                          {announcement.type === "announcement" ? "Standard" : announcement.type === "info" ? "Info" : "Emergency"}
                        </Badge>
                      </div>
                      <p className="typography-body text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {announcement.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="typography-helper text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(announcement.createdAt), 'MMM dd, yyyy')}
                        </span>
                        <span className="typography-helper text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(announcement.createdAt), 'hh:mm a')}
                        </span>
                      </div>
                    </div>

                    {/* Actions — always visible on desktop, hidden on mobile until hover */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(announcement)}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(announcement.id)}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with last-updated hint */}
          {!isLoading && announcements.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="typography-helper text-slate-400">
                Auto-refreshes every 10 seconds
              </p>
              <p className="typography-helper text-slate-400">
                Last updated: {format(lastUpdated, 'hh:mm a')}
              </p>
            </div>
          )}
        </div>

        {/* ── Create / Edit Dialog ── */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
            <DialogHeader className="bg-primary p-6 md:p-7 text-white relative overflow-hidden shrink-0">
              <div className="absolute -top-4 -right-4 opacity-10">
                <Megaphone className="w-32 h-32 rotate-12" />
              </div>
              <DialogTitle className="text-xl font-bold flex items-center gap-3 relative z-10">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingId ? "Edit Announcement" : "New Announcement"}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 mt-1.5 relative z-10 text-sm">
                {editingId
                  ? "Modify your existing message to update parents with corrected information."
                  : "Broadcast a new message to all parent portals within your school."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAnnouncement} className="p-6 md:p-7 bg-card dark:bg-slate-900 flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 pb-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="typography-label text-slate-700 dark:text-slate-300">
                    Announcement Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. School Resumes Next Week"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-11 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="type" className="typography-label text-slate-700 dark:text-slate-300">
                    Priority Level
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

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="typography-label text-slate-700 dark:text-slate-300">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Write your announcement here…"
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[120px] max-h-[220px] focus:ring-2 focus:ring-primary/20 resize-y overflow-y-auto"
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
                  {isSubmitting ? "Processing…" : editingId ? "Save Changes" : "Publish Announcement"}
                </Button>
              </DialogFooter>
            </form>
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
