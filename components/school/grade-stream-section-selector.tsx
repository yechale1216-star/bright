"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, AlertTriangle, Layers, Plus } from "lucide-react"
import { db } from "@/lib/db/database"
import { cn } from "@/lib/utils/utils"
import Link from "next/link"

export interface GradeItem {
  id: string
  name: string
  level?: number
}

export interface StreamItem {
  id: string
  name: string
}

export interface SectionItem {
  id: string
  name: string
  gradeId?: string
  streamId?: string | null
  grade?: { id: string; name: string }
  stream?: { id: string; name: string } | null
}

export function isGrade11or12Grade(gradeName?: string): boolean {
  if (!gradeName) return false
  const trimmed = gradeName.trim()
  return (
    /\b(11|12)\b/.test(trimmed) ||
    trimmed.toLowerCase().includes("11") ||
    trimmed.toLowerCase().includes("12")
  )
}

export interface GradeStreamSectionSelectorProps {
  // Current values
  gradeId: string
  streamId?: string
  sectionId: string

  // Change handlers
  onGradeChange: (gradeId: string) => void
  onStreamChange?: (streamId: string) => void
  onSectionChange: (sectionId: string) => void

  // Optional externally supplied lists (if omitted, fetched from db)
  grades?: GradeItem[]
  streams?: StreamItem[]
  sections?: SectionItem[]

  // Modes & options
  includeAllOption?: boolean
  allGradeLabel?: string
  allStreamLabel?: string
  allSectionLabel?: string
  required?: boolean
  disabled?: boolean
  className?: string
  layout?: "horizontal" | "vertical" | "grid"
  size?: "default" | "sm"
  showCreatePrompt?: boolean
  autoSelectFirstSection?: boolean
}

