"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  X,
  Play,
  FileText,
  Presentation,
  Globe,
  Download,
  ExternalLink,
  Clock,
  Subtitles,
  Calendar,
  Eye,
  User,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  File,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
  Volume2,
  LayoutGrid,
  List,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { studentDb } from "@/lib/db/student-db";
import { learningMaterialClientService } from "@/lib/homework-service";
import { cn } from "@/lib/utils/utils";
import { EducationalVideoPlayer } from "@/components/ui/educational-video-player";
import {
  isYouTubeUrl,
  isDirectVideoUrl,
  getYouTubeThumbnailUrl,
} from "@/lib/utils/video-utils";

// ─── Metadata Helpers (Mirrors Bright Path Teacher Spec) ────────────────────

export interface MaterialMetadata {
  thumbnailUrl?: string;
  duration?: string;
  subtitleUrl?: string;
  subtitleLang?: string;
  subtitleLabel?: string;
  transcript?: string;
  status: "PUBLISHED" | "DRAFT";
}

export function parseMaterialMeta(rawDescription?: string | null): {
  cleanDescription: string;
  meta: MaterialMetadata;
} {
  const defaultMeta: MaterialMetadata = { status: "PUBLISHED" };
  if (!rawDescription) return { cleanDescription: "", meta: defaultMeta };

  const match = rawDescription.match(/^<!--BP_META:([\s\S]*?)-->([\s\S]*)$/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        cleanDescription: (match[2] || "").trim(),
        meta: {
          ...defaultMeta,
          ...parsed,
          status: parsed.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
        },
      };
    } catch {
      // fallback
    }
  }

  return { cleanDescription: rawDescription.trim(), meta: defaultMeta };
}

export interface StudentMaterialItem {
  id: string;
  title: string;
  description?: string | null;
  subjectId: string;
  subjectName?: string;
  subjectColor?: string;
  teacherName?: string | null;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  viewCount?: number;
  createdAt: string | Date;
}

type MaterialTypeCategory = "ALL" | "VIDEOS" | "DOCUMENTS" | "PDF" | "PRESENTATIONS" | "LINKS";

function categorizeMaterial(fileType?: string | null, fileUrl?: string): MaterialTypeCategory {
  const ft = (fileType || "").toUpperCase();
  const url = (fileUrl || "").toLowerCase();

  if (
    ft === "VIDEO" ||
    isYouTubeUrl(fileUrl) ||
    isDirectVideoUrl(fileUrl)
  ) {
    return "VIDEOS";
  }

  if (ft === "SLIDES" || ft === "PRESENTATION" || url.endsWith(".ppt") || url.endsWith(".pptx") || url.endsWith(".key")) {
    return "PRESENTATIONS";
  }

  if (ft === "LINK" || (url.startsWith("http") && !url.endsWith(".pdf") && !url.endsWith(".mp4"))) {
    return "LINKS";
  }

  if (ft === "PDF" || url.endsWith(".pdf") || url.startsWith("data:application/pdf")) {
    return "PDF";
  }

  return "DOCUMENTS";
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
}

