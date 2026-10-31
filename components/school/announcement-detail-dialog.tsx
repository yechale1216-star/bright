"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Users,
  GraduationCap,
  Globe,
  FileText,
  Download,
  Building2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { apiUrl } from "@/lib/api-config";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/utils";

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type?: "announcement" | "emergency" | "info" | string;
  category?: string;
  targetAudience?: "GENERAL" | "STAFF" | "PARENTS" | string;
  createdAt: string;
  studentId?: string | null;
  student?: {
    id: string;
    student_id?: string;
    fullName?: string;
    first_name?: string;
    last_name?: string;
    admission_number?: string;
    grade_level?: string;
    gradeId?: string;
  } | null;
  metadata?: string | Record<string, any> | null;
}

interface AnnouncementDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  announcementId?: string | null;
  initialAnnouncement?: AnnouncementItem | null;
  notificationId?: string | null;
  onMarkAsRead?: (notificationId: string) => void;
}

export function AnnouncementDetailDialog({
  isOpen,
  onClose,
  announcementId,
  initialAnnouncement,
  notificationId,
  onMarkAsRead,
}: AnnouncementDetailDialogProps) {
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(
    initialAnnouncement || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAnnouncement) {
      setAnnouncement(initialAnnouncement);
    }
  }, [initialAnnouncement]);

  useEffect(() => {
    if (!isOpen) return;

    // Auto mark notification as read
    if (notificationId && onMarkAsRead) {
      onMarkAsRead(notificationId);
    }

    // If initial data is supplied and matches the requested id, no need to fetch
    if (initialAnnouncement && (!announcementId || initialAnnouncement.id === announcementId)) {
      setAnnouncement(initialAnnouncement);
      return;
    }

    if (!announcementId) return;

    const fetchAnnouncement = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("auth_token") ||
              sessionStorage.getItem("auth_token") ||
              localStorage.getItem("attendance_token")
            : null;

        const res = await fetch(`${apiUrl}/api/announcements/${announcementId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          if (res.status === 404) throw new Error("Announcement not found");
          if (res.status === 403) throw new Error("You are not authorized to view this announcement");
          throw new Error("Failed to load announcement");
        }

        const json = await res.json();
        setAnnouncement(json.data);
      } catch (err: any) {
        console.error("Error fetching announcement details:", err);
        setError(err.message || "Could not retrieve announcement details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncement();
  }, [isOpen, announcementId, initialAnnouncement, notificationId, onMarkAsRead]);

  const type = announcement?.type?.toLowerCase() || "announcement";
  const audience = (announcement?.targetAudience || "GENERAL").toUpperCase();

  const getTypeBadge = () => {
    switch (type) {
      case "emergency":
        return {
          label: "Emergency Alert",
          icon: AlertTriangle,
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "info":
        return {
          label: "Information",
          icon: Info,
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
      default:
        return {
          label: "Official Notice",
          icon: Megaphone,
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
    }
  };

  const getAudienceBadge = () => {
    switch (audience) {
      case "PARENTS":
        return {
          label: "Parents Only",
          icon: Users,
          className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        };
      case "STAFF":
        return {
          label: "School Staff Only",
          icon: GraduationCap,
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      default:
        return {
          label: "General Community",
          icon: Globe,
          className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
        };
    }
  };

  // Extract metadata attachments or links if present
  let metaObj: any = null;
  if (announcement?.metadata) {
    try {
      metaObj =
        typeof announcement.metadata === "string"
          ? JSON.parse(announcement.metadata)
          : announcement.metadata;
    } catch {}
  }

  const typeBadge = getTypeBadge();
  const audienceBadge = getAudienceBadge();
  const TypeIcon = typeBadge.icon;
  const AudienceIcon = audienceBadge.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-3xl p-0 overflow-hidden border border-border shadow-2xl bg-white dark:bg-slate-900">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">Loading announcement details...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-foreground text-lg">Unable to View Announcement</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
            <Button onClick={onClose} variant="outline" className="rounded-xl h-10 px-5 text-xs font-bold">
              Close
            </Button>
          </div>
        ) : announcement ? (
          <div>
            {/* Header with Type Accent Banner */}
            <div
              className={cn(
                "p-5 sm:p-6 border-b border-border/80",
                type === "emergency"
                  ? "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent"
                  : type === "info"
                  ? "bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent"
                  : "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5", typeBadge.className)}>
                  <TypeIcon className="w-3 h-3" />
                  <span>{typeBadge.label}</span>
                </Badge>

                <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5", audienceBadge.className)}>
                  <AudienceIcon className="w-3 h-3" />
                  <span>{audienceBadge.label}</span>
                </Badge>
              </div>

              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight leading-snug">
                  {announcement.title}
                </DialogTitle>
              </DialogHeader>

              {/* Publisher & Date Metadata */}
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-3 text-[11px] font-semibold text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary/70" />
                  <span>Bright Path Administration</span>
                </div>

                {announcement.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {format(new Date(announcement.createdAt), "MMMM d, yyyy")}
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {format(new Date(announcement.createdAt), "h:mm a")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Announcement Body */}
            <div className="p-5 sm:p-6 max-h-[50vh] overflow-y-auto space-y-4">
              {announcement.student && (
                <div className="p-3 rounded-2xl bg-secondary/50 border border-border/70 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                    {(announcement.student.fullName || announcement.student.first_name || "S")[0]}
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-foreground">
                      Related Student: {announcement.student.fullName || `${announcement.student.first_name || ""} ${announcement.student.last_name || ""}`.trim()}
                    </span>
                    {(announcement.student.grade_level || announcement.student.gradeId) && (
                      <span className="text-muted-foreground block text-[11px]">
                        Grade: {announcement.student.grade_level || announcement.student.gradeId}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
                {announcement.message}
              </div>

              {/* Attachments Section if available */}
              {metaObj?.attachments && Array.isArray(metaObj.attachments) && metaObj.attachments.length > 0 && (
                <div className="pt-4 border-t border-border/60">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attached Resources</span>
                  </h4>
                  <div className="space-y-2">
                    {metaObj.attachments.map((att: any, idx: number) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors text-xs font-semibold group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{att.name || `Attachment ${idx + 1}`}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="rounded-xl h-9 px-5 text-xs font-bold w-full sm:w-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
