"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, Check, CheckCheck, Trash2, X, BellOff,
  Info, AlertTriangle, MessageSquare, Users, GraduationCap,
  Search, Filter, ShieldAlert, Clock, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";
import { formatEthiopianDateDMY, formatEthiopianDateTimeDMY } from "@/lib/utils/date-utils";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserNotification {
  id: string;
  type: string;
  category?: string;
  priority?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: string;
  student?: {
    id: string;
    fullName: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function groupNotificationsByDay(notifications: UserNotification[]): { label: string; items: UserNotification[] }[] {
  const groups: { [key: string]: UserNotification[] } = {};
  for (const n of notifications) {
    const label = getDayLabel(n.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function getNotifIcon(type: string, category?: string) {
  const key = (category || type || "").toUpperCase();
  switch (key) {
    case "MESSAGE":    return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "ATTENDANCE": return <GraduationCap  className="h-4 w-4 text-amber-500" />;
    case "DISCIPLINE": return <AlertTriangle   className="h-4 w-4 text-rose-500" />;
    case "ANNOUNCEMENT": return <Info className="h-4 w-4 text-emerald-500" />;
    case "ALERT":
    case "URGENT":
    case "EMERGENCY":  return <ShieldAlert     className="h-4 w-4 text-red-500" />;
    case "STUDENT":    return <Users           className="h-4 w-4 text-emerald-500" />;
    default:           return <Info            className="h-4 w-4 text-muted-foreground" />;
  }
}

function timeAgo(date: string) {
  try {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

// Build auth headers using the private method pattern already used across the app
function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const user = authService.getCurrentUser();
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") : null;
  const schoolId = user?.schoolId;
  const role = user?.role;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (schoolId) headers["x-school-id"] = schoolId;
  if (role === "parent") headers["x-requested-role"] = "parent";
  else if (role === "teacher") headers["x-requested-role"] = "teacher";
  else if (role === "school_admin") headers["x-requested-role"] = "school_admin";
  else if (role === "super_admin") headers["x-requested-role"] = "super_admin";
  return { ...headers, ...extraHeaders };
}

// ── Parent Notification API (existing) ───────────────────────────────────────

async function fetchParentNotifications(phone: string, schoolId?: string): Promise<UserNotification[]> {
  try {
    const res = await fetch(`${apiUrl}/api/parent/notifications/${encodeURIComponent(phone)}`, {
      headers: getHeaders(schoolId ? { "x-school-id": schoolId } : {}),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data || []) as any[]).map((n: any) => ({
      id: n.id,
      type: n.type || "INFO",
      category: n.category,
      priority: n.priority,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
      student: n.student,
    }));
  } catch {
    return [];
  }
}

async function markParentRead(id: string) {
  await fetch(`${apiUrl}/api/parent/notifications/${id}/read`, { method: "PATCH", headers: getHeaders() });
}

async function deleteParentNotification(id: string) {
  await fetch(`${apiUrl}/api/parent/notifications/${id}`, { method: "DELETE", headers: getHeaders() });
}

async function markAllParentRead(phone: string) {
  await fetch(`${apiUrl}/api/parent/notifications/read-all/${encodeURIComponent(phone)}`, { method: "PATCH", headers: getHeaders() });
}

// ── General User Notification API (new) ──────────────────────────────────────

async function fetchUserNotifications(): Promise<UserNotification[]> {
  try {
    const res = await fetch(`${apiUrl}/api/notifications`, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []) as UserNotification[];
  } catch {
    return [];
  }
}

async function markUserRead(id: string) {
  await fetch(`${apiUrl}/api/notifications/${id}/read`, { method: "PATCH", headers: getHeaders() });
}

async function markAllUserRead() {
  await fetch(`${apiUrl}/api/notifications/read-all`, { method: "PATCH", headers: getHeaders() });
}

async function deleteUserNotification(id: string) {
  await fetch(`${apiUrl}/api/notifications/${id}`, { method: "DELETE", headers: getHeaders() });
}

async function clearAllUserNotifications() {
  await fetch(`${apiUrl}/api/notifications/clear-all`, { method: "DELETE", headers: getHeaders() });
}

// ── NotificationPopover Component ─────────────────────────────────────────────

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedNotif, setSelectedNotif] = useState<UserNotification | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Hydrate user on mount
  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  const isParent = user?.role === "parent";
  const phone = user?.phone;
  const schoolId = user?.schoolId;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data: UserNotification[];
      if (isParent && phone) {
        data = await fetchParentNotifications(phone, schoolId);
      } else {
        data = await fetchUserNotifications();
      }
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [user, isParent, phone, schoolId]);

  // Load on open, poll every 60s when open
  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
  }, [open, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Listen to new_notification socket events
  useEffect(() => {
    const handler = () => loadNotifications();
    window.addEventListener("new_notification", handler);
    return () => window.removeEventListener("new_notification", handler);
  }, [loadNotifications]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    try {
      if (isParent && phone) await markParentRead(id);
      else await markUserRead(id);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (selectedNotif?.id === id) setSelectedNotif(null);
    try {
      if (isParent && phone) await deleteParentNotification(id);
      else await deleteUserNotification(id);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      if (isParent && phone) await markAllParentRead(phone);
      else await markAllUserRead();
    } catch {}
  };

  const handleClearAll = async () => {
    setNotifications([]);
    setOpen(false);
    try {
      if (!isParent) await clearAllUserNotifications();
    } catch {}
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter((n) => {
    const typeKey = (n.type || "").toLowerCase();
    const categoryKey = (n.category || "").toLowerCase();
    const matchesCategory = filterCategory === "all" || typeKey === filterCategory || categoryKey === filterCategory;
    const matchesSearch = !searchTerm || n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const grouped = groupNotificationsByDay(filteredNotifications);

  // Snapshot calculations for parents
  const todayNotes = notifications.filter(n => getDayLabel(n.createdAt) === "Today");
  const absentToday = todayNotes.filter(n => n.type?.toLowerCase() === "absent").length;
  const lateToday = todayNotes.filter(n => n.type?.toLowerCase() === "late").length;
  const warningToday = todayNotes.filter(n => n.type?.toLowerCase() === "warning").length;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <Button
        id="notification-bell-btn"
        variant="ghost"
        size="icon"
        className="relative group"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open notifications"
      >
        <Bell
          className={cn(
            "h-5 w-5 transition-colors",
            open ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleMarkAllRead}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && !isParent && (
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs text-red-500 hover:text-red-600 gap-1"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-2 border-b border-border/40 bg-background space-y-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-muted/40 text-xs rounded-xl pl-8 pr-7 py-1.5 border border-border/40 focus:outline-none focus:border-primary/50"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
              {[
                { key: "all", label: "All" },
                { key: "absent", label: "Absent" },
                { key: "late", label: "Late" },
                { key: "announcement", label: "School" },
                { key: "emergency", label: "Urgent" },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setFilterCategory(cat.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-bold transition-all shrink-0 border",
                    filterCategory === cat.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border/30 hover:bg-muted"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parent Snapshot Panel (if Parent) */}
          {isParent && todayNotes.length > 0 && (
            <div className="px-3 pt-2">
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">Today's Snapshot</span>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  {absentToday > 0 && <span className="text-rose-500">{absentToday} Absent</span>}
                  {lateToday > 0 && <span className="text-amber-500">{lateToday} Late</span>}
                  {absentToday === 0 && lateToday === 0 && <span className="text-emerald-500">All Clear ✨</span>}
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="max-h-80 overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="rounded-full bg-muted p-3">
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No notifications match filters.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 py-1 flex items-center gap-1.5">
                      {label === "Today" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {label}
                    </div>
                    <ul className="divide-y divide-border/20 rounded-xl overflow-hidden border border-border/30">
                      {items.map((notif) => (
                        <li
                          key={notif.id}
                          onClick={() => {
                            if (!notif.isRead) handleMarkRead(notif.id);
                            setSelectedNotif(notif);
                          }}
                          className={cn(
                            "group relative flex items-start gap-3 px-3 py-2.5 transition-colors cursor-pointer hover:bg-muted/60",
                            !notif.isRead ? "bg-primary/5 font-medium" : "bg-background"
                          )}
                        >
                          {/* Icon */}
                          <div className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                            !notif.isRead ? "bg-primary/10 border-primary/20" : "bg-muted border-border/40"
                          )}>
                            {getNotifIcon(notif.type, notif.category)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center justify-between">
                              <p className={cn(
                                "text-xs font-semibold truncate",
                                !notif.isRead ? "text-foreground" : "text-muted-foreground"
                              )}>
                                {notif.title}
                              </p>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground/60">
                              <span>{timeAgo(notif.createdAt)}</span>
                              {notif.student?.fullName && (
                                <span className="font-semibold text-primary/80 truncate max-w-[120px]">
                                  {notif.student.fullName.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unread dot */}
                          {!notif.isRead && (
                            <div className="absolute right-3 top-3 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}

                          {/* Hover delete action */}
                          <button
                            className="absolute right-2 top-2 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notif.id);
                            }}
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-border/40 bg-muted/10 flex items-center justify-between text-xs">
            <span className="text-[10px] text-muted-foreground">
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
            </span>
            {isParent && (
              <Link
                href="/parent/notifications"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Open Full Screen <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Detailed Modal View when an alert is clicked */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setSelectedNotif(null)}
              className="absolute top-3.5 right-3.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                {getNotifIcon(selectedNotif.type, selectedNotif.category)}
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10">
                  {selectedNotif.type}
                </span>
                <h3 className="text-sm font-bold text-foreground mt-0.5">{selectedNotif.title}</h3>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed">
              {selectedNotif.message}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>{formatEthiopianDateTimeDMY(selectedNotif.createdAt)}</span>
              {selectedNotif.student?.fullName && (
                <span className="font-semibold text-primary">
                  {selectedNotif.student.fullName}
                </span>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 text-xs gap-1 h-9 rounded-xl"
                onClick={() => handleDelete(selectedNotif.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-xs h-9 rounded-xl"
                onClick={() => setSelectedNotif(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

