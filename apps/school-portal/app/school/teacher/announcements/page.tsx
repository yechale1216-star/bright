"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Megaphone,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Users,
  GraduationCap,
  Globe,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { useAuth } from "@/lib/context/auth-context";
import { apiUrl } from "@/lib/api-config";
import { AnnouncementDetailDialog, AnnouncementItem } from "@/components/school/announcement-detail-dialog";

function TeacherAnnouncementsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { user } = useAuth();
  const schoolId = user?.schoolId || "single-school";

  const fetchAnnouncements = async (background = false) => {
    if (!background) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("attendance_token") || localStorage.getItem("auth_token")
          : "";
      const res = await fetch(`${apiUrl}/api/announcements`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "x-school-id": schoolId,
          "x-requested-role": "teacher",
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        setAnnouncements(list);

        // Auto-open highlighted announcement if requested via query param
        if (highlightId) {
          const match = list.find((a: any) => a.id === highlightId);
          if (match) {
            setSelectedAnnouncement(match);
            setIsDetailOpen(true);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch teacher announcements:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [schoolId, highlightId]);

  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      typeFilter === "ALL" || (item.type || "").toUpperCase() === typeFilter;

    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type?: string) => {
    const t = (type || "announcement").toLowerCase();
    switch (t) {
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

  const getAudienceBadge = (audience?: string) => {
    const a = (audience || "GENERAL").toUpperCase();
    switch (a) {
      case "PARENTS":
        return {
          label: "Parents",
          icon: Users,
          className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        };
      case "STAFF":
        return {
          label: "Staff Only",
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              School Announcements
            </h1>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Official communications, notices, and faculty circulars
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAnnouncements(true)}
          disabled={isRefreshing}
          className="rounded-xl h-10 border-slate-200 dark:border-slate-800 text-xs font-bold"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isRefreshing && "animate-spin")} />
          Sync Notices
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "ALL", label: "All Notices" },
            { id: "EMERGENCY", label: "Emergency Alerts" },
            { id: "INFO", label: "General Info" },
            { id: "ANNOUNCEMENT", label: "Standard Notices" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                typeFilter === tab.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                  : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notices..."
            className="pl-9 h-10 text-xs rounded-xl bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      {/* Notices List */}
      {isLoading ? (
        <div className="py-20 text-center text-xs font-semibold text-slate-400">
          Loading announcements...
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
          <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No announcements found</p>
          <p className="text-xs text-slate-400 mt-0.5">Check back later for school updates.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {filteredAnnouncements.map((item) => {
            const typeBadge = getTypeBadge(item.type);
            const audienceBadge = getAudienceBadge(item.targetAudience);
            const TypeIcon = typeBadge.icon;
            const AudienceIcon = audienceBadge.icon;

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedAnnouncement(item);
                  setIsDetailOpen(true);
                }}
                className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 hover:border-primary/50 transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 py-0.2 rounded-md", typeBadge.className)}>
                      <TypeIcon className="w-2.5 h-2.5 mr-1" />
                      <span>{typeBadge.label}</span>
                    </Badge>
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 py-0.2 rounded-md", audienceBadge.className)}>
                      <AudienceIcon className="w-2.5 h-2.5 mr-1" />
                      <span>{audienceBadge.label}</span>
                    </Badge>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {item.message}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "Recent"}</span>
                  </span>
                  <span className="text-primary font-bold group-hover:underline">View Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <AnnouncementDetailDialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedAnnouncement(null);
        }}
        announcementId={selectedAnnouncement?.id}
        initialAnnouncement={selectedAnnouncement}
      />
    </div>
  );
}

export default function TeacherAnnouncementsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs">Loading announcements...</div>}>
      <TeacherAnnouncementsContent />
    </Suspense>
  );
}