export function GradeStreamSectionSelector({
  gradeId,
  streamId = "",
  sectionId,
  onGradeChange,
  onStreamChange,
  onSectionChange,
  grades: propGrades,
  streams: propStreams,
  sections: propSections,
  includeAllOption = false,
  allGradeLabel = "All Grades",
  allStreamLabel = "All Streams",
  allSectionLabel = "All Sections",
  required = true,
  disabled = false,
  className = "",
  layout = "grid",
  size = "default",
  showCreatePrompt = true,
  autoSelectFirstSection = false,
}: GradeStreamSectionSelectorProps) {
  const [internalGrades, setInternalGrades] = useState<GradeItem[]>([])
  const [internalStreams, setInternalStreams] = useState<StreamItem[]>([])
  const [internalSections, setInternalSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(false)

  // Load options if not provided via props
  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        setLoading(true)
        const [gList, strList, secList] = await Promise.all([
          propGrades ? Promise.resolve(propGrades) : db.getGrades().catch(() => []),
          propStreams ? Promise.resolve(propStreams) : db.getStreams().catch(() => []),
          propSections ? Promise.resolve(propSections) : db.getSections().catch(() => []),
        ])
        if (isMounted) {
          if (!propGrades) setInternalGrades(gList || [])
          if (!propStreams) setInternalStreams(strList || [])
          if (!propSections) setInternalSections(secList || [])
        }
      } catch (err) {
        console.error("Failed to load academic structure for selector:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [propGrades, propStreams, propSections])

  const grades = propGrades || internalGrades
  const streams = propStreams || internalStreams
  const sections = propSections || internalSections

  // Find selected grade object
  const selectedGrade = useMemo(() => {
    return grades.find((g) => g.id === gradeId)
  }, [grades, gradeId])

  // Is Grade 11 or 12
  const isHighSchoolTrack = useMemo(() => {
    return isGrade11or12Grade(selectedGrade?.name)
  }, [selectedGrade])

  // Filter sections strictly to selected grade & stream
  const availableSections = useMemo(() => {
    if (!gradeId || (gradeId === "all" && includeAllOption)) {
      return includeAllOption ? sections : []
    }

    return sections.filter((s) => {
      // Must match gradeId
      if (s.gradeId && s.gradeId !== gradeId) return false

      // If Grade 11 or 12, must match stream if stream is specified
      if (isHighSchoolTrack) {
        if (!streamId || streamId === "all") {
          return true
        }
        return s.streamId === streamId
      }

      // For standard grades, section must belong to this grade with no stream or matching
      return !s.streamId || s.gradeId === gradeId
    })
  }, [sections, gradeId, streamId, isHighSchoolTrack, includeAllOption])

  // Handle grade change with cascading reset
  const handleGradeSelect = (val: string) => {
    onGradeChange(val)
    if (onStreamChange) {
      onStreamChange("")
    }
    onSectionChange("")
  }

  // Handle stream change with cascading reset
  const handleStreamSelect = (val: string) => {
    if (onStreamChange) {
      onStreamChange(val)
    }
    onSectionChange("")
  }

  // Auto-select first section if requested
  useEffect(() => {
    if (
      autoSelectFirstSection &&
      availableSections.length > 0 &&
      (!sectionId || sectionId === "")
    ) {
      onSectionChange(availableSections[0].id)
    }
  }, [autoSelectFirstSection, availableSections, sectionId, onSectionChange])

  // Grid / layout classes
  const containerClasses = cn(
    layout === "grid" && "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
    layout === "horizontal" && "flex flex-wrap items-center gap-2.5",
    layout === "vertical" && "space-y-3",
    className
  )

  const isStreamRequired = isHighSchoolTrack && gradeId !== "all"
  const isSectionDisabled = disabled || !gradeId || (gradeId !== "all" && isStreamRequired && !streamId)

  return (
    <div className={containerClasses}>
      {/* 1. GRADE SELECTOR */}
      <div className={layout === "horizontal" ? "w-44" : "space-y-1.5"}>
        <Label className="text-xs font-semibold flex items-center justify-between">
          <span>Grade {required && <span className="text-destructive">*</span>}</span>
        </Label>
        <Select
          value={gradeId || (includeAllOption ? "all" : undefined)}
          onValueChange={handleGradeSelect}
          disabled={disabled || loading}
        >
          <SelectTrigger className={cn("rounded-xl text-xs", size === "sm" ? "h-9" : "h-10")}>
            <SelectValue placeholder="Select Grade" />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-60">
            {includeAllOption && (
              <SelectItem value="all" className="text-xs font-semibold">
                {allGradeLabel}
              </SelectItem>
            )}
            {grades.map((g) => (
              <SelectItem key={g.id} value={g.id} className="text-xs">
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. STREAM SELECTOR (Only rendered for Grade 11 or 12 or if includeAllOption on filter) */}
      {(isHighSchoolTrack || (includeAllOption && gradeId === "all")) && (
        <div className={layout === "horizontal" ? "w-48" : "space-y-1.5"}>
          <Label className="text-xs font-semibold flex items-center justify-between">
            <span>
              Stream{" "}
              {isStreamRequired && required && (
                <span className="text-destructive">* (Grades 11-12)</span>
              )}
            </span>
          </Label>
          <Select
            value={streamId || (includeAllOption && !isStreamRequired ? "all" : undefined)}
            onValueChange={handleStreamSelect}
            disabled={disabled || !gradeId || loading}
          >
            <SelectTrigger
              className={cn(
                "rounded-xl text-xs",
                size === "sm" ? "h-9" : "h-10",
                isStreamRequired && !streamId && "border-amber-400 focus:ring-amber-500/20"
              )}
            >
              <SelectValue
                placeholder={isStreamRequired ? "Select Stream *" : "Choose Stream"}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {includeAllOption && (
                <SelectItem value="all" className="text-xs font-semibold">
                  {allStreamLabel}
                </SelectItem>
              )}
              {streams.map((str) => (
                <SelectItem key={str.id} value={str.id} className="text-xs">
                  {str.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 3. SECTION SELECTOR (Filtered strictly to Grade and Stream) */}
      <div className={layout === "horizontal" ? "w-44" : "space-y-1.5"}>
        <Label className="text-xs font-semibold flex items-center justify-between">
          <span>Section {required && <span className="text-destructive">*</span>}</span>
        </Label>
        <Select
          value={sectionId || (includeAllOption ? "all" : undefined)}
          onValueChange={onSectionChange}
          disabled={isSectionDisabled || loading}
        >
          <SelectTrigger className={cn("rounded-xl text-xs", size === "sm" ? "h-9" : "h-10")}>
            <SelectValue
              placeholder={
                !gradeId
                  ? "Select Grade first"
                  : isStreamRequired && !streamId
                  ? "Select Stream first"
                  : "Select Section"
              }
            />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-60">
            {includeAllOption && (
              <SelectItem value="all" className="text-xs font-semibold">
                {allSectionLabel}
              </SelectItem>
            )}
            {availableSections.length === 0 ? (
              <SelectItem value="empty_none" disabled className="text-xs text-muted-foreground italic">
                No sections registered
              </SelectItem>
            ) : (
              availableSections.map((sec) => (
                <SelectItem key={sec.id} value={sec.id} className="text-xs">
                  {sec.name.toLowerCase().startsWith("section") ? sec.name : `Section ${sec.name}`}
                  {isHighSchoolTrack && sec.stream?.name ? ` (${sec.stream.name})` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Warning if no sections exist for this academic unit */}
        {showCreatePrompt &&
          gradeId &&
          gradeId !== "all" &&
          (!isStreamRequired || streamId) &&
          availableSections.length === 0 &&
          !loading && (
            <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span>No sections found for this grade/stream. </span>
                <Link
                  href="/school/admin/academic-structure?tab=sections"
                  className="font-bold underline text-amber-800 dark:text-amber-300 hover:text-primary"
                >
                  Create section in Academic Structure
                </Link>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
