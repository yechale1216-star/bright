"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Clock, ShieldAlert, GraduationCap, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";
import { useRouter } from "next/navigation";

export interface UserNotification {
  id: string;
  type?: string;
  category?: string;
  priority?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: string;
}

export function getNotifHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const user = authService.getCurrentUser();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("attendance_token")
      : null;
  const schoolId = user?.schoolId || "single-school";
  const role = user?.role;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["x-school-id"] = schoolId;
  if (role) headers["x-requested-role"] = role;
  return { ...headers, ...extraHeaders };
}

export function NotificationPopover() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<UserNotification[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  const isParent = user?.role === "parent";
  const phone = user?.phone;
  const schoolId = user?.schoolId || "single-school";

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      if (isParent && phone) {
        const res = await fetch(`${apiUrl}/api/parent/notifications/${encodeURIComponent(phone)}`, {
          headers: getNotifHeaders({ "x-school-id": schoolId }),
        });
        if (res.ok) {
          const json = await res.json();
          const items = (json.data || []) as UserNotification[];
          setRecentNotifications(items.slice(0, 5));
          setUnreadCount(items.filter((n) => !n.isRead).length);
        }
      } else {
        const res = await fetch(`${apiUrl}/api/notifications`, { headers: getNotifHeaders() });
        if (res.ok) {
          const json = await res.json();
          const items = (json.data || []) as UserNotification[];
          setRecentNotifications(items.slice(0, 5));
          setUnreadCount(json.unreadCount ?? items.filter((n) => !n.isRead).length);
        }
      }
    } catch {
      // Ignore background refresh errors
    }
  }, [user, isParent, phone, schoolId]);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 60_000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  useEffect(() => {
    const handler = () => refreshNotifications();
    window.addEventListener("new_notification", handler);
    window.addEventListener("notifications_updated", handler);
    return () => {
      window.removeEventListener("new_notification", handler);
      window.removeEventListener("notifications_updated", handler);
    };
  }, [refreshNotifications]);

  const getFullPageUrl = () => {
    const role = (user?.role || "").toLowerCase();
    if (isParent) return "/parent/notifications";
    if (role === "teacher") return "/school/teacher/notifications";
    if (role === "academic_head") return "/school/academic-head/notifications";
    if (role === "staff" || role === "staff_member") return "/school/staff/notifications";
    return "/school/admin/notifications";
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await fetch(`${apiUrl}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: getNotifHeaders(),
      });
      window.dispatchEvent(new Event("notifications_updated"));
    } catch {}
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push(getFullPageUrl());
  };

  const getIcon = (category?: string) => {
    switch (category) {
      case "ATTENDANCE":
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case "DISCIPLINE":
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />;
      case "ACADEMIC":
        return <GraduationCap className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Info className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id="notification-bell-btn"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 md:h-10 md:w-10 rounded-full border border-border bg-muted/40 hover:border-primary/50 transition-all shadow-2xs group"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground transition-colors group-hover:text-foreground" />

          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
          )}

          {unreadCount > 9 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-[17px] h-4 px-1 rounded-full",
                "bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none shadow-xs"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 rounded-2xl p-0 overflow-hidden shadow-2xl border-border bg-white dark:bg-slate-900"
      >
        {/* Dropdown Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Notifications
            </span>
            {unreadCount > 0 && (
              <Badge className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0 h-4 rounded-full">
                {unreadCount} NEW
              </Badge>
            )}
          </div>
          <button
            onClick={handleViewAll}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Inbox</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Quick notification list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
          {recentNotifications.length === 0 ? (
            <div className="py-10 text-center px-4">
              <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No notifications yet</p>
              <p className="text-[10px] text-slate-400 mt-0.5">You're all caught up!</p>
            </div>
          ) : (
            recentNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  handleMarkAsRead(n.id);
                  handleViewAll();
                }}
                className={cn(
                  "p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors flex items-start gap-3",
                  !n.isRead && "bg-blue-50/40 dark:bg-blue-950/20"
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(n.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={cn("text-xs font-bold truncate", !n.isRead ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
                      {n.title}
                    </p>
                    <span className="text-[9px] text-slate-400 shrink-0">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                    {n.message}
                  </p>
                </div>
                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Dropdown Footer */}
        <div className="p-2 border-t border-border bg-slate-50/50 dark:bg-slate-800/30 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewAll}
            className="w-full text-xs font-bold h-8 rounded-xl text-slate-600 dark:text-slate-300 hover:text-primary"
          >
            Open Full Notification Center
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
