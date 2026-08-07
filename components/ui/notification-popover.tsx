"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, CheckCheck, Trash2, BellOff, Clock, XCircle,
  AlertTriangle, Info, X, Search, RefreshCw, GraduationCap,
  ShieldAlert, CheckCircle2, ChevronRight, Sparkles, Filter, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { parentDb, type ParentNotification } from "@/lib/db/parent-db";
import { useLanguage } from "@/lib/context/language-context";
import { formatEthiopianDateDMY, formatEthiopianDateTimeDMY } from "@/lib/utils/date-utils";
import { apiUrl } from "@/lib/api-config";
import Link from "next/link";

// ── Date grouping helper ──────────────────────────────────────────────────────
function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatEthiopianDateDMY(date);
}

function groupNotificationsByDay(
  notifications: ParentNotification[]
): { label: string; items: ParentNotification[] }[] {
  const groups: { [key: string]: ParentNotification[] } = {};
  for (const n of notifications) {
    const label = getDayLabel(n.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

// ── Type configurations ───────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  pillBg: string;
  pillText: string;
  accentColor: string;
  label: string;
}> = {
  absent: {
    icon: <XCircle className="w-4 h-4 text-rose-400" />,
    iconBg: "bg-rose-500/15",
    iconBorder: "border-rose-500/25",
    pillBg: "bg-rose-500/15",
    pillText: "text-rose-400",
    accentColor: "bg-rose-500",
    label: "ABSENT",
  },
  late: {
    icon: <Clock className="w-4 h-4 text-amber-400" />,
    iconBg: "bg-amber-500/15",
    iconBorder: "border-amber-500/25",
    pillBg: "bg-amber-500/15",
    pillText: "text-amber-400",
    accentColor: "bg-amber-500",
    label: "LATE",
  },
  emergency: {
    icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
    iconBg: "bg-red-500/15",
    iconBorder: "border-red-500/25",
    pillBg: "bg-red-500/15",
    pillText: "text-red-400",
    accentColor: "bg-red-500",
    label: "URGENT",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    iconBg: "bg-orange-500/15",
    iconBorder: "border-orange-500/25",
    pillBg: "bg-orange-500/15",
    pillText: "text-orange-400",
    accentColor: "bg-orange-500",
    label: "WARNING",
  },
  info: {
    icon: <Info className="w-4 h-4 text-sky-400" />,
    iconBg: "bg-sky-500/15",
    iconBorder: "border-sky-500/25",
    pillBg: "bg-sky-500/15",
    pillText: "text-sky-400",
    accentColor: "bg-sky-500",
    label: "INFO",
  },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type?.toLowerCase()] ?? {
    icon: <Bell className="w-4 h-4 text-slate-400" />,
    iconBg: "bg-slate-700/40",
    iconBorder: "border-slate-700/40",
    pillBg: "bg-slate-700/30",
    pillText: "text-slate-400",
    accentColor: "bg-slate-500",
    label: (type || "INFO").toUpperCase(),
  };
}

// ── Today Snapshot Widget ────────────────────────────────────────────────────
function TodaySnapshotWidget({ notifications }: { notifications: ParentNotification[] }) {
  const todayNotes = notifications.filter(n => getDayLabel(n.createdAt) === "Today");
  const absent = todayNotes.filter(n => n.type === "absent").length;
  const late = todayNotes.filter(n => n.type === "late").length;
  const warning = todayNotes.filter(n => n.type === "warning").length;
  const allGood = absent === 0 && late === 0 && warning === 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 via-[#0a1224] to-slate-800/90 p-3.5 shadow-md">
      <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-25 pointer-events-none ${allGood ? "bg-emerald-400" : "bg-rose-500"}`} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${allGood ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
            {allGood ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <GraduationCap className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Snapshot</p>
            <p className="text-[9px] text-slate-500 font-medium">{formatEthiopianDateDMY(new Date())}</p>
          </div>
        </div>

        {allGood ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400">All Clear</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {absent > 0 && (
              <div className="text-center px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/25">
                <p className="text-sm font-black text-rose-400 leading-none">{absent}</p>
                <p className="text-[8px] font-bold text-rose-400 uppercase tracking-wide mt-0.5">Absent</p>
              </div>
            )}
            {late > 0 && (
              <div className="text-center px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25">
                <p className="text-sm font-black text-amber-400 leading-none">{late}</p>
                <p className="text-[8px] font-bold text-amber-400 uppercase tracking-wide mt-0.5">Late</p>
              </div>
            )}
            {warning > 0 && (
              <div className="text-center px-2 py-1 rounded-lg bg-orange-500/15 border border-orange-500/25">
                <p className="text-sm font-black text-orange-400 leading-none">{warning}</p>
                <p className="text-[8px] font-bold text-orange-400 uppercase tracking-wide mt-0.5">Warn</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NotificationPopover Component ─────────────────────────────────────────────

export function NotificationPopover() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "absent" | "late" | "emergency" | "warning">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<ParentNotification | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Hydrate user on mount
  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  const isParent = user?.role === "parent";
  const phone = user?.phone || user?.phoneNumber;
  const schoolId = user?.schoolId;

  // ── Fetch Notifications ────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isParent && phone) {
        const list = await parentDb.getNotifications(phone, schoolId);
        setNotifications(list);
      } else {
        // Fallback user notifications API
        const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
        const res = await fetch(`${apiUrl}/api/notifications`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(schoolId ? { "x-school-id": schoolId } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          const mapped: ParentNotification[] = (data.data || []).map((n: any) => ({
            id: n.id,
            schoolId: n.schoolId || schoolId || "",
            studentId: n.studentId || null,
            type: (n.type || n.category || "info").toLowerCase(),
            title: n.title,
            message: n.message,
            isRead: n.isRead,
            createdAt: n.createdAt,
            student: n.student,
          }));
          setNotifications(mapped);
        }
      }
    } catch (e) {
      console.error("[NotificationPopover] Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, isParent, phone, schoolId]);

  // Initial load
  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  // Refresh every 45 seconds when popover is open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(loadNotifications, 45_000);
    return () => clearInterval(interval);
  }, [open, loadNotifications]);

  // Listen to outside click to close popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Socket & refresh event listeners
  useEffect(() => {
    const handler = () => loadNotifications();
    window.addEventListener("new_notification", handler);
    window.addEventListener("refreshNotifications", handler);
    return () => {
      window.removeEventListener("new_notification", handler);
      window.removeEventListener("refreshNotifications", handler);
    };
  }, [loadNotifications]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      if (isParent && phone) {
        await parentDb.markNotificationAsRead(id, schoolId);
      } else {
        const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
        await fetch(`${apiUrl}/api/notifications/${id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      window.dispatchEvent(new Event("refreshNotifications"));
    } catch (e) {
      console.error("[NotificationPopover] Mark read error:", e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (selectedNotif?.id === id) setSelectedNotif(null);
    try {
      if (isParent) {
        await parentDb.deleteNotification(id, schoolId);
      } else {
        const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
        await fetch(`${apiUrl}/api/notifications/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      window.dispatchEvent(new Event("refreshNotifications"));
    } catch (e) {
      console.error("[NotificationPopover] Delete error:", e);
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      if (isParent && phone) {
        await parentDb.markAllNotificationsAsRead(phone, schoolId);
      } else {
        const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
        await fetch(`${apiUrl}/api/notifications/read-all`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      window.dispatchEvent(new Event("refreshNotifications"));
    } catch (e) {
      console.error("[NotificationPopover] Mark all read error:", e);
    }
  };

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  // ── Localization ────────────────────────────────────────────────────────────
  const localizeNotification = (n: ParentNotification): { title: string; message: string } => {
    const studentName = n.student?.fullName?.split(" ")[0] || "";
    const isFemale = n.student?.gender?.toLowerCase() === "female";
    const suffix = isFemale ? "_f" : "";
    const formattedDate = formatEthiopianDateDMY(n.createdAt);
    const vars = {
      name: studentName,
      StudentName: studentName,
      "Parent Name": "ወላጅ",
      parentName: "ወላጅ",
      date: formattedDate,
      Date: formattedDate,
    };
    switch (n.type as string) {
      case "absent":  return { title: t(("alert_absent_title"  + suffix) as any, vars), message: t(("alert_absent_msg"  + suffix) as any, vars) };
      case "late":    return { title: t(("alert_late_title"    + suffix) as any, vars), message: t(("alert_late_msg"    + suffix) as any, vars) };
      case "excused": return { title: t(("alert_excused_title" + suffix) as any, vars), message: t(("alert_excused_msg" + suffix) as any, vars) };
      case "warning": return { title: t(("alert_warning_title" + suffix) as any, vars), message: t(("alert_warning_msg" + suffix) as any, vars) };
      default:        return { title: n.title, message: n.message };
    }
  };

  // ── Derived Data ────────────────────────────────────────────────────────────
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const totalCount = notifications.length;

  const filtered = notifications.filter(n => {
    const matchesType = filterType === "all" || n.type === filterType;
    const matchesUnread = !showUnreadOnly || !n.isRead;
    const { title, message } = localizeNotification(n);
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || title.toLowerCase().includes(q) || message.toLowerCase().includes(q);
    return matchesType && matchesUnread && matchesSearch;
  });

  const grouped = groupNotificationsByDay(filtered);

  const filterOptions: { key: typeof filterType; label: string; emoji: string }[] = [
    { key: "all",       label: "All",     emoji: "🔔" },
    { key: "absent",    label: "Absent",  emoji: "❌" },
    { key: "late",      label: "Late",    emoji: "⏰" },
    { key: "emergency", label: "Urgent",  emoji: "🚨" },
    { key: "warning",   label: "Warning", emoji: "⚠️" },
  ];

  const filterActiveClass: Record<string, string> = {
    all:       "bg-white/10 text-white border-white/20",
    absent:    "bg-rose-500/20 text-rose-300 border-rose-500/30",
    late:      "bg-amber-500/20 text-amber-300 border-amber-500/30",
    emergency: "bg-red-500/20 text-red-300 border-red-500/30",
    warning:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Bell Trigger Button ───────────────────────────────────────────── */}
      <Button
        id="notification-bell-btn"
        variant="ghost"
        size="icon"
        className="relative group h-9 w-9 rounded-full"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle notifications"
      >
        <Bell className={cn(
          "h-5 w-5 transition-colors",
          open ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )} />

        {/* Animated pulsing red ping when unread */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        )}

        {/* Numeric Badge pill */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* ── Popover Floating Dropdown Window ─────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 w-[92vw] sm:w-[440px] max-h-[82vh] flex flex-col rounded-3xl",
            "bg-[#060c18] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl text-slate-100",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
        >
          {/* Popover Header */}
          <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.08] bg-[#070e1c]/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight leading-none">Notifications</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {unreadCount > 0 ? (
                    <span className="text-violet-400 font-semibold">{unreadCount} unread · {totalCount} total</span>
                  ) : (
                    <span className="text-slate-500">All caught up</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-400 hover:bg-violet-500/20 active:scale-95 transition-all"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
                title="Refresh notifications"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", isRefreshing && "animate-spin")} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-slate-400 hover:text-white"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search Bar & Unread Toggle */}
          <div className="p-3 border-b border-white/[0.06] bg-[#060c18] space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/40 transition-colors"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all active:scale-95",
                  showUnreadOnly
                    ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                    : "bg-white/[0.04] text-slate-400 border-white/8"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showUnreadOnly ? "bg-violet-400 animate-pulse" : "bg-slate-500")} />
                Unread ({unreadCount})
              </button>
            </div>

            {/* Category Filter Chips */}
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {filterOptions.map(opt => {
                  const count = opt.key === "all"
                    ? totalCount
                    : notifications.filter(n => n.type === opt.key).length;
                  if (opt.key !== "all" && count === 0) return null;
                  const isActive = filterType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setFilterType(opt.key)}
                      className={cn(
                        "shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95",
                        isActive ? filterActiveClass[opt.key] : "text-slate-400 border-white/[0.06] bg-white/[0.03] hover:text-slate-200"
                      )}
                    >
                      <span className="text-[9px]">{opt.emoji}</span>
                      {opt.label}
                      <span className={cn("text-[9px] font-black px-1.5 py-0.2 rounded-full", isActive ? "bg-white/20" : "bg-white/8")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Popover Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[55vh] no-scrollbar">
            {/* Today's Snapshot widget */}
            {notifications.some(n => getDayLabel(n.createdAt) === "Today") && (
              <TodaySnapshotWidget notifications={notifications} />
            )}

            {/* Loading state */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : filtered.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center">
                  <BellOff className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {searchTerm || filterType !== "all" || showUnreadOnly
                      ? "No notifications match your search/filters."
                      : "No notifications yet."}
                  </p>
                </div>
                {(searchTerm || filterType !== "all" || showUnreadOnly) && (
                  <button
                    onClick={() => { setSearchTerm(""); setFilterType("all"); setShowUnreadOnly(false); }}
                    className="text-xs font-bold text-violet-400 underline underline-offset-2"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              /* Grouped Notifications List */
              <div className="space-y-4">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    {/* Day divider */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                        {label === "Today" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        )}
                        {label}
                        <span className="text-slate-500">· {items.length}</span>
                      </span>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                    </div>

                    {/* Notification cards */}
                    <div className="space-y-2">
                      {items.map((notification) => {
                        const cfg = getTypeConfig(notification.type);
                        const { title, message } = localizeNotification(notification);
                        const isUnread = !notification.isRead;

                        return (
                          <div
                            key={notification.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (!notification.isRead) handleMarkRead(notification.id);
                              setSelectedNotif(notification);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!notification.isRead) handleMarkRead(notification.id);
                                setSelectedNotif(notification);
                              }
                            }}
                            className={cn(
                              "group w-full text-left relative overflow-hidden rounded-2xl border transition-all duration-200 active:scale-[0.985] cursor-pointer",
                              isUnread
                                ? "bg-white/[0.05] border-white/10 shadow-md hover:bg-white/[0.08]"
                                : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                            )}
                          >
                            {/* Left accent bar */}
                            {isUnread && (
                              <div className={cn("absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full opacity-90", cfg.accentColor)} />
                            )}

                            <div className="flex items-start gap-2.5 p-3 pl-3.5">
                              {/* Icon */}
                              <div className={cn("shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border mt-0.5", cfg.iconBg, cfg.iconBorder, cfg.pillText)}>
                                {cfg.icon}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md", cfg.pillBg, cfg.pillText)}>
                                      {cfg.label}
                                    </span>
                                    {notification.student?.fullName && (
                                      <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-0.5">
                                        <GraduationCap className="w-2.5 h-2.5 text-slate-400" />
                                        {notification.student.fullName.split(" ")[0]}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDelete(e, notification.id)}
                                    className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete notification"
                                  >
                                    <Trash2 className="w-3 w-3" />
                                  </button>
                                </div>

                                <p className={cn("text-xs font-semibold leading-snug truncate", isUnread ? "text-white" : "text-slate-300")}>
                                  {title}
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mt-0.5">
                                  {message}
                                </p>

                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatEthiopianDateTimeDMY(notification.createdAt)}
                                  </span>
                                  {!isUnread ? (
                                    <span className="text-[8px] font-bold text-slate-400 flex items-center gap-0.5 uppercase tracking-wider">
                                      <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />Read
                                    </span>
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popover Footer */}
          <div className="px-3 py-2.5 border-t border-white/[0.08] bg-[#070e1c] flex items-center justify-between text-xs shrink-0">
            <span className="text-[10px] font-medium text-slate-400">
              {filtered.length} notification{filtered.length !== 1 ? "s" : ""}
            </span>
            {isParent && (
              <Link
                href="/parent/notifications"
                onClick={() => setOpen(false)}
                className="text-[10px] font-bold text-violet-400 hover:underline flex items-center gap-1"
              >
                Full Screen Page <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Inspection Modal Overlay ─────────────────────────────── */}
      {selectedNotif && (() => {
        const cfg = getTypeConfig(selectedNotif.type);
        const { title, message } = localizeNotification(selectedNotif);

        return (
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0d1527] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden text-slate-100">
              <div className={cn("h-1 w-full opacity-70", cfg.accentColor)} />

              <div className="p-5 space-y-4">
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 pr-8">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", cfg.iconBg, cfg.iconBorder, cfg.pillText)}>
                    {cfg.icon}
                  </div>
                  <div>
                    <span className={cn("inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1", cfg.pillBg, cfg.pillText)}>
                      {cfg.label}
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">{title}</h3>
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed">
                  {message}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatEthiopianDateTimeDMY(selectedNotif.createdAt)}
                  </span>
                  {selectedNotif.student?.fullName && (
                    <span className="flex items-center gap-1 font-semibold text-violet-400">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {selectedNotif.student.fullName}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={(e) => handleDelete(e, selectedNotif.id)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-bold text-white active:scale-[0.97] transition-transform"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
