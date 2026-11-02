"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Trophy, Calendar, ChevronDown, RefreshCw, AlertCircle, Users
} from "lucide-react"
import { gradebookService, type RankedStudent, type TopPerformingResponse } from "@/lib/gradebook-service"
import { cn } from "@/lib/utils/utils"

type GradeCategory = "1-4" | "5-8" | "9-12"

interface TopPerformingStudentsProps {
  className?: string
  initialAcademicYearId?: string
  initialAcademicTermId?: string
}

export function TopPerformingStudents({
  className,
  initialAcademicYearId,
  initialAcademicTermId,
}: TopPerformingStudentsProps) {
  const [activeCategory, setActiveCategory] = useState<GradeCategory>("1-4")
  const [selectedYearId, setSelectedYearId] = useState<string>(initialAcademicYearId || "")
  const [selectedTermId, setSelectedTermId] = useState<string>(initialAcademicTermId || "all")
  const [data, setData] = useState<TopPerformingResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch top performing students
  const loadData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true)
      setError(null)

      const result = await gradebookService.getTopPerformingStudents({
        academicYearId: selectedYearId && selectedYearId !== "all" ? selectedYearId : undefined,
        academicTermId: selectedTermId && selectedTermId !== "all" ? selectedTermId : undefined,
      })

      setData(result)

      // Set default year if not selected yet
      if (!selectedYearId && result?.availableYears && result.availableYears.length > 0) {
        const currentYear = result.availableYears.find((y) => y.isCurrent) || result.availableYears[0]
        if (currentYear) {
          setSelectedYearId(currentYear.id)
        }
      }
    } catch (err: any) {
      console.error("Error loading top performing students:", err)
      setError(err?.message || "Failed to load student performance data")
    } finally {
      setIsLoading(false)
    }
  }, [selectedYearId, selectedTermId])

  useEffect(() => {
    loadData()

    // Real-time synchronization listeners
    const handleDataChanged = () => loadData(true)
    window.addEventListener("gradebookDataChanged", handleDataChanged)
    window.addEventListener("studentDataChanged", handleDataChanged)
    window.addEventListener("reportCardsChanged", handleDataChanged)

    return () => {
      window.removeEventListener("gradebookDataChanged", handleDataChanged)
      window.removeEventListener("studentDataChanged", handleDataChanged)
      window.removeEventListener("reportCardsChanged", handleDataChanged)
    }
  }, [loadData])

  // Current terms for selected academic year
  const currentYearObj = useMemo(() => {
    if (!data?.availableYears) return null
    return data.availableYears.find((y) => y.id === selectedYearId) || data.availableYears.find((y) => y.isCurrent) || data.availableYears[0]
  }, [data?.availableYears, selectedYearId])

  const availableTerms = useMemo(() => {
    return currentYearObj?.terms || []
  }, [currentYearObj])

  // Ranked students for currently active category
  const rankedStudents: RankedStudent[] = useMemo(() => {
    if (!data?.rankings) return []
    return data.rankings[activeCategory] || []
  }, [data?.rankings, activeCategory])

  const categoryLabels: Record<GradeCategory, string> = {
    "1-4": "Grades 1 – 4",
    "5-8": "Grades 5 – 8",
    "9-12": "Grades 9 – 12",
  }

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* ─── Header & Filters Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
        {/* Left: Premium 3D Golden Trophy Icon + Title + Subtitle */}
        <div className="flex items-center gap-3 sm:gap-3.5">
          <TrophyHeaderIcon />
          {/* Subtle vertical separator bar matching reference */}
          <div className="hidden sm:block h-9 w-[1.5px] bg-slate-200 dark:bg-slate-700/80 shrink-0" />
          <div>
            <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              Academic Champions
            </h3>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              Excellence Today, Brighter Tomorrow
            </p>
          </div>
        </div>

        {/* Right: Academic Filters + Refresh Button */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {/* Academic Year Selector (Default: current year) */}
          {data?.availableYears && data.availableYears.length > 0 && (
            <div className="relative">
              <select
                value={selectedYearId || currentYearObj?.id || ""}
                onChange={(e) => {
                  setSelectedYearId(e.target.value)
                  setSelectedTermId("all")
                }}
                className="appearance-none bg-background text-foreground border border-input rounded-xl pl-7 pr-6 py-1.5 text-xs font-bold shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all"
              >
                {data.availableYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name} Academic Year {year.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Semester Selector (Default: All Semesters) */}
          <div className="relative">
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="appearance-none bg-background text-foreground border border-input rounded-xl pl-2.5 pr-6 py-1.5 text-xs font-bold shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all"
            >
              <option value="all">All Semesters</option>
              {availableTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            title="Refresh Top Performers"
            className="h-7 w-7 p-0 rounded-xl bg-background border-input text-muted-foreground hover:text-foreground shadow-2xs"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ─── Independent Grade Tabs (Equal-width individual cards with clear gaps) ─ */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full pt-0.5">
        {(["1-4", "5-8", "9-12"] as GradeCategory[]).map((cat) => {
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "w-full py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-black transition-all duration-200 select-none text-center flex items-center justify-center cursor-pointer active:scale-[0.98]",
                isActive
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 border border-blue-500 ring-2 ring-blue-500/20"
                  : "bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/90 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
              )}
            >
              {categoryLabels[cat]}
            </button>
          )
        })}
      </div>

      {/* ─── Top 3 Student Ranking Cards / Empty State ─────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center space-y-3 animate-pulse min-h-[270px] shadow-2xs"
            >
              <div className="w-8 h-8 rounded-full bg-muted self-start -mt-0.5 -ml-0.5" />
              <div className="w-18 h-18 rounded-full bg-muted" />
              <div className="h-4 w-28 bg-muted rounded-md" />
              <div className="h-2.5 w-16 bg-muted/70 rounded-md" />
              <div className="h-4 w-32 bg-muted/80 rounded-full" />
              <div className="h-8 w-24 bg-muted rounded-full mt-2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 px-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/10 text-center space-y-2">
          <AlertCircle className="w-7 h-7 text-destructive mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            className="rounded-xl text-xs font-bold"
          >
            Retry
          </Button>
        </div>
      ) : rankedStudents.length === 0 ? (
        /* Empty State */
        <div className="py-10 px-6 rounded-2xl border border-dashed border-border bg-card/50 text-center flex flex-col items-center justify-center space-y-2.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm sm:text-base font-bold text-foreground">
              No Approved Results for {categoryLabels[activeCategory]}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Academic results for {categoryLabels[activeCategory]} in{" "}
              <span className="font-semibold text-foreground">{currentYearObj?.name || "this academic period"}</span> have not been finalized or officially approved yet. Once faculty marks are reviewed and approved by administration, the top performing students will appear here.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground border-border">
            Approved Results Only
          </Badge>
        </div>
      ) : (
        /* Student Ranking Cards (1st, 2nd, 3rd) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {rankedStudents.map((student) => (
            <StudentRankCard key={student.studentId} student={student} />
          ))}

          {/* Vacant slot if fewer than 3 qualifying students in category */}
          {rankedStudents.length < 3 && (
            Array.from({ length: 3 - rankedStudents.length }).map((_, idx) => {
              const vacantRank = (rankedStudents.length + idx + 1) as 2 | 3
              return (
                <VacantRankCard
                  key={`vacant-${vacantRank}`}
                  rank={vacantRank}
                  categoryLabel={categoryLabels[activeCategory]}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-Component: Ranked Student Card ───────────────────────────────────────
function StudentRankCard({ student }: { student: RankedStudent }) {
  const rank = student.rank as 1 | 2 | 3

  const themeConfig = {
    1: {
      // Premium Gold Theme
      cardBg: "bg-gradient-to-b from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/30 dark:via-slate-900/95 dark:to-amber-950/20",
      borderColor: "border-amber-300/90 dark:border-amber-500/50 hover:border-amber-400 dark:hover:border-amber-400",
      photoRing: "border-amber-400 dark:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)]",
      pillClass: "bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60",
      scorePillClass: "bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 dark:from-amber-300 dark:via-amber-200 dark:to-amber-300 text-slate-950 border-amber-300 dark:border-amber-100 shadow-[0_4px_16px_rgba(245,158,11,0.28),inset_0_1px_1px_rgba(255,255,255,0.9)]",
      waveColor: "#f59e0b",
      fallbackGradient: "from-amber-400 to-amber-600",
    },
    2: {
      // Metallic Silver Theme
      cardBg: "bg-gradient-to-b from-slate-100/80 via-white to-slate-100/40 dark:from-slate-800/35 dark:via-slate-900/95 dark:to-slate-800/20",
      borderColor: "border-slate-300 dark:border-slate-600/80 hover:border-slate-400 dark:hover:border-slate-400",
      photoRing: "border-slate-300 dark:border-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.35)]",
      pillClass: "bg-sky-50/90 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60",
      scorePillClass: "bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 dark:from-slate-100 dark:via-white dark:to-slate-200 text-slate-950 border-slate-300 dark:border-white shadow-[0_4px_16px_rgba(148,163,184,0.28),inset_0_1px_1px_rgba(255,255,255,0.9)]",
      waveColor: "#94a3b8",
      fallbackGradient: "from-slate-300 to-slate-500",
    },
    3: {
      // Distinct Bronze / Copper Theme
      cardBg: "bg-gradient-to-b from-orange-50/80 via-white to-amber-900/10 dark:from-orange-950/30 dark:via-slate-900/95 dark:to-amber-950/25",
      borderColor: "border-orange-400/70 dark:border-orange-600/50 hover:border-orange-500 dark:hover:border-orange-400",
      photoRing: "border-orange-500 dark:border-orange-400 shadow-[0_0_15px_rgba(234,88,12,0.35)]",
      pillClass: "bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60",
      scorePillClass: "bg-gradient-to-r from-orange-100 via-amber-100 to-orange-100 dark:from-orange-300 dark:via-amber-200 dark:to-orange-300 text-slate-950 border-orange-300 dark:border-orange-100 shadow-[0_4px_16px_rgba(234,88,12,0.28),inset_0_1px_1px_rgba(255,255,255,0.9)]",
      waveColor: "#c2410c",
      fallbackGradient: "from-orange-500 to-amber-800",
    },
  }[rank] || {
    cardBg: "bg-card",
    borderColor: "border-border",
    photoRing: "border-border",
    pillClass: "bg-muted text-muted-foreground",
    scorePillClass: "bg-muted text-foreground",
    waveColor: "#94a3b8",
    fallbackGradient: "from-blue-400 to-blue-600",
  }

  const getInitials = (name: string) => {
    if (!name) return "ST"
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const studentDisplayId = student.studentCode || `ID: ${student.studentId ? student.studentId.slice(0, 8).toUpperCase() : "N/A"}`

  return (
    <div className={cn(
      "relative rounded-2xl border p-4 pt-3.5 flex flex-col items-center justify-between text-center overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 min-h-[270px] sm:min-h-[285px]",
      themeConfig.cardBg,
      themeConfig.borderColor
    )}>
      {/* Medal Badge (Top Left with Realistic 3D Ribbon Tails) */}
      <MedalBadge rank={rank} />

      {/* Profile Photo or Fallback Avatar */}
      <div className="mt-0.5 relative">
        {student.profilePhoto ? (
          <img
            src={student.profilePhoto}
            alt={student.fullName}
            className={cn(
              "w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-[3.5px] shadow-sm",
              themeConfig.photoRing
            )}
          />
        ) : (
          <div className={cn(
            "w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-lg sm:text-xl font-black border-[3.5px] shadow-sm",
            themeConfig.fallbackGradient,
            themeConfig.photoRing
          )}>
            {getInitials(student.fullName)}
          </div>
        )}
      </div>

      {/* Student Name & Student ID */}
      <div className="w-full mt-2 space-y-0.5">
        <h4 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate px-1">
          {student.fullName}
        </h4>
        <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground/80 tracking-wide">
          {studentDisplayId.startsWith("ID:") ? studentDisplayId : `ID: ${studentDisplayId}`}
        </p>

        {/* Grade & Section Pill */}
        <div className="flex justify-center pt-0.5">
          <span className={cn(
            "inline-flex items-center px-3 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border shadow-2xs",
            themeConfig.pillClass
          )}>
            {student.classInfo}
          </span>
        </div>
      </div>

      {/* Overall Average Score Pill - Luminous Metallic Award Capsule */}
      <div className="mt-2.5 mb-0.5 z-10 w-full flex justify-center">
        <div className={cn(
          "w-3/4 max-w-[150px] py-1 px-3 rounded-full text-center border font-black text-lg sm:text-xl tracking-tight transition-all duration-300 hover:scale-[1.03] cursor-default select-none",
          themeConfig.scorePillClass
        )}>
          {student.formattedScore}
        </div>
      </div>

      {/* Decorative Wave at the Bottom */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-7 sm:h-8 pointer-events-none opacity-35 select-none"
        viewBox="0 0 300 60"
        preserveAspectRatio="none"
      >
        <path
          d={
            rank === 1
              ? "M0,45 C80,20 180,60 300,30 L300,60 L0,60 Z"
              : rank === 2
              ? "M0,35 C100,55 200,15 300,40 L300,60 L0,60 Z"
              : "M0,40 C90,15 210,50 300,35 L300,60 L0,60 Z"
          }
          fill={themeConfig.waveColor}
        />
      </svg>
    </div>
  )
}

// ─── Sub-Component: Realistic Award Medal with 3D Fabric Ribbons ──────────────
function MedalBadge({ rank }: { rank: 1 | 2 | 3 }) {
  // Unique gradient IDs per rank to prevent SVG ID collisions
  const gradPrefix = `medal-${rank}`

  const palettes = {
    1: {
      // Gold
      ribbonBody: ["#f59e0b", "#d97706", "#92400e"],
      ribbonHighlight: "rgba(254, 240, 138, 0.75)",
      ribbonShadow: "rgba(113, 63, 18, 0.75)",
      ribbonEdge: "rgba(180, 83, 9, 0.6)",
      medalRing: ["#fef08a", "#f59e0b", "#92400e"],
      medalDisc: ["#fffbeb", "#fef08a", "#d97706"],
      medalRidge: "#fef08a",
      numberColor: "#78350f",
      numberShadow: "#fef9c3",
      dropGlow: "rgba(245, 158, 11, 0.35)",
    },
    2: {
      // Silver
      ribbonBody: ["#cbd5e1", "#94a3b8", "#475569"],
      ribbonHighlight: "rgba(248, 250, 252, 0.85)",
      ribbonShadow: "rgba(30, 41, 59, 0.75)",
      ribbonEdge: "rgba(71, 85, 105, 0.6)",
      medalRing: ["#ffffff", "#cbd5e1", "#475569"],
      medalDisc: ["#ffffff", "#e2e8f0", "#94a3b8"],
      medalRidge: "#ffffff",
      numberColor: "#1e293b",
      numberShadow: "#ffffff",
      dropGlow: "rgba(148, 163, 184, 0.35)",
    },
    3: {
      // Bronze
      ribbonBody: ["#fb923c", "#ea580c", "#7c2d12"],
      ribbonHighlight: "rgba(254, 215, 170, 0.75)",
      ribbonShadow: "rgba(67, 20, 7, 0.75)",
      ribbonEdge: "rgba(154, 52, 18, 0.6)",
      medalRing: ["#ffedd5", "#ea580c", "#7c2d12"],
      medalDisc: ["#fff7ed", "#fed7aa", "#c2410c"],
      medalRidge: "#fed7aa",
      numberColor: "#431407",
      numberShadow: "#fed7aa",
      dropGlow: "rgba(234, 88, 12, 0.35)",
    },
  }[rank]

  return (
    <div className="absolute top-2 left-2 z-10 select-none pointer-events-none drop-shadow-md">
      <svg
        width="42"
        height="58"
        viewBox="0 0 54 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Ribbon Tail Linear Gradients */}
          <linearGradient id={`${gradPrefix}-ribbon-left`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palettes.ribbonBody[0]} />
            <stop offset="50%" stopColor={palettes.ribbonBody[1]} />
            <stop offset="100%" stopColor={palettes.ribbonBody[2]} />
          </linearGradient>
          <linearGradient id={`${gradPrefix}-ribbon-right`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palettes.ribbonBody[0]} />
            <stop offset="50%" stopColor={palettes.ribbonBody[1]} />
            <stop offset="100%" stopColor={palettes.ribbonBody[2]} />
          </linearGradient>

          {/* Medallion Gradients */}
          <linearGradient id={`${gradPrefix}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palettes.medalRing[0]} />
            <stop offset="50%" stopColor={palettes.medalRing[1]} />
            <stop offset="100%" stopColor={palettes.medalRing[2]} />
          </linearGradient>
          <radialGradient id={`${gradPrefix}-disc`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={palettes.medalDisc[0]} />
            <stop offset="60%" stopColor={palettes.medalDisc[1]} />
            <stop offset="100%" stopColor={palettes.medalDisc[2]} />
          </radialGradient>

          {/* Ribbon Soft Drop Shadow Filter */}
          <filter id={`${gradPrefix}-shadow`} x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* ─── HANGING FABRIC RIBBON TAILS (Centered beneath medallion) ─── */}
        <g filter={`url(#${gradPrefix}-shadow)`}>
          {/* Left Ribbon Tail with V-cut swallowtail notch */}
          <path
            d="M 16,22 L 27,24 L 24,67 L 17,58 L 9,67 Z"
            fill={`url(#${gradPrefix}-ribbon-left)`}
          />
          {/* Left Ribbon Center Satin Highlight */}
          <path
            d="M 17,23 L 20,23.5 L 18,59 L 16.5,58.5 Z"
            fill={palettes.ribbonHighlight}
            opacity="0.6"
          />
          {/* Left Ribbon Inner Fold Shading (depth under badge and right ribbon) */}
          <path
            d="M 23,24 L 27,24 L 24.5,48 L 22.5,48 Z"
            fill={palettes.ribbonShadow}
            opacity="0.45"
          />
          {/* Left Ribbon Outer Seam Stitch/Edge */}
          <line x1="10" y1="65" x2="16.5" y2="23" stroke={palettes.ribbonEdge} strokeWidth="0.75" />

          {/* Right Ribbon Tail with V-cut swallowtail notch (overlapping slightly at center) */}
          <path
            d="M 27,24 L 38,22 L 45,67 L 37,58 L 30,67 Z"
            fill={`url(#${gradPrefix}-ribbon-right)`}
          />
          {/* Right Ribbon Center Satin Highlight */}
          <path
            d="M 34,23.5 L 37,23 L 37.5,58.5 L 36,59 Z"
            fill={palettes.ribbonHighlight}
            opacity="0.6"
          />
          {/* Right Ribbon Inner Fold Shadow */}
          <path
            d="M 27,24 L 31,24 L 29.5,48 L 27.5,48 Z"
            fill={palettes.ribbonShadow}
            opacity="0.45"
          />
          {/* Right Ribbon Outer Seam Stitch/Edge */}
          <line x1="44" y1="65" x2="37.5" y2="23" stroke={palettes.ribbonEdge} strokeWidth="0.75" />

          {/* Ribbon Tuck Crease directly beneath circular medallion */}
          <path
            d="M 19,25 Q 27,29 35,25 Q 27,27 19,25 Z"
            fill={palettes.ribbonShadow}
            opacity="0.7"
          />
        </g>

        {/* ─── CIRCULAR MEDAL BADGE (Centered at X: 27, Y: 19) ─── */}
        {/* Outer Metallic Bevel Rim */}
        <circle cx="27" cy="19" r="16.5" fill={`url(#${gradPrefix}-ring)`} />

        {/* Outer Rim Highlight Ring */}
        <circle cx="27" cy="19" r="15.2" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7" />

        {/* Inner Engraved Core Disc */}
        <circle cx="27" cy="19" r="13.8" fill={`url(#${gradPrefix}-disc)`} />

        {/* Concentric Bezel Ring */}
        <circle
          cx="27"
          cy="19"
          r="12.2"
          fill="none"
          stroke={palettes.medalRidge}
          strokeWidth="0.6"
          strokeDasharray="1.5 1"
          opacity="0.85"
        />

        {/* Upper Specular Metallic Gloss Arc */}
        <path
          d="M 16,16 C 18,10 36,10 38,16 C 35,12 19,12 16,16 Z"
          fill="white"
          opacity="0.45"
        />

        {/* Embossed Rank Number (3D with bevel shadow) */}
        {/* Number Highlight Shadow underneath */}
        <text
          x="27"
          y="20.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="16"
          fill={palettes.numberShadow}
          opacity="0.8"
        >
          {rank}
        </text>

        {/* Number Main Body */}
        <text
          x="27"
          y="19.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="16"
          fill={palettes.numberColor}
        >
          {rank}
        </text>
      </svg>
    </div>
  )
}

// ─── Sub-Component: Vacant Rank Card ──────────────────────────────────────────
function VacantRankCard({ rank, categoryLabel }: { rank: 2 | 3; categoryLabel: string }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-border p-4 pt-3.5 flex flex-col items-center justify-center text-center bg-card/40 min-h-[270px] sm:min-h-[285px] space-y-2">
      <MedalBadge rank={rank} />
      <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/60">
        <Users className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h5 className="text-xs sm:text-sm font-bold text-foreground">
          Rank #{rank} Vacant
        </h5>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground max-w-[160px] mx-auto leading-tight">
          Awaiting finalized results for {categoryLabel}
        </p>
      </div>
    </div>
  )
}

// ─── Sub-Component: Premium Realistic 3D Golden Trophy with Laurel Decorations ───
function TrophyHeaderIcon() {
  return (
    <div className="relative w-12 h-11 sm:w-14 sm:h-13 md:w-16 md:h-14 flex items-center justify-center shrink-0 drop-shadow-sm select-none">
      <svg
        viewBox="0 0 140 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Main Gold Gradients */}
          <linearGradient id="goldCupGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          <linearGradient id="goldHighlightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#fef08a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="goldHandleGradLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="80%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          <linearGradient id="goldHandleGradRight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="80%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          <linearGradient id="goldLaurelGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="80%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>

          <linearGradient id="pedestalWoodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="50%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#290e02" />
          </linearGradient>

          <linearGradient id="pedestalBrassGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="35%" stopColor="#fde047" />
            <stop offset="65%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          {/* Ambient Warm Golden Glow */}
          <radialGradient id="trophyAmbientGlow" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ─── Ambient Glow Behind Trophy ─── */}
        <circle cx="70" cy="52" r="48" fill="url(#trophyAmbientGlow)" />

        {/* ─── LEFT LAUREL WREATH ─── */}
        <g id="laurel-left">
          {/* Main stem curve */}
          <path
            d="M 44,94 C 20,82 12,54 18,34 C 20,28 24,20 28,14"
            stroke="url(#goldLaurelGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Leaves along left stem */}
          <path d="M 28,14 C 23,17 21,23 23,28 C 26,24 28,19 28,14 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 33,18 C 28,21 27,27 30,31 C 32,27 34,22 33,18 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 20,26 C 14,30 14,36 17,41 C 19,36 21,31 20,26 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 25,32 C 19,36 19,42 23,46 C 25,41 26,36 25,32 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 16,42 C 10,47 11,54 15,58 C 16,53 18,47 16,42 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 22,48 C 16,53 17,60 22,64 C 23,59 24,53 22,48 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 16,60 C 11,66 14,73 19,76 C 19,70 20,65 16,60 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 24,66 C 19,72 23,78 28,81 C 28,75 28,70 24,66 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 24,78 C 21,84 27,89 33,90 C 32,85 30,80 24,78 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 34,84 C 31,90 38,94 44,94 C 42,89 39,85 34,84 Z" fill="url(#goldLaurelGrad)" />
          {/* Laurel berries */}
          <circle cx="24" cy="22" r="2.2" fill="#fde047" />
          <circle cx="18" cy="36" r="2.2" fill="#fde047" />
          <circle cx="17" cy="52" r="2.2" fill="#fde047" />
          <circle cx="21" cy="70" r="2.2" fill="#fde047" />
        </g>

        {/* ─── RIGHT LAUREL WREATH (Symmetrical) ─── */}
        <g id="laurel-right">
          {/* Main stem curve */}
          <path
            d="M 96,94 C 120,82 128,54 122,34 C 120,28 116,20 112,14"
            stroke="url(#goldLaurelGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Leaves along right stem */}
          <path d="M 112,14 C 117,17 119,23 117,28 C 114,24 112,19 112,14 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 107,18 C 112,21 113,27 110,31 C 108,27 106,22 107,18 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 120,26 C 126,30 126,36 123,41 C 121,36 119,31 120,26 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 115,32 C 121,36 121,42 117,46 C 115,41 114,36 115,32 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 124,42 C 130,47 129,54 125,58 C 124,53 122,47 124,42 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 118,48 C 124,53 123,60 118,64 C 117,59 116,53 118,48 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 124,60 C 129,66 126,73 121,76 C 121,70 120,65 124,60 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 116,66 C 121,72 117,78 112,81 C 112,75 112,70 116,66 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 116,78 C 119,84 113,89 107,90 C 108,85 110,80 116,78 Z" fill="url(#goldLaurelGrad)" />
          <path d="M 106,84 C 109,90 102,94 96,94 C 98,89 101,85 106,84 Z" fill="url(#goldLaurelGrad)" />
          {/* Laurel berries */}
          <circle cx="116" cy="22" r="2.2" fill="#fde047" />
          <circle cx="122" cy="36" r="2.2" fill="#fde047" />
          <circle cx="123" cy="52" r="2.2" fill="#fde047" />
          <circle cx="119" cy="70" r="2.2" fill="#fde047" />
        </g>

        {/* ─── 3D TROPHY PEDESTAL / BASE ─── */}
        {/* Tier 1: Mahogany Wood Plinth Base */}
        <rect x="44" y="100" width="52" height="11" rx="2.5" fill="url(#pedestalWoodGrad)" />
        {/* Plinth Base Bevel Accent */}
        <rect x="45" y="100" width="50" height="1.5" rx="0.5" fill="#fbbf24" opacity="0.6" />
        <rect x="42" y="108" width="56" height="4" rx="2" fill="#290e02" />

        {/* Tier 2: Polished Brass Pedestal Block */}
        <rect x="48" y="90" width="44" height="11" rx="2" fill="url(#pedestalBrassGrad)" />
        <rect x="49" y="90" width="42" height="1.5" rx="0.5" fill="#fef08a" opacity="0.75" />

        {/* Tier 3: Gold Collar Ring */}
        <rect x="56" y="82" width="28" height="9" rx="2" fill="url(#pedestalBrassGrad)" />
        <rect x="57" y="82" width="26" height="1.2" rx="0.5" fill="#fef9c3" opacity="0.8" />

        {/* ─── TROPHY HANDLES ─── */}
        {/* Left Curved Handle */}
        <path
          d="M 48,32 C 28,32 26,56 46,62 C 43,59 40,54 41,48 C 42,40 45,36 50,35 Z"
          fill="url(#goldHandleGradLeft)"
          stroke="#b45309"
          strokeWidth="0.8"
        />
        <path
          d="M 47,33 C 31,33 30,53 45,58"
          stroke="#fef08a"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />

        {/* Right Curved Handle */}
        <path
          d="M 92,32 C 112,32 114,56 94,62 C 97,59 100,54 99,48 C 98,40 95,36 90,35 Z"
          fill="url(#goldHandleGradRight)"
          stroke="#b45309"
          strokeWidth="0.8"
        />
        <path
          d="M 93,33 C 109,33 110,53 95,58"
          stroke="#fef08a"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />

        {/* ─── TROPHY STEM / CONNECTOR ─── */}
        <path
          d="M 64,72 C 64,78 61,82 58,83 L 82,83 C 79,82 76,78 76,72 Z"
          fill="url(#goldCupGrad)"
          stroke="#b45309"
          strokeWidth="0.8"
        />

        {/* ─── TROPHY CUP MAIN BODY ─── */}
        {/* Cup Bowl */}
        <path
          d="M 46,26 L 94,26 C 94,26 94,52 79,66 C 75,70 65,70 61,66 C 46,52 46,26 46,26 Z"
          fill="url(#goldCupGrad)"
          stroke="#92400e"
          strokeWidth="1"
        />

        {/* Left specular reflection arc on cup body */}
        <path
          d="M 52,28 C 50,36 51,50 63,62 C 54,54 51,42 53,28 Z"
          fill="url(#goldHighlightGrad)"
        />

        {/* Right subtle shadow on cup body */}
        <path
          d="M 88,28 C 90,36 89,50 77,62 C 86,54 89,42 87,28 Z"
          fill="#78350f"
          opacity="0.25"
        />

        {/* Cup Upper Rim Ellipse */}
        <ellipse cx="70" cy="26" rx="24" ry="5.5" fill="url(#pedestalBrassGrad)" stroke="#b45309" strokeWidth="0.8" />
        <ellipse cx="70" cy="26" rx="21" ry="3.5" fill="#78350f" opacity="0.75" />
        <ellipse cx="70" cy="25" rx="19" ry="2.2" fill="#451a03" />
        {/* Rim Specular Glint */}
        <path d="M 48,25 C 55,27 65,27.5 72,27 C 65,26 55,25.5 48,25 Z" fill="#ffffff" opacity="0.9" />

        {/* ─── 3D FACETED EMBOSSED GOLD STAR ─── */}
        <g id="trophy-star" transform="translate(70, 46)">
          {/* Star Light Facets */}
          <polygon points="0,-12 3.5,-3.5 12,-3.5 5,2 7.5,10.5 0,5.5" fill="#ffffff" opacity="0.95" />
          <polygon points="0,-12 -3.5,-3.5 0,0" fill="#fef9c3" />
          <polygon points="12,-3.5 5,2 0,0" fill="#fef08a" />
          <polygon points="7.5,10.5 0,5.5 0,0" fill="#fde047" />

          {/* Star Shaded Facets */}
          <polygon points="0,-12 -3.5,-3.5 -12,-3.5 -5,2 -7.5,10.5 0,5.5" fill="#f59e0b" />
          <polygon points="-12,-3.5 -5,2 0,0" fill="#d97706" />
          <polygon points="-7.5,10.5 0,5.5 0,0" fill="#b45309" />
          <polygon points="0,5.5 0,0 3.5,-3.5" fill="#fbbf24" opacity="0.6" />
        </g>
      </svg>
    </div>
  )
}
