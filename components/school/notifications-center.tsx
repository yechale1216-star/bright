"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Bell, Check, CheckCheck, Trash2, Search, Filter, RefreshCw, 
  Clock, AlertTriangle, AlertCircle, Info, ShieldAlert, 
  GraduationCap, Calendar, Users, BookOpen, ExternalLink, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";
import { notifications as toast } from "@/lib/utils/notifications";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export interface SystemNotification {
  id: string;
  type?: string;
  category: "ATTENDANCE" | "DISCIPLINE" | "ACADEMIC" | "ANNOUNCEMENT" | "SYSTEM" | "GENERAL" | string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: string | Record<string, any>;
}

export function NotificationsCenter() {
  const router = useRouter();
  const [notificationsList, setNotificationsList] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [activePriority, setActivePriority] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const getHeaders = useCallback(() => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("attendance_token")
      : null;
    const schoolId = user?.schoolId || "single-school";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    headers["x-school-id"] = schoolId;
    if (user?.role) headers["x-requested-role"] = user.role;
    return headers;
  }, [user]);

  const loadNotifications = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/api/notifications`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setNotificationsList(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  // Real-time notification updates
  useEffect(() => {
    const handleNewNotif = () => loadNotifications(true);
    window.addEventListener("new_notification", handleNewNotif);
    return () => window.removeEventListener("new_notification", handleNewNotif);
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      await fetch(`${apiUrl}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: getHeaders(),
      });
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await fetch(`${apiUrl}/api/notifications/mark-all-read`, {
        method: "PUT",
        headers: getHeaders(),
      });
      toast.success("All Caught Up", "All notifications have been marked as read");
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setNotificationsList((prev) => prev.filter((n) => n.id !== id));
      await fetch(`${apiUrl}/api/notifications/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleActionClick = (notification: SystemNotification) => {
    handleMarkAsRead(notification.id);
    let meta: any = null;
    if (notification.metadata) {
      try {
        meta = typeof notification.metadata === "string" 
          ? JSON.parse(notification.metadata) 
          : notification.metadata;
      } catch {}
    }

    // Role-aware context navigation
    const role = (user?.role || "").toLowerCase();
    const isAdmin = ["admin", "school_admin", "super_admin"].includes(role);
    const isTeacher = role === "teacher";

    if (meta?.url) {
      router.push(meta.url);
      return;
    }

    switch (notification.category) {
      case "ATTENDANCE":
        if (isAdmin) router.push("/school/admin/attendance");
        else if (isTeacher) router.push("/school/teacher/attendance");
        break;
      case "DISCIPLINE":
        if (isAdmin || role === "discipline_officer") router.push("/school/admin/discipline");
        break;
      case "ACADEMIC":
        if (isAdmin) router.push("/school/admin/report-cards");
        else if (isTeacher) router.push("/school/teacher/gradebook");
        break;
      case "ANNOUNCEMENT":
        if (isAdmin) router.push("/school/admin/announcements");
        else router.push("/school/staff/announcements");
        break;
      default:
        break;
    }
  };

  const filteredNotifications = useMemo(() => {
    return notificationsList.filter((item) => {
      // Category filter
      if (activeTab === "UNREAD" && item.isRead) return false;
      if (activeTab !== "ALL" && activeTab !== "UNREAD" && item.category !== activeTab) return false;

      // Priority filter
      if (activePriority !== "ALL" && item.priority !== activePriority) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesMessage = item.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMessage) return false;
      }

      return true;
    });
  }, [notificationsList, activeTab, activePriority, searchQuery]);

  const unreadCount = useMemo(() => {
    return notificationsList.filter((n) => !n.isRead).length;
  }, [notificationsList]);

  const getCategoryMeta = (category: string) => {
    switch (category) {
      case "ATTENDANCE":
        return { label: "Attendance", icon: Clock, bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
      case "DISCIPLINE":
        return { label: "Discipline", icon: ShieldAlert, bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
      case "ACADEMIC":
        return { label: "Academic", icon: GraduationCap, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "ANNOUNCEMENT":
        return { label: "Notice", icon: Bell, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      default:
        return { label: "System", icon: Info, bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" };
    }
  };

  if (isLoading) {
    return <PageSkeleton variant="cards" />;
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto w-full px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-safe">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Notifications Center
            </h1>
            {unreadCount > 0 && (
              <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] rounded-full px-2.5 py-0.5">
                {unreadCount} UNREAD
              </Badge>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Stay updated with school activities, student records, and system alerts
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true)}
            disabled={isRefreshing}
            className="rounded-xl h-10 border-slate-200 dark:border-slate-800 text-xs font-bold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isRefreshing && "animate-spin")} />
            Sync
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="rounded-xl h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold gap-2"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Mark All Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "ALL", label: "All" },
            { id: "UNREAD", label: `Unread (${unreadCount})` },
            { id: "ATTENDANCE", label: "Attendance" },
            { id: "DISCIPLINE", label: "Discipline" },
            { id: "ACADEMIC", label: "Academic" },
            { id: "ANNOUNCEMENT", label: "Announcements" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold tracking-tight whitespace-nowrap transition-all border",
                activeTab === tab.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                  : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts..."
            className="pl-9 h-10 text-xs rounded-xl bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No notifications found
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery
                ? `No results matching "${searchQuery}" in this category.`
                : "You're all caught up! New alerts will appear here in real-time."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notif) => {
            const meta = getCategoryMeta(notif.category);
            const Icon = meta.icon;
            const isUrgent = notif.priority === "URGENT" || notif.priority === "HIGH";

            return (
              <div
                key={notif.id}
                onClick={() => handleActionClick(notif)}
                className={cn(
                  "group relative p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5",
                  notif.isRead
                    ? "bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:shadow-xs"
                    : "bg-white dark:bg-slate-900 border-blue-200/80 dark:border-blue-900/50 shadow-xs hover:shadow-sm"
                )}
              >
                {/* Category Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5",
                    meta.bg
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                        meta.bg
                      )}
                    >
                      {meta.label}
                    </span>

                    {isUrgent && (
                      <Badge variant="destructive" className="text-[9px] font-black px-1.5 py-0">
                        {notif.priority}
                      </Badge>
                    )}

                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-auto">
                      {new Date(notif.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h4
                    className={cn(
                      "text-sm font-black truncate",
                      notif.isRead ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white"
                    )}
                  >
                    {notif.title}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {/* Actions & Unread indicator */}
                <div className="flex items-center gap-1 shrink-0 self-center">
                  {!notif.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse mr-2" />
                  )}

                  <button
                    onClick={(e) => handleDeleteNotification(notif.id, e)}
                    title="Delete notification"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

