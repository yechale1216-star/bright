"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { authService } from "@/lib/auth/auth";
import { apiUrl } from "@/lib/api-config";
import { useRouter } from "next/navigation";

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
  const schoolId = user?.schoolId || "single-school";
  const role = user?.role;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["x-school-id"] = schoolId;
  if (role === "parent") headers["x-requested-role"] = "parent";
  else if (role === "teacher") headers["x-requested-role"] = "teacher";
  else if (role === "school_admin") headers["x-requested-role"] = "school_admin";
  else if (role === "super_admin") headers["x-requested-role"] = "super_admin";
  return { ...headers, ...extraHeaders };
}

// ── Unread-count fetch helpers ────────────────────────────────────────────────

async function fetchParentUnreadCount(phone: string, schoolId?: string): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/parent/notifications/${encodeURIComponent(phone)}`, {
      headers: getNotifHeaders(schoolId ? { "x-school-id": schoolId } : {}),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return ((data.data || []) as any[]).filter((n: any) => !n.isRead).length;
  } catch {
    return 0;
  }
}

async function fetchUserUnreadCount(): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/notifications`, { headers: getNotifHeaders() });
    if (!res.ok) return 0;
    const data = await res.json();
    return ((data.data || []) as any[]).filter((n: any) => !n.isRead).length;
  } catch {
    return 0;
  }
}

// ── NotificationPopover Component ─────────────────────────────────────────────
// Clicking the Bell icon navigates directly to the full notification page.
// The badge shows a real-time unread count fetched in the background.

export function NotificationPopover() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  // Hydrate user once on mount
  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  const isParent = user?.role === "parent";
  const phone = user?.phone;
  const schoolId = user?.schoolId || "single-school";

  // Fetch unread count
  const refreshCount = useCallback(async () => {
    if (!user) return;
    const count = isParent && phone
      ? await fetchParentUnreadCount(phone, schoolId)
      : await fetchUserUnreadCount();
    setUnreadCount(count);
  }, [user, isParent, phone, schoolId]);

  // Initial fetch + poll every 60 seconds
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Re-fetch when a real-time socket event arrives
  useEffect(() => {
    const handler = () => refreshCount();
    window.addEventListener("new_notification", handler);
    return () => window.removeEventListener("new_notification", handler);
  }, [refreshCount]);

  const handleClick = () => {
    // Navigate to the appropriate full-screen notification page
    if (isParent) {
      router.push("/parent/notifications");
    } else {
      router.push("/notifications");
    }
  };

  return (
    <Button
      id="notification-bell-btn"
      variant="ghost"
      size="icon"
      className="relative group"
      onClick={handleClick}
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

      {/* Numeric count label for counts above 9 */}
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
  );
}
