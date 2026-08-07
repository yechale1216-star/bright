"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, Check, CheckCheck, Trash2, X, BellOff,
  Info, AlertTriangle, MessageSquare, Users, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";

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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNotifIcon(type: string, category?: string) {
  const key = (category || type || "").toUpperCase();
  switch (key) {
    case "MESSAGE":    return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "ATTENDANCE": return <GraduationCap  className="h-4 w-4 text-amber-500" />;
    case "DISCIPLINE": return <AlertTriangle   className="h-4 w-4 text-rose-500" />;
    case "ANNOUNCEMENT": return <Info className="h-4 w-4 text-emerald-500" />;
    case "ALERT":
    case "URGENT":     return <AlertTriangle   className="h-4 w-4 text-red-500" />;
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
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
            "absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-border/60 bg-background shadow-2xl",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
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

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="rounded-full bg-muted p-3">
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No notifications yet.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/30">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={cn(
                      "group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      !notif.isRead && "bg-primary/5"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      !notif.isRead ? "bg-primary/10" : "bg-muted"
                    )}>
                      {getNotifIcon(notif.type, notif.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-8">
                      <p className={cn(
                        "text-xs font-semibold truncate",
                        !notif.isRead ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="absolute right-4 top-4 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}

                    {/* Hover actions */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                      {!notif.isRead && (
                        <button
                          className="rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => handleMarkRead(notif.id)}
                          title="Mark as read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        onClick={() => handleDelete(notif.id)}
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
