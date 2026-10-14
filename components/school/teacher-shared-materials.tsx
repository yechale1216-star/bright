"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Video,
  FileText,
  Presentation,
  Link as LinkIcon,
  Play,
  Download,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  Search,
  Upload,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Subtitles,
  Eye,
  BookOpen,
  Layers,
  X,
  FolderOpen,
  LayoutGrid,
  List,
  Sparkles,
  File,
  Check,
  RefreshCw,
  Share2,
  MoreVertical,
  Globe,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { notifications } from "@/lib/utils/notifications"
import { learningMaterialClientService, type LearningMaterial } from "@/lib/homework-service"
import { cn } from "@/lib/utils/utils"
import { EducationalVideoPlayer } from "@/components/ui/educational-video-player"
import {
  isYouTubeUrl,
  isDirectVideoUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  getYouTubeThumbnailUrl,
} from "@/lib/utils/video-utils"

// ─── Metadata Helpers ────────────────────────────────────────────────────────

export interface MaterialMetadata {
  thumbnailUrl?: string
  duration?: string
  subtitleUrl?: string
  subtitleLang?: string
  subtitleLabel?: string
  transcript?: string
  status: "PUBLISHED" | "DRAFT"
}

export function parseMaterialMeta(rawDescription?: string | null): {
  cleanDescription: string
  meta: MaterialMetadata
} {
  const defaultMeta: MaterialMetadata = { status: "PUBLISHED" }
  if (!rawDescription) return { cleanDescription: "", meta: defaultMeta }

  const match = rawDescription.match(/^<!--BP_META:([\s\S]*?)-->([\s\S]*)$/)
  if (match) {
    try {
      const parsed = JSON.parse(match[1])
      return {
        cleanDescription: match[2] || "",
        meta: {
          ...defaultMeta,
          ...parsed,
          status: parsed.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
        },
      }
    } catch {
      // fallback
    }
  }

  return { cleanDescription: rawDescription, meta: defaultMeta }
}

export function serializeMaterialMeta(cleanDescription: string, meta: Partial<MaterialMetadata>): string {
  const payload = {
    thumbnailUrl: meta.thumbnailUrl || undefined,
    duration: meta.duration || undefined,
    subtitleUrl: meta.subtitleUrl || undefined,
    subtitleLang: meta.subtitleLang || undefined,
    subtitleLabel: meta.subtitleLabel || undefined,
    transcript: meta.transcript || undefined,
    status: meta.status || "PUBLISHED",
  }

  const hasExtra =
    payload.thumbnailUrl ||
    payload.duration ||
    payload.subtitleUrl ||
    payload.transcript ||
    payload.status === "DRAFT"

  if (!hasExtra) {
    return cleanDescription
  }

  return `<!--BP_META:${JSON.stringify(payload)}-->${cleanDescription}`
}

export function convertSrtToVtt(srtText: string): string {
  let vtt = srtText.replace(/\r\n|\r/g, "\n").trim()
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  return `WEBVTT\n\n${vtt}`
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const SUBTITLE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "am", label: "Amharic (አማርኛ)" },
  { code: "om", label: "Afaan Oromoo" },
  { code: "ti", label: "Tigrinya (ትግርኛ)" },
  { code: "so", label: "Somali" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "ar", label: "Arabic" },
]

export type FilterCategory = "ALL" | "VIDEOS" | "DOCUMENTS" | "PRESENTATIONS" | "LINKS"

export interface TeacherSharedMaterialsProps {
  materials: LearningMaterial[]
  onRefresh?: () => void
  classContext?: {
    gradeId?: string
    gradeName?: string
    sectionId?: string
    sectionName?: string
    subjectId?: string
    subjectName?: string
    academicYearName?: string
  }
  // If no fixed context is provided, allow selecting from available classes/subjects
  availableClasses?: Array<{
    gradeId: string
    gradeName: string
    sectionId?: string
    sectionName?: string
    subjectId: string
    subjectName: string
  }>
}

