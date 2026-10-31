"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Bell, CheckCheck, Trash2, Search, RefreshCw, 
  Clock, AlertTriangle, Info, ShieldAlert, 
  GraduationCap, Calendar, Users, Megaphone,
  ChevronLeft, ChevronRight
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
import { AnnouncementDetailDialog, AnnouncementItem } from "@/components/school/announcement-detail-dialog";
import { formatDistanceToNow } from "date-fns";

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

interface NavTab {
  id: string;
  label: string;
}

const ROLE_DEFAULT_TABS: Record<string, NavTab[]> = {
  teacher: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ACADEMIC", label: "Academics" },
    { id: "ATTENDANCE", label: "Student Attendance" },
  ],
  academic_head: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ACADEMIC", label: "Academics & Exams" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  admin: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ATTENDANCE", label: "Attendance" },
    { id: "ACADEMIC", label: "Academics" },
    { id: "DISCIPLINE", label: "Discipline" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  school_admin: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ATTENDANCE", label: "Attendance" },
    { id: "ACADEMIC", label: "Academics" },
    { id: "DISCIPLINE", label: "Discipline" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  super_admin: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ATTENDANCE", label: "Attendance" },
    { id: "ACADEMIC", label: "Academics" },
    { id: "DISCIPLINE", label: "Discipline" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  discipline_officer: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  registrar: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ACADEMIC", label: "Academic Records" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  staff_attendance_officer: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  hr_officer: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  librarian: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  transport_manager: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System Alerts" },
  ],
  parent: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ATTENDANCE", label: "Student Attendance" },
    { id: "ACADEMIC", label: "Academic Progress" },
    { id: "DISCIPLINE", label: "Conduct Alerts" },
  ],
  student: [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "ACADEMIC", label: "Grades & Classes" },
    { id: "ATTENDANCE", label: "Attendance" },
  ],
};

const DEFAULT_STAFF_TABS: NavTab[] = [
  { id: "ALL", label: "All" },
  { id: "UNREAD", label: "Unread" },
  { id: "ANNOUNCEMENT", label: "Announcements" },
  { id: "SYSTEM", label: "System Alerts" },
];

