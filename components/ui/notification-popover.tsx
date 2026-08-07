"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, Check, CheckCheck, Trash2, X, BellOff,
  Info, AlertTriangle, MessageSquare, Users, GraduationCap,
  ShieldAlert, ExternalLink, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";
import { useRouter } from "next/navigation";
import { formatEthiopianDateDMY } from "@/lib/utils/date-utils";

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

// ── Shared auth headers helper ────────────────────────────────────────────────

export function getNotifHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const user = authService.getCurrentUser();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token")
      : null;
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

function getCategoryIcon(type: string, category?: string) {
  const key = (category || type || "").toUpperCase();
  switch (key) {
    case "MESSAGE":     return <MessageSquare className="h-3.5 w-3.5 text-blue-400" />;
    case "ATTENDANCE":
    case "ABSENT":      return <GraduationCap  className="h-3.5 w-3.5 text-rose-400" />;
    case "LATE":        return <Clock          className="h-3.5 w-3.5 text-amber-400" />;
    case "DISCIPLINE":
    case "WARNING":     return <AlertTriangle   className="h-3.5 w-3.5 text-orange-400" />;
    case "ANNOUNCEMENT": return <Info          className="h-3.5 w-3.5 text-emerald-400" />;
    case "EMERGENCY":
    case "URGENT":      return <ShieldAlert     className="h-3.5 w-3.5 text-red-500" />;
    default:            return <Bell           className="h-3.5 w-3.5 text-violet-400" />;
  }
}

// ── API Fetchers ──────────────────────────────────────────────────────────────

async function fetchNotifications(isParent: boolean, phone?: string, schoolId?: string): Promise<UserNotification[]> {
  try {
    const url = isParent && phone
      ? `${apiUrl}/api/parent/notifications/${encodeURIComponent(phone)}`
      : `${apiUrl}/api/notifications`;
    const res = await fetch(url, { headers: getNotifHeaders(schoolId ? { "x-school-id": schoolId } : {}) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []) as UserNotification[];
  } catch {
    return [];
  }
}

async function markNotificationRead(id: string, isParent: boolean) {
  const url = isParent
    ? `${apiUrl}/api/parent/notifications/${id}/read`
    : `${apiUrl}/api/notifications/${id}/read`;
  await fetch(url, { method: "PATCH", headers: getNotifHeaders() });
}

async function markAllNotificationsRead(isParent: boolean, phone?: string) {
  const url = isParent && phone
    ? `${apiUrl}/api/parent/notifications/read-all/${encodeURIComponent(phone)}`
    : `${apiUrl}/api/notifications/read-all`;
  await fetch(url, { method: "PATCH", headers: getNotifHeaders() });
}

// ── NotificationPopover Component ─────────────────────────────────────────────

export function NotificationPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  const isParent = user?.role === "parent";
  const phone = user?.phone || user?.phoneNumber;
  const schoolId = user?.schoolId;

  const loadNotifs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(isParent, phone, schoolId);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [user, isParent, phone, schoolId]);

  useEffect(() => {
    if (!user) return;
    loadNotifs();
  }, [user, loadNotifs]);

  // Poll every 60s
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(loadNotifs, 60_000);
    return () => clearInterval(interval);
  }, [open, loadNotifs]);

  // Listen for socket events
  useEffect(() => {
    const handler = () => loadNotifs();
    window.addEventListener("new_notification", handler);
    window.addEventListener("refreshNotifications", handler);
    return () => {
      window.removeEventListener("new_notification", handler);
      window.removeEventListener("refreshNotifications", handler);
    };
  }, [loadNotifs]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recentNotifications = notifications.slice(0, 6);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationRead(id, isParent);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead(isParent, phone);
    } catch {}
  };

  const handleViewAll = () => {
    setOpen(false);
    if (isParent) {
      router.push("/parent/notifications");
    } else {
      router.push("/notifications");
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <Button
        id="notification-bell-btn"
        variant="ghost"
        size="icon"
        className="relative group hover:bg-white/5 active:scale-95 transition-all"
        onClick={() => setOpen((o) => !o)}
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />

        {/* Animated unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        )}

        {/* Numeric count label for counts > 9 */}
        {unreadCount > 9 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full",
              "bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Popover Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#0a1224] shadow-2xl overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 text-[10px] font-bold px-2 py-0.5">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1 rounded-lg"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* List Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="rounded-full bg-white/[0.04] p-3 border border-white/8">
                  <BellOff className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-xs font-semibold text-slate-400">All caught up!</p>
                <p className="text-[11px] text-slate-600">No new alerts right now.</p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const isUnread = !notif.isRead;
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (isUnread) handleMarkRead(notif.id);
                      handleViewAll();
                    }}
                    className={cn(
                      "group relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-white/[0.04]",
                      isUnread ? "bg-violet-500/[0.06]" : "bg-transparent"
                    )}
                  >
                    {/* Left unread bar indicator */}
                    {isUnread && (
                      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-violet-500" />
                    )}

                    {/* Category Icon */}
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                        isUnread
                          ? "bg-violet-500/15 border-violet-500/30"
                          : "bg-white/[0.04] border-white/8"
                      )}
                    >
                      {getCategoryIcon(notif.type, notif.category)}
                    </div>

                    {/* Content preview */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={cn(
                            "text-xs font-bold truncate",
                            isUnread ? "text-white" : "text-slate-400"
                          )}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>

                      {notif.student?.fullName && (
                        <p className="text-[10px] font-semibold text-violet-400 mt-1 flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {notif.student.fullName.split(" ")[0]}
                        </p>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-400 rounded-md transition-all"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All link */}
          <div className="p-2 border-t border-white/8 bg-white/[0.02]">
            <Button
              variant="ghost"
              className="w-full h-8 text-xs font-bold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-xl flex items-center justify-center gap-1.5"
              onClick={handleViewAll}
            >
              <span>View All Notifications</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