export function TeacherSharedMaterials({
  materials,
  onRefresh,
  classContext,
  availableClasses,
}: TeacherSharedMaterialsProps) {
  // ── State: Filters & View ──
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "size">("newest")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Selected class when in standalone mode
  const [activeClassIndex, setActiveClassIndex] = useState<number>(0)
  const currentContext = useMemo(() => {
    if (classContext?.gradeId && classContext?.subjectId) {
      return classContext
    }
    if (availableClasses && availableClasses.length > 0) {
      const c = availableClasses[activeClassIndex] || availableClasses[0]
      return {
        gradeId: c.gradeId,
        gradeName: c.gradeName,
        sectionId: c.sectionId,
        sectionName: c.sectionName,
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        academicYearName: classContext?.academicYearName,
      }
    }
    return classContext || {}
  }, [classContext, availableClasses, activeClassIndex])

  // ── Modals State ──
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LearningMaterial | null>(null)

  // Form Fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [materialType, setMaterialType] = useState<"VIDEO" | "DOC" | "SLIDES" | "LINK">("DOC")
  const [sourceType, setSourceType] = useState<"file" | "url">("file")
  const [fileUrl, setFileUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState("")
  const [thumbnailName, setThumbnailName] = useState("")
  const [duration, setDuration] = useState("")
  const [subtitleUrl, setSubtitleUrl] = useState("")
  const [subtitleName, setSubtitleName] = useState("")
  const [subtitleLang, setSubtitleLang] = useState("en")
  const [transcript, setTranscript] = useState("")
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED")

  // Upload simulation / reading state
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preview Modal
  const [previewMaterial, setPreviewMaterial] = useState<{
    material: LearningMaterial
    cleanDesc: string
    meta: MaterialMetadata
  } | null>(null)

  // Optimistic local view counts (keyed by material id)
  const [localViewCounts, setLocalViewCounts] = useState<Record<string, number>>({})

  // Opens preview and fires view increment
  const openPreview = (material: LearningMaterial, cleanDesc: string, meta: MaterialMetadata) => {
    setPreviewMaterial({ material, cleanDesc, meta })
    // Increment on backend silently
    learningMaterialClientService.incrementView(material.id)
    // Optimistically bump local count
    setLocalViewCounts((prev) => ({
      ...prev,
      [material.id]: (prev[material.id] ?? material.viewCount ?? 0) + 1,
    }))
  }

  // Video element ref for preview
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)

  // ── Helpers: Categorize Material ──
  const getCategory = (m: LearningMaterial): FilterCategory => {
    const rawType = (m.fileType || "").toUpperCase()
    const url = (m.fileUrl || "").toLowerCase()

    if (
      rawType === "VIDEO" ||
      isYouTubeUrl(m.fileUrl) ||
      isDirectVideoUrl(m.fileUrl) ||
      url.includes("vimeo.com")
    ) {
      return "VIDEOS"
    }
    if (rawType === "SLIDES" || rawType === "PPT" || rawType === "PPTX" || url.endsWith(".ppt") || url.endsWith(".pptx")) {
      return "PRESENTATIONS"
    }
    if (rawType === "LINK" || url.startsWith("http://") || (url.startsWith("https://") && !isYouTubeUrl(m.fileUrl) && !url.includes("vimeo") && !url.endsWith(".pdf") && !url.endsWith(".doc"))) {
      return "LINKS"
    }
    return "DOCUMENTS"
  }

  // ── Counts for Filters ──
  const counts = useMemo(() => {
    let all = materials.length
    let videos = 0
    let documents = 0
    let presentations = 0
    let links = 0

    materials.forEach((m) => {
      const cat = getCategory(m)
      if (cat === "VIDEOS") videos++
      else if (cat === "DOCUMENTS") documents++
      else if (cat === "PRESENTATIONS") presentations++
      else if (cat === "LINKS") links++
    })

    return { all, videos, documents, presentations, links }
  }, [materials])

  // ── Filter & Sort Materials ──
  const filteredMaterials = useMemo(() => {
    let result = materials.map((m) => {
      const { cleanDescription, meta } = parseMaterialMeta(m.description)
      return { material: m, cleanDescription, meta, category: getCategory(m) }
    })

    // Category filter
    if (selectedCategory !== "ALL") {
      result = result.filter((item) => item.category === selectedCategory)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.material.title.toLowerCase().includes(q) ||
          item.cleanDescription.toLowerCase().includes(q) ||
          (item.material.subject?.name || "").toLowerCase().includes(q) ||
          (item.meta.transcript || "").toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.material.createdAt).getTime() - new Date(a.material.createdAt).getTime()
      }
      if (sortBy === "oldest") {
        return new Date(a.material.createdAt).getTime() - new Date(b.material.createdAt).getTime()
      }
      if (sortBy === "title") {
        return a.material.title.localeCompare(b.material.title)
      }
      if (sortBy === "size") {
        return (b.material.fileSize || 0) - (a.material.fileSize || 0)
      }
      return 0
    })

    return result
  }, [materials, selectedCategory, searchQuery, sortBy])

  // ── Reset Form ──
  const resetForm = () => {
    setEditingItem(null)
    setTitle("")
    setDescription("")
    setMaterialType("DOC")
    setSourceType("file")
    setFileUrl("")
    setFileName("")
    setFileSize(null)
    setThumbnailUrl("")
    setThumbnailName("")
    setDuration("")
    setSubtitleUrl("")
    setSubtitleName("")
    setSubtitleLang("en")
    setTranscript("")
    setStatus("PUBLISHED")
    setUploadProgress(0)
    setIsReadingFile(false)
  }

  // ── Open Edit Form ──
  const handleOpenEdit = (m: LearningMaterial) => {
    const { cleanDescription, meta } = parseMaterialMeta(m.description)
    setEditingItem(m)
    setTitle(m.title)
    setDescription(cleanDescription)

    const rawType = (m.fileType || "DOC").toUpperCase()
    if (rawType === "VIDEO" || getCategory(m) === "VIDEOS") setMaterialType("VIDEO")
    else if (rawType === "SLIDES" || getCategory(m) === "PRESENTATIONS") setMaterialType("SLIDES")
    else if (rawType === "LINK" || getCategory(m) === "LINKS") setMaterialType("LINK")
    else setMaterialType("DOC")

    setFileUrl(m.fileUrl || "")
    setFileName(m.fileUrl?.startsWith("data:") ? `${m.title}.${rawType.toLowerCase()}` : "")
    setFileSize(m.fileSize || null)
    setSourceType(m.fileUrl?.startsWith("data:") ? "file" : "url")

    setThumbnailUrl(meta.thumbnailUrl || "")
    setDuration(meta.duration || "")
    setSubtitleUrl(meta.subtitleUrl || "")
    setSubtitleLang(meta.subtitleLang || "en")
    setTranscript(meta.transcript || "")
    setStatus(meta.status || "PUBLISHED")

    setIsFormOpen(true)
  }

  // ── Handle Main File Upload ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 50MB check
    if (file.size > 50 * 1024 * 1024) {
      notifications.error("File Too Large", "Maximum supported file size for direct upload is 50MB. For larger videos, consider pasting a Google Drive or YouTube link.")
      return
    }

    setIsReadingFile(true)
    setUploadProgress(15)
    setFileName(file.name)
    setFileSize(file.size)

    // Auto-detect type
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
      setMaterialType("VIDEO")
    } else if (["ppt", "pptx", "key"].includes(ext)) {
      setMaterialType("SLIDES")
    } else if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx"].includes(ext)) {
      setMaterialType("DOC")
    }

    // Auto title if empty
    if (!title.trim()) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
      setTitle(nameWithoutExt.replace(/[-_]/g, " "))
    }

    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 90)
        setUploadProgress(Math.max(20, percent))
      }
    }
    reader.onload = () => {
      const resultDataUrl = reader.result as string
      setFileUrl(resultDataUrl)
      setUploadProgress(100)
      setIsReadingFile(false)

      // If it's a video, attempt duration auto-detection
      if (file.type.startsWith("video/")) {
        const tempVideo = document.createElement("video")
        tempVideo.preload = "metadata"
        tempVideo.src = resultDataUrl
        tempVideo.onloadedmetadata = () => {
          const secs = Math.round(tempVideo.duration)
          const mins = Math.floor(secs / 60)
          const remainingSecs = secs % 60
          const formatted = `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`
          if (!duration) setDuration(formatted)
        }
      }
    }
    reader.onerror = () => {
      notifications.error("File Error", "Could not read the selected file.")
      setIsReadingFile(false)
      setUploadProgress(0)
    }
    reader.readAsDataURL(file)
  }

  // ── Handle Thumbnail Upload ──
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setThumbnailName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setThumbnailUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // ── Handle Subtitles Upload ──
  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSubtitleName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const content = reader.result as string
      let vttContent = content
      if (file.name.toLowerCase().endsWith(".srt")) {
        vttContent = convertSrtToVtt(content)
      } else if (!vttContent.startsWith("WEBVTT")) {
        vttContent = `WEBVTT\n\n${vttContent}`
      }
      const dataUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`
      setSubtitleUrl(dataUrl)
      notifications.success("Captions Ready", `Subtitles parsed for ${file.name}`)
    }
    reader.readAsText(file)
  }

  // ── Handle Submit (Create or Update) ──
  const handleSubmit = async (submitStatus: "PUBLISHED" | "DRAFT") => {
    if (!title.trim()) {
      notifications.error("Validation Error", "Material Title is required.")
      return
    }
    if (!fileUrl.trim()) {
      notifications.error(
        "Validation Error",
        sourceType === "file" ? "Please select a file to upload." : "Resource URL is required."
      )
      return
    }

    const targetGradeId = currentContext.gradeId
    const targetSubjectId = currentContext.subjectId

    if (!targetGradeId || !targetSubjectId) {
      notifications.error("Class Context Missing", "Please select a class and subject for this material.")
      return
    }

    try {
      setIsSubmitting(true)

      const finalDescription = serializeMaterialMeta(description.trim(), {
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        duration: duration.trim() || undefined,
        subtitleUrl: subtitleUrl || undefined,
        subtitleLang: subtitleUrl ? subtitleLang : undefined,
        subtitleLabel: subtitleUrl
          ? SUBTITLE_LANGUAGES.find((l) => l.code === subtitleLang)?.label || "English"
          : undefined,
        transcript: transcript.trim() || undefined,
        status: submitStatus,
      })

      const payload = {
        title: title.trim(),
        description: finalDescription,
        gradeId: targetGradeId,
        subjectId: targetSubjectId,
        fileUrl: fileUrl.trim(),
        fileType: materialType,
        fileSize: fileSize || undefined,
      }

      if (editingItem) {
        await learningMaterialClientService.update(editingItem.id, payload)
        notifications.success("Updated", `Material "${title}" updated successfully.`)
      } else {
        await learningMaterialClientService.create(payload)
        notifications.success(
          submitStatus === "PUBLISHED" ? "Published!" : "Draft Saved",
          `Material "${title}" ${submitStatus === "PUBLISHED" ? "is now live for students" : "saved as draft"}.`
        )
      }

      setIsFormOpen(false)
      resetForm()
      if (onRefresh) onRefresh()
    } catch (error: any) {
      console.error("Failed to save material:", error)
      notifications.error("Submission Failed", error.message || "Could not save material.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Handle Delete ──
  const handleDelete = async (id: string, matTitle: string) => {
    if (!confirm(`Are you sure you want to remove "${matTitle}"? Students will no longer have access.`)) {
      return
    }

    try {
      await learningMaterialClientService.delete(id)
      notifications.success("Removed", "Material deleted successfully.")
      if (onRefresh) onRefresh()
    } catch (error: any) {
      notifications.error("Delete Failed", error.message || "Could not delete material.")
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER & CLASS CONTEXT CARD ─── */}
      <div className="rounded-3xl border border-purple-200/70 dark:border-purple-900/40 bg-gradient-to-r from-purple-500/10 via-white dark:via-slate-900 to-indigo-500/10 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-600 text-white shadow-xs">
                <BookOpen className="w-3.5 h-3.5" />
                Shared Materials
              </span>

              {currentContext.gradeName && (
                <Badge variant="outline" className="rounded-full border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-xs bg-purple-50 dark:bg-purple-950/40">
                  {currentContext.gradeName} {currentContext.sectionName ? `• ${currentContext.sectionName}` : ""}
                </Badge>
              )}

              {currentContext.subjectName && (
                <Badge variant="outline" className="rounded-full border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs bg-indigo-50 dark:bg-indigo-950/40">
                  {currentContext.subjectName}
                </Badge>
              )}

              {currentContext.academicYearName && (
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {currentContext.academicYearName}
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Class Educational Resources
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
              Publish video lessons, lecture slides, worksheets, and study links directly to enrolled students.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {availableClasses && availableClasses.length > 1 && (
              <Select
                value={String(activeClassIndex)}
                onValueChange={(val) => setActiveClassIndex(Number(val))}
              >
                <SelectTrigger className="w-[200px] rounded-2xl border-purple-200 dark:border-purple-900 bg-white dark:bg-slate-900 text-xs font-semibold">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {availableClasses.map((c, idx) => (
                    <SelectItem key={`${c.gradeId}-${c.subjectId}-${idx}`} value={String(idx)} className="text-xs">
                      {c.gradeName} {c.sectionName ? `(${c.sectionName})` : ""} — {c.subjectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={() => {
                resetForm()
                setIsFormOpen(true)
              }}
              className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 px-4 shadow-md shadow-purple-600/25 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Share Material
            </Button>
          </div>
        </div>
      </div>

      {/* ─── CONTROLS: CATEGORY TABS & SEARCH / SORT / VIEW ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Material Type Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              selectedCategory === "ALL"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            )}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            All ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("VIDEOS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              selectedCategory === "VIDEOS"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            )}
          >
            <Video className="w-3.5 h-3.5 text-purple-400" />
            Videos ({counts.videos})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("DOCUMENTS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              selectedCategory === "DOCUMENTS"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Documents ({counts.documents})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("PRESENTATIONS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              selectedCategory === "PRESENTATIONS"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            )}
          >
            <Presentation className="w-3.5 h-3.5 text-amber-400" />
            Presentations ({counts.presentations})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("LINKS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              selectedCategory === "LINKS"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            )}
          >
            <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
            Links ({counts.links})
          </button>
        </div>

        {/* Search, Sort, View Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search title, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs rounded-xl border-border bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="h-9 w-[130px] rounded-xl text-xs font-semibold border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest" className="text-xs">Newest Added</SelectItem>
              <SelectItem value="oldest" className="text-xs">Oldest First</SelectItem>
              <SelectItem value="title" className="text-xs">Title (A - Z)</SelectItem>
              <SelectItem value="size" className="text-xs">File Size</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border border-border rounded-xl p-0.5 bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("grid")}
              className={cn("w-7 h-7 rounded-lg", viewMode === "grid" ? "bg-muted text-purple-600" : "text-muted-foreground")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={cn("w-7 h-7 rounded-lg", viewMode === "list" ? "bg-muted text-purple-600" : "text-muted-foreground")}
            >
              <List className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── MATERIALS LISTING / EMPTY STATE ─── */}
      {filteredMaterials.length === 0 ? (
        <Card className="rounded-3xl border-2 border-dashed border-purple-200/60 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10 p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No Materials Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
            {searchQuery
              ? `No resources matching "${searchQuery}" in this category.`
              : `You haven't shared any ${selectedCategory !== "ALL" ? selectedCategory.toLowerCase() : "materials"} for this class yet.`}
          </p>
          <Button
            onClick={() => {
              resetForm()
              setIsFormOpen(true)
            }}
            className="mt-5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            Share Your First Resource
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* ─── GRID VIEW ─── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredMaterials.map(({ material: m, cleanDescription, meta, category }) => {
            const isVideo = category === "VIDEOS"
            const isDoc = category === "DOCUMENTS"
            const isSlides = category === "PRESENTATIONS"
            const isLink = category === "LINKS"
            const isDraft = meta.status === "DRAFT"
            const [menuOpen, setMenuOpen] = useState(false)

            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-2xl border border-border/60 bg-card hover:border-purple-400/60 hover:shadow-md transition-all flex flex-col overflow-hidden group cursor-pointer relative",
                  isDraft && "opacity-85 border-dashed border-amber-400/50"
                )}
                onClick={() => openPreview(m, cleanDescription, meta)}
              >
                {/* Visual Thumbnail or Icon Hero */}
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
                        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        </div>
                      </div>
                    </div>
                  ) : isVideo ? (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/40 via-purple-700/20 to-slate-900 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
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

                  {/* Type Badge top-left */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide",
                        isVideo && "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
                        isDoc && "bg-red-100 text-red-700 dark:bg-blue-900/60 dark:text-blue-300",
                        isSlides && "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
                        isLink && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                      )}
                    >
                      {isVideo ? "Video" : isSlides ? "Document" : isLink ? "Link" : "Document"}
                    </span>
                    {isDraft && (
                      <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        Draft
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

                  {/* Three-dot menu — top right */}
                  <div
                    className="absolute top-2 right-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="w-6 h-6 rounded-md flex items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-xs transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {menuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-white dark:bg-slate-900 shadow-lg py-1 text-xs">
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-foreground hover:text-purple-700"
                              onClick={() => { setMenuOpen(false); handleOpenEdit(m) }}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit material
                            </button>

                            {m.fileUrl && (
                              <a
                                href={m.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={m.fileUrl.startsWith("data:") ? m.title : undefined}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-foreground hover:text-blue-700"
                                onClick={() => setMenuOpen(false)}
                              >
                                {m.fileUrl.startsWith("data:") ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                {m.fileUrl.startsWith("data:") ? "Download" : "Open link"}
                              </a>
                            )}

                            <div className="border-t border-border/50 my-0.5" />

                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 hover:text-red-700"
                              onClick={() => { setMenuOpen(false); handleDelete(m.id, m.title) }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-3 flex-1 flex flex-col gap-1.5">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {m.title}
                  </h3>

                  {cleanDescription && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {cleanDescription}
                    </p>
                  )}

                  {/* Metadata footer */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-md text-[10px]">
                        <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        {(localViewCounts[m.id] ?? m.viewCount ?? 0).toLocaleString()} views
                      </span>
                      {m.fileSize && (
                        <span className="font-medium">{formatBytes(m.fileSize)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="space-y-2">
          {filteredMaterials.map(({ material: m, cleanDescription, meta, category }) => {
            const isVideo = category === "VIDEOS"
            const isDoc = category === "DOCUMENTS"
            const isSlides = category === "PRESENTATIONS"
            const isLink = category === "LINKS"
            const isDraft = meta.status === "DRAFT"

            const iconBg = isVideo
              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              : isSlides
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              : isLink
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-red-100 dark:bg-blue-900/30 text-red-500 dark:text-blue-400"

            return (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl border border-border/60 bg-card hover:border-purple-400/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer"
                onClick={() => openPreview(m, cleanDescription, meta)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
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
                      {isDraft && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          Draft
                        </span>
                      )}
                      {meta.subtitleUrl && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center gap-0.5">
                          <Subtitles className="w-2.5 h-2.5" /> CC
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.createdAt).toLocaleDateString()}</span>
                      {meta.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meta.duration}</span>}
                      {m.fileSize && <span>• {formatBytes(m.fileSize)}</span>}
                      <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-md text-[11px]">
                        <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        {(localViewCounts[m.id] ?? m.viewCount ?? 0).toLocaleString()} views
                      </span>
                      {cleanDescription && <span className="truncate max-w-[240px] hidden md:inline">• {cleanDescription}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions – stop propagation so they don't trigger preview */}
                <div
                  className="flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleOpenEdit(m)}
                    title="Edit"
                    className="rounded-xl w-8 h-8 text-muted-foreground hover:text-purple-600 hover:border-purple-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>

                  {m.fileUrl && (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={m.fileUrl.startsWith("data:") ? m.title : undefined}
                      title={m.fileUrl.startsWith("data:") ? "Download" : "Open link"}
                      className="inline-flex items-center justify-center rounded-xl w-8 h-8 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {m.fileUrl.startsWith("data:") ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    </a>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(m.id, m.title)}
                    title="Delete"
                    className="rounded-xl w-8 h-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── MODAL 1: SHARE / EDIT MATERIAL FORM ─── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              <div>
                <DialogTitle className="text-xl font-black">
                  {editingItem ? "Edit Learning Material" : "Share Learning Material"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {currentContext.gradeName ? (
                    <span>
                      Targeting: <strong>{currentContext.gradeName}</strong> {currentContext.sectionName ? `(${currentContext.sectionName})` : ""} • <strong>{currentContext.subjectName}</strong>
                    </span>
                  ) : (
                    "Publish learning resources for your students."
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Material Title *</Label>
              <Input
                placeholder="e.g. Chapter 4: Newton's Laws of Motion - Lecture & Examples"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>

            {/* Type Selector (Pill tabs) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Material Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "DOC", label: "Document", icon: FileText, color: "text-blue-500" },
                  { id: "VIDEO", label: "Video Lesson", icon: Video, color: "text-purple-500" },
                  { id: "SLIDES", label: "Presentation", icon: Presentation, color: "text-amber-500" },
                  { id: "LINK", label: "External Link", icon: LinkIcon, color: "text-emerald-500" },
                ].map((t) => {
                  const Icon = t.icon
                  const active = materialType === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMaterialType(t.id as any)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all",
                        active
                          ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:border-purple-300"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", t.color)} />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content Source Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Content Source *</Label>
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSourceType("file")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all",
                      sourceType === "file" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground"
                    )}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType("url")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all",
                      sourceType === "url" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground"
                    )}
                  >
                    Web / Video URL
                  </button>
                </div>
              </div>

              {sourceType === "file" ? (
                <div>
                  {fileName ? (
                    <div className="p-3.5 rounded-2xl border border-purple-300 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                          <Check className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{fileName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatBytes(fileSize)} • Attached
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFileUrl("")
                          setFileName("")
                          setFileSize(null)
                        }}
                        className="text-xs text-muted-foreground hover:text-red-500 rounded-xl h-8"
                      >
                        Replace
                      </Button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-purple-200 dark:border-purple-900/60 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors group bg-purple-50/10 hover:bg-purple-50/20">
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          materialType === "VIDEO"
                            ? ".mp4,.mov,.webm,.mkv,.avi"
                            : materialType === "SLIDES"
                            ? ".ppt,.pptx,.pdf"
                            : ".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.mp4"
                        }
                        onChange={handleFileUpload}
                      />
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        {isReadingFile ? <Spinner className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className="text-xs font-bold text-foreground">Click to browse or drop file here</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        Supports {materialType === "VIDEO" ? "MP4, MOV, WebM" : "PDF, Word, Slides, Sheets"} (up to 50MB)
                      </span>

                      {isReadingFile && (
                        <div className="w-full max-w-xs mt-3">
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-center text-muted-foreground mt-1">
                            Processing file ({uploadProgress}%)...
                          </p>
                        </div>
                      )}
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="https://... (e.g. YouTube, Vimeo, Google Drive, or article link)"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Direct video URLs, YouTube, or Google Drive links with public viewing permissions.
                  </p>
                </div>
              )}
            </div>

            {/* ─── DEDICATED VIDEO LESSON CONTROLS ─── */}
            {materialType === "VIDEO" && (
              <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                    <Video className="w-4 h-4" />
                    Video Lesson Settings
                  </div>
                  {duration && (
                    <Badge variant="outline" className="text-[10px] font-bold border-purple-300 text-purple-700">
                      Duration: {duration}
                    </Badge>
                  )}
                </div>

                {/* Video In-Modal Preview */}
                {fileUrl && (
                  <div className="rounded-xl overflow-hidden bg-black/90 aspect-video max-h-48 flex items-center justify-center relative">
                    {fileUrl.startsWith("data:video") || fileUrl.endsWith(".mp4") || fileUrl.endsWith(".webm") ? (
                      <video
                        ref={videoPreviewRef}
                        src={fileUrl}
                        controls
                        className="w-full h-full object-contain"
                      >
                        {subtitleUrl && (
                          <track
                            src={subtitleUrl}
                            kind="subtitles"
                            srcLang={subtitleLang}
                            label={SUBTITLE_LANGUAGES.find((l) => l.code === subtitleLang)?.label || "English"}
                            default
                          />
                        )}
                      </video>
                    ) : (
                      <div className="p-4 text-center text-xs text-white/80 space-y-1">
                        <Play className="w-8 h-8 text-purple-400 mx-auto" />
                        <p className="font-bold">External Video Link Attached</p>
                        <p className="text-[11px] text-white/60 truncate max-w-sm">{fileUrl}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration & Thumbnail Input Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Video Duration</Label>
                    <Input
                      placeholder="e.g. 14:30"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="rounded-xl h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Cover Thumbnail</Label>
                    <label className="border border-border hover:border-purple-400 rounded-xl px-2.5 h-8 flex items-center justify-between cursor-pointer text-xs bg-background text-muted-foreground truncate">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                      />
                      <span className="truncate">{thumbnailName || "Upload Image"}</span>
                      <Upload className="w-3.5 h-3.5 shrink-0 ml-1" />
                    </label>
                  </div>
                </div>

                {/* Subtitles & Captions */}
                <div className="space-y-2 pt-1 border-t border-purple-200/50 dark:border-purple-900/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                      <Subtitles className="w-3.5 h-3.5 text-purple-600" />
                      Subtitles / Captions (SRT or VTT)
                    </Label>
                    {subtitleUrl && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Attached ({subtitleName || "VTT"})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="border border-border hover:border-purple-400 rounded-xl px-3 h-8 flex items-center justify-between cursor-pointer text-xs bg-background text-muted-foreground truncate">
                      <input
                        type="file"
                        className="hidden"
                        accept=".vtt,.srt"
                        onChange={handleSubtitleUpload}
                      />
                      <span className="truncate">{subtitleName || "Upload .VTT or .SRT file"}</span>
                      <Upload className="w-3.5 h-3.5 shrink-0 ml-1" />
                    </label>

                    <Select value={subtitleLang} onValueChange={setSubtitleLang}>
                      <SelectTrigger className="h-8 rounded-xl text-xs bg-background border-border">
                        <SelectValue placeholder="Subtitle Language" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {SUBTITLE_LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code} className="text-xs">
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {subtitleUrl && (
                    <div className="flex items-center justify-between text-[11px] bg-purple-100/50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg">
                      <span className="text-purple-700 dark:text-purple-300 font-medium">
                        Subtitles active in player for {SUBTITLE_LANGUAGES.find((l) => l.code === subtitleLang)?.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSubtitleUrl("")
                          setSubtitleName("")
                        }}
                        className="text-red-500 hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Transcript */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Lesson Transcript (Optional)</Label>
                  <Textarea
                    placeholder="Paste or write the video lecture transcript for accessibility..."
                    rows={2}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="rounded-xl text-xs bg-background resize-none"
                  />
                </div>
              </div>
            )}

            {/* Description / Instructions */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Notes & Study Instructions</Label>
              <Textarea
                placeholder="Guidance for students regarding this material, homework references, or exam prep..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2 items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              className="rounded-2xl text-xs w-full sm:w-auto"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleSubmit("DRAFT")}
                className="rounded-2xl text-xs font-semibold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex-1 sm:flex-initial"
              >
                Save as Draft
              </Button>

              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit("PUBLISHED")}
                className="rounded-2xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 flex-1 sm:flex-initial"
              >
                {isSubmitting ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
                {editingItem ? "Save Changes" : "Publish Material"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: FULL PREVIEW & VIDEO PLAYER ─── */}
      <Dialog open={!!previewMaterial} onOpenChange={(open) => !open && setPreviewMaterial(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
          {previewMaterial && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider bg-purple-600 text-white">
                      {previewMaterial.material.fileType || "RESOURCE"}
                    </span>
                    {previewMaterial.meta.status === "DRAFT" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider bg-amber-500 text-white">
                        Draft
                      </span>
                    )}
                    {previewMaterial.meta.duration && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {previewMaterial.meta.duration}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
                      <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      {(localViewCounts[previewMaterial.material.id] ?? previewMaterial.material.viewCount ?? 0).toLocaleString()} student views
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-black text-foreground">
                    {previewMaterial.material.title}
                  </DialogTitle>
                </div>

                <div className="flex items-center gap-1.5">
                  {previewMaterial.material.fileUrl && (
                    <a
                      href={previewMaterial.material.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewMaterial.material.fileUrl.startsWith("data:") ? previewMaterial.material.title : undefined}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      {previewMaterial.material.fileUrl.startsWith("data:") ? (
                        <>
                          <Download className="w-3.5 h-3.5" /> Download
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" /> Open Link
                        </>
                      )}
                    </a>
                  )}
                </div>
              </div>

              {/* Player / Viewer Box */}
              {previewMaterial.material.fileUrl && (
                isYouTubeUrl(previewMaterial.material.fileUrl) || isDirectVideoUrl(previewMaterial.material.fileUrl) ? (
                  <EducationalVideoPlayer
                    fileUrl={previewMaterial.material.fileUrl}
                    title={previewMaterial.material.title}
                    thumbnailUrl={previewMaterial.meta.thumbnailUrl}
                    subtitleUrl={previewMaterial.meta.subtitleUrl}
                    subtitleLang={previewMaterial.meta.subtitleLang}
                    subtitleLabel={previewMaterial.meta.subtitleLabel}
                    autoPlay
                    showExternalAction
                  />
                ) : (
                  <div className="rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center relative shadow-lg">
                    <div className="p-8 text-center text-white space-y-3">
                      <FileText className="w-16 h-16 text-purple-400 mx-auto" />
                      <div>
                        <h4 className="font-bold text-base">{previewMaterial.material.title}</h4>
                        <p className="text-xs text-white/70 mt-1">
                          {formatBytes(previewMaterial.material.fileSize)}
                        </p>
                      </div>
                      <a
                        href={previewMaterial.material.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={previewMaterial.material.fileUrl.startsWith("data:") ? previewMaterial.material.title : undefined}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                      >
                        <Download className="w-4 h-4" /> Download & View Document
                      </a>
                    </div>
                  </div>
                )
              )}

              {/* Subtitles & Captions Information */}
              {previewMaterial.meta.subtitleUrl && (
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Subtitles className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-indigo-950 dark:text-indigo-200">
                      Closed Captions available: {previewMaterial.meta.subtitleLabel || "English"}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Toggle in player (CC)</span>
                </div>
              )}

              {/* Description */}
              {previewMaterial.cleanDesc && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Teacher Instructions & Notes:</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-2xl border border-border/40 whitespace-pre-wrap">
                    {previewMaterial.cleanDesc}
                  </p>
                </div>
              )}

              {/* Transcript Accordion */}
              {previewMaterial.meta.transcript && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Full Lecture Transcript:</h4>
                  <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground bg-muted/40 p-3 rounded-2xl border border-border/50 whitespace-pre-wrap leading-relaxed font-mono">
                    {previewMaterial.meta.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