export function NotificationsCenter() {
  const router = useRouter();
  const [notificationsList, setNotificationsList] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [serverAllowedCategories, setServerAllowedCategories] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Announcement detail dialog state
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [selectedAnnouncementData, setSelectedAnnouncementData] = useState<AnnouncementItem | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const role = (user?.role || "").toLowerCase();

  // Compute available tabs dynamically based on user role and permissions
  const availableTabs = useMemo(() => {
    const baseTabs = ROLE_DEFAULT_TABS[role] || DEFAULT_STAFF_TABS;
    if (serverAllowedCategories.length === 0) return baseTabs;

    // Filter to only categories authorized by the backend
    return baseTabs.filter(
      (tab) =>
        tab.id === "ALL" ||
        tab.id === "UNREAD" ||
        serverAllowedCategories.includes(tab.id)
    );
  }, [role, serverAllowedCategories]);

  // If activeTab is no longer in availableTabs, reset to ALL
  useEffect(() => {
    if (!availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab("ALL");
    }
  }, [availableTabs, activeTab]);

  const getHeaders = useCallback(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("auth_token") ||
          sessionStorage.getItem("auth_token") ||
          localStorage.getItem("attendance_token")
        : null;
    const schoolId = user?.schoolId || "single-school";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    headers["x-school-id"] = schoolId;
    if (user?.role) headers["x-requested-role"] = user.role;
    return headers;
  }, [user]);

  const loadNotifications = useCallback(
    async (quiet = false, targetPage = page) => {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", "20");

        if (activeTab === "UNREAD") {
          params.set("isRead", "false");
        } else if (activeTab !== "ALL") {
          params.set("category", activeTab);
        }

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const res = await fetch(`${apiUrl}/api/notifications?${params.toString()}`, {
          headers: getHeaders(),
        });

        if (res.ok) {
          const json = await res.json();
          setNotificationsList(json.data || []);
          setUnreadCount(json.unreadCount ?? 0);
          setTotalCount(json.totalCount ?? 0);
          setTotalPages(json.totalPages ?? 1);
          setPage(json.page ?? targetPage);
          if (Array.isArray(json.allowedCategories)) {
            setServerAllowedCategories(json.allowedCategories);
          }
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getHeaders, activeTab, searchQuery, page]
  );

  useEffect(() => {
    if (user) {
      loadNotifications(false, 1);
    }
  }, [user, activeTab, loadNotifications]);

  // Real-time notification updates
  useEffect(() => {
    const handleNewNotif = () => loadNotifications(true, page);
    window.addEventListener("new_notification", handleNewNotif);
    window.addEventListener("notifications_updated", handleNewNotif);
    return () => {
      window.removeEventListener("new_notification", handleNewNotif);
      window.removeEventListener("notifications_updated", handleNewNotif);
    };
  }, [loadNotifications, page]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
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
      setUnreadCount(0);
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
        meta =
          typeof notification.metadata === "string"
            ? JSON.parse(notification.metadata)
            : notification.metadata;
      } catch {}
    }

    // 1. ANNOUNCEMENT HANDLING: Always open the Announcement Detail Modal!
    // Never redirect to a generic staff page!
    if (notification.category === "ANNOUNCEMENT" || meta?.announcementId) {
      const annId = meta?.announcementId || notification.id;
      setSelectedAnnouncementId(annId);
      setSelectedAnnouncementData({
        id: annId,
        title: notification.title,
        message: notification.message,
        type: (notification.type || "announcement").toLowerCase(),
        category: "ANNOUNCEMENT",
        createdAt: notification.createdAt,
        metadata: notification.metadata,
      });
      setSelectedNotificationId(notification.id);
      setIsAnnouncementDialogOpen(true);
      return;
    }

    // 2. Direct URL metadata navigation
    if (meta?.url) {
      router.push(meta.url);
      return;
    }

    // 3. Role-specific context navigation for other authorized categories
    const userRole = (user?.role || "").toLowerCase();
    const isAdmin = ["admin", "school_admin", "super_admin"].includes(userRole);
    const isTeacher = userRole === "teacher";
    const isAcademicHead = userRole === "academic_head";
    const isDisciplineOfficer = userRole === "discipline_officer";

    switch (notification.category) {
      case "ATTENDANCE":
        if (isAdmin) router.push("/school/admin/attendance");
        else if (isTeacher) router.push("/school/teacher/attendance");
        break;
      case "DISCIPLINE":
        if (isAdmin) router.push("/school/admin/discipline");
        break;
      case "ACADEMIC":
        if (isAdmin) router.push("/school/admin/report-cards");
        else if (isTeacher) router.push("/school/teacher/gradebook");
        else if (isAcademicHead) router.push("/school/academic-head/assessments");
        break;
      default:
        break;
    }
  };

  const getCategoryMeta = (category: string) => {
    switch (category) {
      case "ATTENDANCE":
        return {
          label: "Attendance",
          icon: Clock,
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "DISCIPLINE":
        return {
          label: "Discipline",
          icon: ShieldAlert,
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "ACADEMIC":
        return {
          label: "Academic",
          icon: GraduationCap,
          bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
      case "ANNOUNCEMENT":
        return {
          label: "Notice",
          icon: Megaphone,
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        };
      default:
        return {
          label: "System",
          icon: Info,
          bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
        };
    }
  };

  if (isLoading && notificationsList.length === 0) {
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
            Personalized alerts, school announcements, and system updates
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true, page)}
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

      {/* Dynamic Role-Based Filter Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {availableTabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight whitespace-nowrap transition-all border flex items-center gap-1.5",
                  isTabActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                    : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                )}
              >
                <span>{tab.label}</span>
                {tab.id === "UNREAD" && unreadCount > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                      isTabActive
                        ? "bg-rose-500 text-white"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search alerts..."
            className="pl-9 h-10 text-xs rounded-xl bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      {/* Notification List */}
      {notificationsList.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-400 dark:text-slate-600" />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
              No Notifications Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              {searchQuery
                ? "No alerts match your current search criteria."
                : activeTab === "UNREAD"
                ? "You're completely caught up! No unread notifications."
                : "There are currently no alerts or announcements in this category."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notificationsList.map((notification) => {
            const cat = getCategoryMeta(notification.category);
            const CatIcon = cat.icon;
            const isAnnouncement =
              notification.category === "ANNOUNCEMENT" ||
              Boolean((notification.metadata as any)?.announcementId);

            return (
              <div
                key={notification.id}
                onClick={() => handleActionClick(notification)}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-2xs",
                  notification.isRead
                    ? "bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                    : "bg-white dark:bg-slate-900 border-primary/30 shadow-xs hover:border-primary/60 dark:border-primary/40 ring-1 ring-primary/10"
                )}
              >
                {!notification.isRead && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary" />
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        cat.bg
                      )}
                    >
                      <CatIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-black uppercase px-2 py-0 h-4 rounded-md tracking-wider",
                            cat.bg
                          )}
                        >
                          {cat.label}
                        </Badge>

                        {isAnnouncement && (
                          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[9px] font-black uppercase px-1.5 py-0 h-4 rounded-md">
                            Notice Modal
                          </Badge>
                        )}

                        {notification.priority === "HIGH" && (
                          <Badge className="bg-rose-500 text-white text-[9px] font-black uppercase px-1.5 py-0 h-4 rounded-md">
                            High Priority
                          </Badge>
                        )}

                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 ml-auto sm:ml-0">
                          <Clock className="w-3 h-3" />
                          <span>
                            {notification.createdAt
                              ? formatDistanceToNow(new Date(notification.createdAt), {
                                  addSuffix: true,
                                })
                              : "Recently"}
                          </span>
                        </span>
                      </div>

                      <h4
                        className={cn(
                          "text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100",
                          !notification.isRead && "font-black text-primary dark:text-primary"
                        )}
                      >
                        {notification.title}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                      title="Delete"
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500">
            Page {page} of {totalPages} ({totalCount} total alerts)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                loadNotifications(false, prev);
              }}
              className="rounded-xl h-8 px-3 text-xs font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                loadNotifications(false, next);
              }}
              className="rounded-xl h-8 px-3 text-xs font-bold"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal: Accessible directly from notification click */}
      <AnnouncementDetailDialog
        isOpen={isAnnouncementDialogOpen}
        onClose={() => {
          setIsAnnouncementDialogOpen(false);
          setSelectedAnnouncementId(null);
          setSelectedAnnouncementData(null);
          setSelectedNotificationId(null);
        }}
        announcementId={selectedAnnouncementId}
        initialAnnouncement={selectedAnnouncementData}
        notificationId={selectedNotificationId}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
}
