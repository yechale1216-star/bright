"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { cn } from "@/lib/utils/utils"
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  MessageSquare,
  Sun,
  Sunset,
  LayoutGrid,
  Table as TableIcon,
  ShieldAlert,
  Calendar,
  User,
  Sparkles,
  ChevronRight,
  Lock,
} from "lucide-react"

interface AttendanceEditRequestsScreenProps {
  onBack?: () => void
}

export function AttendanceEditRequestsScreen({ onBack }: AttendanceEditRequestsScreenProps) {
  const router = useRouter()

  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
  const [sessionFilter, setSessionFilter] = useState<"all" | "morning" | "afternoon">("all")
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

  // Action Dialog State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  // Detail Modal State
  const [viewDetailRequest, setViewDetailRequest] = useState<any | null>(null)

  const fetchRequests = async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const data = await db.getAttendanceEditRequests().catch(() => [])
      setRequests(data || [])
    } catch (err: any) {
      setError(err.message || "Failed to load attendance edit requests.")
      notifications.error("Error", "Could not fetch edit requests.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRequests()

    const handleDataChanged = () => fetchRequests(true)
    window.addEventListener("attendanceDataChanged", handleDataChanged)
    return () => {
      window.removeEventListener("attendanceDataChanged", handleDataChanged)
    }
  }, [])

  // Derived stats
  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === "PENDING").length
    const approved = requests.filter((r) => r.status === "APPROVED").length
    const rejected = requests.filter((r) => r.status === "REJECTED").length
    const used = requests.filter((r) => r.isUsed).length
    return { total, pending, approved, rejected, used }
  }, [requests])

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== "all" && req.status?.toLowerCase() !== statusFilter) {
        return false
      }

      // Session filter
      if (sessionFilter !== "all") {
        const sess = (req.session || "").toLowerCase()
        if (sess !== sessionFilter) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const teacherName = (req.teacher?.name || "").toLowerCase()
        const teacherEmail = (req.teacher?.email || "").toLowerCase()
        const reason = (req.reason || "").toLowerCase()
        const date = (req.date || "").toLowerCase()
        const adminNoteText = (req.adminNote || "").toLowerCase()

        const matches =
          teacherName.includes(query) ||
          teacherEmail.includes(query) ||
          reason.includes(query) ||
          date.includes(query) ||
          adminNoteText.includes(query)

        if (!matches) return false
      }

      return true
    })
  }, [requests, statusFilter, sessionFilter, searchQuery])

  // Handle Approve / Reject
  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return

    setIsSubmittingAction(true)
    try {
      if (actionType === "approve") {
        await db.approveAttendanceEditRequest(selectedRequest.id, adminNote.trim() || undefined)
        notifications.success(
          "Request Approved",
          `Attendance edit permission granted to ${selectedRequest.teacher?.name || "the teacher"}.`
        )
      } else {
        await db.rejectAttendanceEditRequest(selectedRequest.id, adminNote.trim() || undefined)
        notifications.success(
          "Request Rejected",
          `Attendance edit request declined.`
        )
      }

      setSelectedRequest(null)
      setActionType(null)
      setAdminNote("")
      await fetchRequests(true)
    } catch (err: any) {
      notifications.error(
        actionType === "approve" ? "Approval Failed" : "Rejection Failed",
        err.message || "Action could not be completed."
      )
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.push("/school/admin")
    }
  }

  const quickNotesApprove = [
    "Approved. Please update within 24 hours.",
    "Approved for morning session record correction.",
    "Approved per department head verification.",
  ]

  const quickNotesReject = [
    "Attendance for this date is permanently locked and audited.",
    "Please provide more specific details or consult administration.",
    "Duplicate request.",
  ]

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Button>
            <span className="text-xs text-muted-foreground/60">/</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Attendance Management
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Attendance Edit Requests
                </h1>
                {stats.pending > 0 && (
                  <Badge className="bg-amber-500 text-white font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
                    {stats.pending} Pending
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review, approve, or reject attendance unlock requests submitted by teaching staff.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRequests(true)}
            disabled={isLoading || isRefreshing}
            className="h-9 px-3.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div
          onClick={() => setStatusFilter("all")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs select-none",
            statusFilter === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent ring-2 ring-primary/40 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Total Requests
            </span>
            <FileCheck className="w-4 h-4 opacity-50" />
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
            {stats.total}
          </div>
          <p className="text-[10px] opacity-70 mt-1">All teacher submissions</p>
        </div>

        {/* Pending */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs select-none",
            statusFilter === "pending"
              ? "bg-amber-500 text-white border-transparent ring-2 ring-amber-400 shadow-sm"
              : "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                statusFilter === "pending" ? "text-white" : "text-amber-600 dark:text-amber-400"
              )}
            >
              Pending Review
            </span>
            <Clock
              className={cn(
                "w-4 h-4",
                statusFilter === "pending" ? "text-white" : "text-amber-500"
              )}
            />
          </div>
          <div
            className={cn(
              "text-2xl sm:text-3xl font-black mt-2 tracking-tight",
              statusFilter === "pending" ? "text-white" : "text-amber-600 dark:text-amber-400"
            )}
          >
            {stats.pending}
          </div>
          <p
            className={cn(
              "text-[10px] mt-1 font-medium",
              statusFilter === "pending" ? "text-white/80" : "text-amber-700/80 dark:text-amber-400/80"
            )}
          >
            Requires administrator action
          </p>
        </div>

        {/* Approved */}
        <div
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs select-none",
            statusFilter === "approved"
              ? "bg-emerald-600 text-white border-transparent ring-2 ring-emerald-400 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                statusFilter === "approved" ? "text-white" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              Approved
            </span>
            <CheckCircle2
              className={cn(
                "w-4 h-4",
                statusFilter === "approved" ? "text-white" : "text-emerald-500"
              )}
            />
          </div>
          <div
            className={cn(
              "text-2xl sm:text-3xl font-black mt-2 tracking-tight",
              statusFilter === "approved" ? "text-white" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {stats.approved}
          </div>
          <p
            className={cn(
              "text-[10px] mt-1 font-medium",
              statusFilter === "approved" ? "text-white/80" : "text-muted-foreground"
            )}
          >
            Unlocked for editing
          </p>
        </div>

        {/* Rejected */}
        <div
          onClick={() => setStatusFilter("rejected")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs select-none",
            statusFilter === "rejected"
              ? "bg-rose-600 text-white border-transparent ring-2 ring-rose-400 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-rose-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                statusFilter === "rejected" ? "text-white" : "text-rose-600 dark:text-rose-400"
              )}
            >
              Rejected
            </span>
            <XCircle
              className={cn(
                "w-4 h-4",
                statusFilter === "rejected" ? "text-white" : "text-rose-500"
              )}
            />
          </div>
          <div
            className={cn(
              "text-2xl sm:text-3xl font-black mt-2 tracking-tight",
              statusFilter === "rejected" ? "text-white" : "text-rose-600 dark:text-rose-400"
            )}
          >
            {stats.rejected}
          </div>
          <p
            className={cn(
              "text-[10px] mt-1 font-medium",
              statusFilter === "rejected" ? "text-white/80" : "text-muted-foreground"
            )}
          >
            Declined requests
          </p>
        </div>
      </div>

      {/* 3. SEARCH & CONTROLS TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by teacher name, date, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-lg capitalize",
                  statusFilter === filter ? "shadow-2xs" : "text-muted-foreground"
                )}
              >
                {filter === "all" ? "All" : filter}
              </Button>
            ))}
          </div>

          {/* Session Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <Button
              variant={sessionFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSessionFilter("all")}
              className={cn(
                "h-7 px-2 text-[11px] font-bold rounded-lg",
                sessionFilter === "all" ? "shadow-2xs" : "text-muted-foreground"
              )}
            >
              All Sessions
            </Button>
            <Button
              variant={sessionFilter === "morning" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSessionFilter("morning")}
              className={cn(
                "h-7 px-2 text-[11px] font-bold rounded-lg gap-1",
                sessionFilter === "morning" ? "shadow-2xs" : "text-muted-foreground"
              )}
            >
              <Sun className="w-3 h-3 text-amber-500" />
              <span>Morning</span>
            </Button>
            <Button
              variant={sessionFilter === "afternoon" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSessionFilter("afternoon")}
              className={cn(
                "h-7 px-2 text-[11px] font-bold rounded-lg gap-1",
                sessionFilter === "afternoon" ? "shadow-2xs" : "text-muted-foreground"
              )}
            >
              <Sunset className="w-3 h-3 text-orange-500" />
              <span>Afternoon</span>
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="h-7 w-7 p-0 rounded-lg"
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-7 w-7 p-0 rounded-lg"
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 4. CONTENT AREA */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 animate-pulse shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-1.5 w-full">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded w-1/3" />
                </div>
              </div>
              <div className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-muted-foreground/40">
            <FileCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">No Edit Requests Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {searchQuery
                ? `No requests match "${searchQuery}". Try clearing search or changing filters.`
                : statusFilter === "pending"
                ? "All teacher attendance submissions are locked and in sync. No pending requests."
                : "No attendance unlock records match the selected criteria."}
            </p>
          </div>
          {(searchQuery || statusFilter !== "all" || sessionFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("all")
                setSessionFilter("all")
              }}
              className="h-8 px-4 rounded-xl text-xs font-bold"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => {
            const teacherName = req.teacher?.name || "Teacher"
            const teacherInitial = teacherName.slice(0, 1).toUpperCase()
            const isPending = req.status === "PENDING"
            const isApproved = req.status === "APPROVED"
            const isRejected = req.status === "REJECTED"
            const reqDate = req.date ? req.date.split("T")[0] : "N/A"
            const createdDateFormatted = req.createdAt
              ? new Date(req.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Recently"

            return (
              <Card
                key={req.id}
                className={cn(
                  "border rounded-2xl overflow-hidden shadow-2xs transition-all hover:shadow-md flex flex-col justify-between group",
                  isPending
                    ? "border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900"
                    : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"
                )}
              >
                <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header: Teacher + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shrink-0 text-sm shadow-2xs">
                          {teacherInitial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground tracking-tight truncate">
                            {teacherName}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60" />
                            <span>{createdDateFormatted}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                            isPending && "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
                            isApproved && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
                            isRejected && "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700"
                          )}
                        >
                          {req.status}
                        </Badge>
                        {req.isUsed && (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold"
                          >
                            Used
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Target Date & Session info banner */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 opacity-60" /> Target Date:
                        </span>
                        <span className="font-bold text-foreground font-mono">{reqDate}</span>
                      </div>

                      {req.session && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px] font-medium">Session:</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold capitalize bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center gap-1"
                          >
                            {req.session.toLowerCase() === "morning" ? (
                              <Sun className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Sunset className="w-3 h-3 text-orange-500" />
                            )}
                            <span>{req.session}</span>
                          </Badge>
                        </div>
                      )}

                      {/* Reason */}
                      {req.reason && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                            Teacher Reason:
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-200 italic line-clamp-3 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/60">
                            "{req.reason}"
                          </p>
                        </div>
                      )}

                      {/* Admin Note if already handled */}
                      {req.adminNote && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Admin Note:
                          </span>
                          <p className="text-xs text-muted-foreground p-1.5 rounded-lg bg-primary/5 border border-primary/10">
                            {req.adminNote}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for Pending Requests */}
                  {isPending ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(req)
                          setActionType("approve")
                          setAdminNote("")
                        }}
                        className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(req)
                          setActionType("reject")
                          setAdminNote("")
                        }}
                        className="flex-1 h-9 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-xl"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-slate-100 dark:border-slate-800">
                      <span>Status: <strong className="capitalize">{req.status.toLowerCase()}</strong></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewDetailRequest(req)}
                        className="h-7 px-2 text-xs font-bold text-primary hover:text-primary"
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* STRUCTURED TABLE VIEW WITH STICKY HEADER */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[700px] relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Teacher</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Session</th>
                  <th className="py-3 px-4 min-w-[200px]">Reason</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 min-w-[150px]">Admin Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredRequests.map((req) => {
                  const teacherName = req.teacher?.name || "Teacher"
                  const isPending = req.status === "PENDING"
                  const isApproved = req.status === "APPROVED"
                  const isRejected = req.status === "REJECTED"
                  const reqDate = req.date ? req.date.split("T")[0] : "N/A"

                  return (
                    <tr
                      key={req.id}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        isPending && "bg-amber-500/[0.02]"
                      )}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-black flex items-center justify-center text-xs shrink-0">
                            {teacherName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-foreground truncate max-w-[130px]">
                            {teacherName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {reqDate}
                      </td>
                      <td className="py-3 px-4">
                        {req.session ? (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {req.session}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        <span className="line-clamp-2 italic">
                          {req.reason ? `"${req.reason}"` : "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-[11px]">
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5",
                              isPending && "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
                              isApproved && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
                              isRejected && "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700"
                            )}
                          >
                            {req.status}
                          </Badge>
                          {req.isUsed && (
                            <Badge variant="outline" className="text-[9px] font-bold">
                              Used
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {req.adminNote || "—"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(req)
                                setActionType("approve")
                                setAdminNote("")
                              }}
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(req)
                                setActionType("reject")
                                setAdminNote("")
                              }}
                              className="h-7 px-2.5 border-rose-200 dark:border-rose-900 text-rose-600 text-[11px] font-bold rounded-lg"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewDetailRequest(req)}
                            className="h-7 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                          >
                            Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. APPROVE / REJECT ACTION DIALOG */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) {
            setSelectedRequest(null)
            setActionType(null)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {actionType === "approve" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Approve Attendance Edit Request</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Reject Attendance Edit Request</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {actionType === "approve"
                ? `Grant permission to ${selectedRequest?.teacher?.name || "Teacher"} to edit the submitted attendance for ${selectedRequest?.date ? selectedRequest.date.split("T")[0] : "selected date"}.`
                : `Decline the edit request submitted by ${selectedRequest?.teacher?.name || "Teacher"}.`}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2 text-xs">
              {/* Request Info Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teacher:</span>
                  <span className="font-bold text-foreground">
                    {selectedRequest.teacher?.name || "Teacher"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Date:</span>
                  <span className="font-bold text-foreground font-mono">
                    {selectedRequest.date ? selectedRequest.date.split("T")[0] : "N/A"}
                  </span>
                </div>
                {selectedRequest.session && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session:</span>
                    <span className="font-bold text-foreground capitalize">
                      {selectedRequest.session}
                    </span>
                  </div>
                )}
                {selectedRequest.reason && (
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Teacher's Reason:
                    </span>
                    <p className="italic text-slate-700 dark:text-slate-300">
                      "{selectedRequest.reason}"
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Admin Note <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Textarea
                  placeholder={
                    actionType === "approve"
                      ? "e.g., Approved for 24 hours to correct 3 absent records..."
                      : "e.g., Attendance has been finalized and audited..."
                  }
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="h-20 text-xs rounded-xl resize-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Quick Note Presets:
                </span>
                <div className="flex flex-wrap gap-1">
                  {(actionType === "approve" ? quickNotesApprove : quickNotesReject).map(
                    (preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAdminNote(preset)}
                        className="text-[10px] p-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {preset}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmittingAction}
              onClick={() => {
                setSelectedRequest(null)
                setActionType(null)
              }}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingAction}
              onClick={handleConfirmAction}
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-bold text-white shadow-sm",
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {isSubmittingAction ? (
                <Spinner size="sm" className="text-white" />
              ) : actionType === "approve" ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Approval
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. VIEW DETAILS DIALOG */}
      <Dialog
        open={!!viewDetailRequest}
        onOpenChange={(open) => !open && setViewDetailRequest(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileCheck className="w-5 h-5 text-primary" />
              <span>Edit Request Details</span>
            </DialogTitle>
          </DialogHeader>

          {viewDetailRequest && (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-muted-foreground">Current Status:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5",
                    viewDetailRequest.status === "PENDING" && "bg-amber-50 text-amber-700 border-amber-300",
                    viewDetailRequest.status === "APPROVED" && "bg-emerald-50 text-emerald-700 border-emerald-300",
                    viewDetailRequest.status === "REJECTED" && "bg-rose-50 text-rose-700 border-rose-300"
                  )}
                >
                  {viewDetailRequest.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teacher:</span>
                  <span className="font-bold text-foreground">
                    {viewDetailRequest.teacher?.name || "Teacher"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teacher Email:</span>
                  <span className="font-mono text-foreground">
                    {viewDetailRequest.teacher?.email || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Date:</span>
                  <span className="font-bold text-foreground font-mono">
                    {viewDetailRequest.date ? viewDetailRequest.date.split("T")[0] : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-bold text-foreground capitalize">
                    {viewDetailRequest.session || "Daily / None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted At:</span>
                  <span className="text-foreground">
                    {viewDetailRequest.createdAt
                      ? new Date(viewDetailRequest.createdAt).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permission Used:</span>
                  <span className="font-bold text-foreground">
                    {viewDetailRequest.isUsed ? "Yes (Already edited)" : "No"}
                  </span>
                </div>
              </div>

              {viewDetailRequest.reason && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Teacher Reason:
                  </span>
                  <p className="text-xs text-foreground italic">
                    "{viewDetailRequest.reason}"
                  </p>
                </div>
              )}

              {viewDetailRequest.adminNote && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-1">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                    Admin Note / Instructions:
                  </span>
                  <p className="text-xs text-foreground">
                    {viewDetailRequest.adminNote}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewDetailRequest(null)}
              className="w-full h-9 rounded-xl text-xs font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