export function StudentSharedMaterials() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<StudentMaterialItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [studentInfo, setStudentInfo] = useState<{
    grade?: string;
    section?: string;
    academicYear?: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<MaterialTypeCategory>("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Local optimistic views tracking
  const [localViews, setLocalViews] = useState<Record<string, number>>({});

  // Active Lesson Viewer (Android dedicated screen for videos)
  const [activeLesson, setActiveLesson] = useState<{
    material: StudentMaterialItem;
    cleanDescription: string;
    meta: MaterialMetadata;
  } | null>(null);

  // Document Preview Modal
  const [previewDoc, setPreviewDoc] = useState<{
    material: StudentMaterialItem;
    cleanDescription: string;
    meta: MaterialMetadata;
  } | null>(null);

  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Scroll preservation
  const scrollPositionRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Data Loading ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Materials
      const matsRes = await studentDb.getMaterials();
      setMaterials(matsRes || []);

      // 2. Fetch Classes / Enrolled Subjects
      const classesRes = await studentDb.getClasses().catch(() => []);
      setClasses(classesRes || []);

      // 3. Fetch Student Dashboard Context (Grade, Section, Year)
      const dashRes = await studentDb.getDashboard().catch(() => null);
      if (dashRes?.student) {
        setStudentInfo({
          grade: dashRes.student.grade,
          section: dashRes.student.section,
          academicYear: dashRes.academicYear || "Current Year",
        });
      }
    } catch (err: any) {
      console.error("[StudentMaterials] Fetch error:", err);
      setError(err?.message || "Failed to load learning materials. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Focus search input on expand
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // ─── View Tracking Handler ────────────────────────────────────────────────
  const handleRecordView = useCallback((materialId: string, currentCount?: number) => {
    setLocalViews((prev) => ({
      ...prev,
      [materialId]: (prev[materialId] ?? currentCount ?? 0) + 1,
    }));
    learningMaterialClientService.incrementView(materialId);
  }, []);

  // ─── Open Lesson (Video Mode) ─────────────────────────────────────────────
  const handleOpenLesson = useCallback((item: StudentMaterialItem) => {
    // Save scroll position
    scrollPositionRef.current = window.scrollY;

    const { cleanDescription, meta } = parseMaterialMeta(item.description);
    handleRecordView(item.id, item.viewCount);

    setActiveLesson({
      material: item,
      cleanDescription,
      meta,
    });

    // Scroll to top of lesson viewer
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [handleRecordView]);

  // ─── Close Lesson (Return to List) ────────────────────────────────────────
  const handleBackToList = useCallback(() => {
    setActiveLesson(null);
    // Restore scroll position after render
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: "instant" });
    }, 50);
  }, []);

  // ─── Open Document or Link ────────────────────────────────────────────────
  const handleOpenDocument = useCallback((item: StudentMaterialItem) => {
    handleRecordView(item.id, item.viewCount);
    const { cleanDescription, meta } = parseMaterialMeta(item.description);

    const isPdf = item.fileType?.toUpperCase() === "PDF" || item.fileUrl.endsWith(".pdf");
    if (isPdf && (item.fileUrl.startsWith("http") || item.fileUrl.startsWith("data:"))) {
      setPreviewDoc({
        material: item,
        cleanDescription,
        meta,
      });
      return;
    }

    // Direct download or open
    if (item.fileUrl && item.fileUrl !== "#") {
      if (item.fileUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = item.fileUrl;
        a.download = item.title || "learning-material";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.open(item.fileUrl, "_blank", "noopener,noreferrer");
      }
    }
  }, [handleRecordView]);

  // ─── Filter & Search Logic ────────────────────────────────────────────────
  const filteredMaterials = useMemo(() => {
    return materials
      .map((m) => {
        const { cleanDescription, meta } = parseMaterialMeta(m.description);
        const category = categorizeMaterial(m.fileType, m.fileUrl);
        return {
          material: m,
          cleanDescription,
          meta,
          category,
        };
      })
      .filter(({ material, cleanDescription, meta, category }) => {
        // Enforce published status
        if (meta.status === "DRAFT") return false;

        // Type Filter
        if (selectedType !== "ALL") {
          if (selectedType === "VIDEOS" && category !== "VIDEOS") return false;
          if (selectedType === "DOCUMENTS" && category !== "DOCUMENTS" && category !== "PDF") return false;
          if (selectedType === "PDF" && category !== "PDF") return false;
          if (selectedType === "PRESENTATIONS" && category !== "PRESENTATIONS") return false;
          if (selectedType === "LINKS" && category !== "LINKS") return false;
        }

        // Subject Filter
        if (selectedSubjectId !== "ALL" && material.subjectId !== selectedSubjectId) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = material.title.toLowerCase().includes(q);
          const matchDesc = cleanDescription.toLowerCase().includes(q);
          const matchSubject = (material.subjectName || "").toLowerCase().includes(q);
          const matchTeacher = (material.teacherName || "").toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchSubject && !matchTeacher) return false;
        }

        return true;
      });
  }, [materials, selectedType, selectedSubjectId, searchQuery]);

  // Subject options derived from enrolled classes or available materials
  const subjectsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();

    classes.forEach((c) => {
      const subId = c.subjectId || c.id;
      const subName = c.subject || c.name || "Subject";
      const subColor = c.subjectColor || c.color || "#8b5cf6";
      if (subId && !map.has(subId)) {
        map.set(subId, { id: subId, name: subName, color: subColor });
      }
    });

    materials.forEach((m) => {
      if (m.subjectId && !map.has(m.subjectId)) {
        map.set(m.subjectId, {
          id: m.subjectId,
          name: m.subjectName || "Subject",
          color: m.subjectColor || "#8b5cf6",
        });
      }
    });

    return Array.from(map.values());
  }, [classes, materials]);

  // Related materials for the active lesson viewer
  const relatedMaterials = useMemo(() => {
    if (!activeLesson) return [];
    return materials
      .filter((m) => m.id !== activeLesson.material.id && m.subjectId === activeLesson.material.subjectId)
      .slice(0, 4);
  }, [activeLesson, materials]);

  // Copy transcript helper
  const handleCopyTranscript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 1: DEDICATED MOBILE VIDEO LESSON VIEWER
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeLesson) {
    const { material: m, cleanDescription, meta } = activeLesson;
    const viewsCount = localViews[m.id] ?? m.viewCount ?? 0;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 -mx-3 sm:mx-0 -mt-2 sm:mt-0 animate-in fade-in duration-200">
        {/* Sticky Mobile Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
          <button
            type="button"
            onClick={handleBackToList}
            aria-label="Back to learning materials"
            className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm hover:text-purple-600 transition-colors py-1 px-1 rounded-xl active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-purple-600" />
            <span className="truncate max-w-[200px] sm:max-w-xs font-black">All Materials</span>
          </button>

          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shadow-xs shrink-0"
              style={{ backgroundColor: m.subjectColor || "#7c3aed" }}
            >
              {m.subjectName || "Lesson"}
            </span>
          </div>
        </header>

        {/* 16:9 Responsive Video Box & YouTube Assistant */}
        <div className="w-full max-w-5xl mx-auto sm:px-4 sm:pt-4">
          <EducationalVideoPlayer
            fileUrl={m.fileUrl}
            title={m.title}
            thumbnailUrl={meta.thumbnailUrl || getYouTubeThumbnailUrl(m.fileUrl) || undefined}
            subtitleUrl={meta.subtitleUrl}
            subtitleLang={meta.subtitleLang}
            subtitleLabel={meta.subtitleLabel}
            showSubtitles={showSubtitles}
            autoPlay={true}
            showExternalAction={true}
          />
        </div>

        {/* Video Lesson Content Container */}
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {/* Title & Metadata Strip */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className="font-bold px-2 py-0.5 rounded-md text-white text-[11px]"
                style={{ backgroundColor: m.subjectColor || "#7c3aed" }}
              >
                {m.subjectName || "General Subject"}
              </span>

              {meta.duration && (
                <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                  <Clock className="w-3 h-3 text-purple-600" />
                  {meta.duration}
                </span>
              )}

              {/* Subtitles Button - Only rendered if captions actually exist */}
              {meta.subtitleUrl && (
                <button
                  type="button"
                  onClick={() => setShowSubtitles((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[11px] transition-colors border",
                    showSubtitles
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                  )}
                  title="Toggle captions"
                >
                  <Subtitles className="w-3 h-3" />
                  <span>CC ({meta.subtitleLabel || "English"})</span>
                </button>
              )}

              <span className="flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md text-[11px] ml-auto">
                <Eye className="w-3 h-3 text-purple-600" />
                {viewsCount.toLocaleString()} views
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-50 leading-snug">
              {m.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60 gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-purple-600" />
                <span>Instructor: {m.teacherName || "Assigned Teacher"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          {/* Teacher Notes & Lesson Objectives */}
          {cleanDescription && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Lesson Instructions & Notes
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {cleanDescription}
              </p>
            </div>
          )}

          {/* Full Lecture Transcript (if provided) */}
          {meta.transcript && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Full Lecture Transcript
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyTranscript(meta.transcript!)}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  {copiedTranscript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTranscript ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
                {meta.transcript}
              </div>
            </div>
          )}

          {/* Related Materials Section */}
          {relatedMaterials.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
                More from {m.subjectName || "This Subject"}
              </h3>
              <div className="space-y-2">
                {relatedMaterials.map((rel) => {
                  const relCat = categorizeMaterial(rel.fileType, rel.fileUrl);
                  return (
                    <div
                      key={rel.id}
                      onClick={() => {
                        if (relCat === "VIDEOS") {
                          handleOpenLesson(rel);
                        } else {
                          handleOpenDocument(rel);
                        }
                      }}
                      className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 flex items-center justify-between gap-3 cursor-pointer shadow-2xs active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${rel.subjectColor || "#7c3aed"}20`,
                            color: rel.subjectColor || "#7c3aed",
                          }}
                        >
                          {relCat === "VIDEOS" ? (
                            <Play className="w-4 h-4 fill-current" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {rel.title}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {relCat === "VIDEOS" ? "Video Lesson" : rel.fileType || "Document"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 2: MAIN MOBILE-FIRST ANDROID MATERIALS BROWSER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-16 animate-in fade-in duration-200">
      {/* ─── 1. TOP APP BAR ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <BookOpen className="w-4 h-4" />
              </span>
              <span>Learning Materials</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              Explore lessons, lecture slides, worksheets, and study resources
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            {/* View Mode Toggle: Grid vs List */}
            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-2xl p-0.5 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                  viewMode === "grid"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                  viewMode === "list"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSearchExpanded((v) => !v)}
              aria-label="Toggle search field"
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all active:scale-95",
                isSearchExpanded || searchQuery
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              )}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={fetchData}
              aria-label="Refresh materials"
              title="Refresh"
              className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-purple-600")} />
            </button>
          </div>
        </div>

        {/* Expandable Android Search Bar */}
        {(isSearchExpanded || searchQuery) && (
          <div className="relative pt-1 animate-in slide-in-from-top-2 duration-150">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-purple-600 absolute left-3.5 pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic, lesson title, or teacher..."
                className="pl-10 pr-9 h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold focus-visible:ring-purple-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Current Class and Context Pill */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/70 text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
          <span className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-xl font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
            <span>
              {studentInfo.grade || "My Grade"} {studentInfo.section ? `• Section ${studentInfo.section}` : ""}
            </span>
          </span>
          {studentInfo.academicYear && (
            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-slate-500 dark:text-slate-400">
              {studentInfo.academicYear}
            </span>
          )}
          <span className="ml-auto text-slate-400 font-medium">
            {filteredMaterials.length} {filteredMaterials.length === 1 ? "resource" : "resources"}
          </span>
        </div>
      </div>

      {/* ─── 2. HORIZONTALLY SCROLLABLE ANDROID FILTER CHIPS ─── */}
      <div className="space-y-2">
        {/* Type Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1 touch-pan-x">
          {(
            [
              { id: "ALL", label: "All Types", icon: LayoutGrid },
              { id: "VIDEOS", label: "Video Lessons", icon: Play },
              { id: "DOCUMENTS", label: "Documents", icon: FileText },
              { id: "PDF", label: "PDF Only", icon: File },
              { id: "PRESENTATIONS", label: "Slides", icon: Presentation },
              { id: "LINKS", label: "Links", icon: Globe },
            ] as const
          ).map((chip) => {
            const isSelected = selectedType === chip.id;
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedType(chip.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 border",
                  isSelected
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs shadow-purple-600/20"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-purple-300"
                )}
              >
                {Icon && <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-purple-600")} />}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Subject Chips (Filtered from Student's Enrolled Subjects) */}
        {subjectsList.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1 touch-pan-x">
            <button
              type="button"
              onClick={() => setSelectedSubjectId("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 transition-all border",
                selectedSubjectId === "ALL"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
              )}
            >
              All Subjects
            </button>

            {subjectsList.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 transition-all border",
                    isSelected
                      ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border-purple-400 dark:border-purple-700"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: sub.color || "#7c3aed" }}
                  />
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 3. LOADING SKELETON STATE ─── */}
      {loading && materials.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2.5 animate-pulse"
            >
              <div className="w-full aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ─── 4. ERROR & RETRY STATE ─── */}
      {error && !loading && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-950/60 space-y-3 shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{error}</h3>
          <Button
            onClick={fetchData}
            variant="outline"
            className="rounded-xl font-bold text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry Connection
          </Button>
        </div>
      )}

      {/* ─── 5. EMPTY STATES ─── */}
      {!loading && !error && filteredMaterials.length === 0 && (
        <div className="py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mx-auto">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
              {searchQuery || selectedType !== "ALL" || selectedSubjectId !== "ALL"
                ? "No matching materials found"
                : "No learning materials published yet"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedType !== "ALL" || selectedSubjectId !== "ALL"
                ? "Try adjusting your search terms or filter chips to find what you are looking for."
                : "Your teachers haven't uploaded materials for your enrolled classes yet. Check back soon!"}
            </p>
          </div>
          {(searchQuery || selectedType !== "ALL" || selectedSubjectId !== "ALL") && (
            <Button
              onClick={() => {
                setSearchQuery("");
                setSelectedType("ALL");
                setSelectedSubjectId("ALL");
              }}
              variant="outline"
              className="rounded-xl text-xs font-bold text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* ─── 6. RESPONSIVE MATERIALS CARDS (GRID & LIST VIEWS) ─── */}
      {!loading && !error && filteredMaterials.length > 0 && (
        viewMode === "grid" ? (
          /* ─── GRID VIEW: 4 COLS DESKTOP, 2 COLS TABLET, 1 COL MOBILE ─── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMaterials.map(({ material: m, cleanDescription, meta, category }) => {
              const isVideo = category === "VIDEOS";
              const isDoc = category === "DOCUMENTS" || category === "PDF";
              const isPdf = category === "PDF";
              const isSlides = category === "PRESENTATIONS";
              const isLink = category === "LINKS";
              const viewsCount = localViews[m.id] ?? m.viewCount ?? 0;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isVideo) {
                      handleOpenLesson(m);
                    } else {
                      handleOpenDocument(m);
                    }
                  }}
                  className="rounded-2xl border border-border/60 bg-card hover:border-purple-400/60 hover:shadow-md transition-all flex flex-col overflow-hidden group cursor-pointer relative"
                >
                  {/* Visual 16:9 Thumbnail or Icon Hero */}
                  <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                    {meta.thumbnailUrl ? (
                      <img
                        src={meta.thumbnailUrl}
                        alt={m.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : isVideo && getYouTubeThumbnailUrl(m.fileUrl) ? (
                      <div className="relative w-full h-full">
                        <img
                          src={getYouTubeThumbnailUrl(m.fileUrl)!}
                          alt={m.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-xl bg-purple-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          </div>
                        </div>
                      </div>
                    ) : isVideo ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900/40 via-purple-700/20 to-slate-900 flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        </div>
                      </div>
                    ) : isSlides ? (
                      <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-slate-900 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                          <Presentation className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>
                    ) : isLink ? (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-slate-900 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-50 to-pink-50 dark:from-blue-950/30 dark:to-slate-900 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-blue-900/40 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-red-500 dark:text-blue-400" />
                        </div>
                      </div>
                    )}

                    {/* Top left type & subject badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 max-w-[85%] truncate">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide",
                          isVideo && "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
                          isDoc && "bg-red-100 text-red-700 dark:bg-blue-900/60 dark:text-blue-300",
                          isSlides && "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
                          isLink && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                        )}
                      >
                        {isVideo ? "Video" : isSlides ? "Slides" : isLink ? "Link" : isPdf ? "PDF" : "Document"}
                      </span>
                      {m.subjectName && (
                        <span
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-2xs truncate"
                          style={{ backgroundColor: m.subjectColor || "#7c3aed" }}
                        >
                          {m.subjectName}
                        </span>
                      )}
                    </div>

                    {/* Duration badge */}
                    {meta.duration && (
                      <div className="absolute bottom-2 right-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {meta.duration}
                        </span>
                      </div>
                    )}

                    {/* CC badge */}
                    {meta.subtitleUrl && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                          CC
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <div className="p-3 flex-1 flex flex-col gap-1.5">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {m.title}
                    </h3>

                    {cleanDescription && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {cleanDescription}
                      </p>
                    )}

                    {/* Teacher info */}
                    {m.teacherName && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                        <User className="w-3 h-3 text-purple-600" />
                        {m.teacherName}
                      </span>
                    )}

                    {/* Metadata footer */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-2 border-t border-border/40">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-md text-[10px]">
                          <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          {viewsCount.toLocaleString()} views
                        </span>
                        {m.fileSize && (
                          <span className="font-medium">{formatBytes(m.fileSize)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── LIST VIEW: SLEEK HORIZONTAL ROWS ─── */
          <div className="space-y-2">
            {filteredMaterials.map(({ material: m, cleanDescription, meta, category }) => {
              const isVideo = category === "VIDEOS";
              const isDoc = category === "DOCUMENTS" || category === "PDF";
              const isSlides = category === "PRESENTATIONS";
              const isLink = category === "LINKS";
              const viewsCount = localViews[m.id] ?? m.viewCount ?? 0;

              const iconBg = isVideo
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                : isSlides
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                : isLink
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "bg-red-100 dark:bg-blue-900/30 text-red-500 dark:text-blue-400";

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isVideo) {
                      handleOpenLesson(m);
                    } else {
                      handleOpenDocument(m);
                    }
                  }}
                  className="p-3.5 rounded-2xl border border-border/60 bg-card hover:border-purple-400/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs", iconBg)}>
                      {isVideo ? <Play className="w-4 h-4 fill-current" /> : isSlides ? <Presentation className="w-5 h-5" /> : isLink ? <Globe className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-purple-600 transition-colors">
                          {m.title}
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-md shrink-0">
                          {isVideo ? "Video" : isSlides ? "Slides" : isLink ? "Link" : "Document"}
                        </Badge>
                        {m.subjectName && (
                          <span
                            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-2xs"
                            style={{ backgroundColor: m.subjectColor || "#7c3aed" }}
                          >
                            {m.subjectName}
                          </span>
                        )}
                        {meta.subtitleUrl && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center gap-0.5">
                            <Subtitles className="w-2.5 h-2.5" /> CC
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.createdAt).toLocaleDateString()}</span>
                        {meta.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meta.duration}</span>}
                        {m.teacherName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-purple-600" />
                            {m.teacherName}
                          </span>
                        )}
                        {m.fileSize && <span>• {formatBytes(m.fileSize)}</span>}
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-md text-[11px]">
                          <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          {viewsCount.toLocaleString()} views
                        </span>
                        {cleanDescription && <span className="truncate max-w-[240px] hidden md:inline">• {cleanDescription}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 px-3 text-xs font-semibold gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800"
                    >
                      {isVideo ? <Play className="w-3 h-3 fill-current" /> : <ExternalLink className="w-3 h-3" />}
                      <span>{isVideo ? "Watch" : "Open"}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ─── 7. DOCUMENT IN-APP PREVIEW MODAL ─── */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[92vh] rounded-2xl sm:rounded-3xl p-4 sm:p-6 overflow-y-auto">
          {previewDoc && (
            <div className="space-y-4">
              <DialogHeader className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: previewDoc.material.subjectColor || "#7c3aed" }}
                  >
                    {previewDoc.material.subjectName || "Document"}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {previewDoc.material.fileType || "PDF"}
                  </Badge>
                  {previewDoc.material.fileSize && (
                    <span className="text-xs text-slate-400 font-mono">
                      {formatBytes(previewDoc.material.fileSize)}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 leading-snug">
                  {previewDoc.material.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Shared by {previewDoc.material.teacherName || "Your Teacher"} •{" "}
                  {new Date(previewDoc.material.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              {/* PDF In-App Preview Embed or Fallback */}
              <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-[42vh] sm:h-[50vh] flex items-center justify-center">
                {previewDoc.material.fileUrl.startsWith("http") || previewDoc.material.fileUrl.startsWith("data:") ? (
                  <iframe
                    src={previewDoc.material.fileUrl}
                    title={previewDoc.material.title}
                    className="w-full h-full border-0 rounded-2xl"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <FileText className="w-12 h-12 text-purple-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">Ready to open document</p>
                  </div>
                )}
              </div>

              {previewDoc.cleanDescription && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {previewDoc.cleanDescription}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Close
                </Button>

                <a
                  href={previewDoc.material.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={previewDoc.material.fileUrl.startsWith("data:") ? previewDoc.material.title : undefined}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shadow-purple-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
