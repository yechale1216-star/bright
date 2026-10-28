"use client"

import { useAcademicYear } from "@/lib/context/academic-year-context"
import { Badge } from "@/components/ui/badge"
import { BookOpen, History, AlertCircle, Clock3, Lock } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils/utils"

interface AcademicYearBadgeProps {
  className?: string
  compact?: boolean
}

/**
 * AcademicYearBadge
 *
 * Displays the currently active academic year in the header.
 * Allows administrators and staff to inspect Active, Future, and Closed years.
 * When in historical mode, displays a clear warning banner.
 */
export function AcademicYearBadge({ className, compact = false }: AcademicYearBadgeProps) {
  const {
    activeAcademicYear,
    allAcademicYears,
    isHistoricalMode,
    viewingAcademicYear,
    setViewingAcademicYear,
    resetToActiveYear,
    isLoadingAcademicYear,
  } = useAcademicYear()

  if (isLoadingAcademicYear && !activeAcademicYear) {
    return (
      <div className={cn("h-6 w-24 bg-muted animate-pulse rounded-full", className)} />
    )
  }

  if (!activeAcademicYear) return null

  const futureYears = allAcademicYears.filter((y) => (y.status || 'FUTURE') === 'FUTURE' && !y.isCurrent)
  const closedYears = allAcademicYears.filter((y) => y.status === 'CLOSED')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            isHistoricalMode
              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50",
            className
          )}
          title={
            isHistoricalMode
              ? `Viewing historical year: ${viewingAcademicYear?.name}. Click to switch.`
              : `Active Academic Year: ${activeAcademicYear.name}`
          }
        >
          {isHistoricalMode ? (
            <History className="h-3 w-3" />
          ) : (
            <BookOpen className="h-3 w-3" />
          )}
          {!compact && (
            <span>
              {isHistoricalMode ? viewingAcademicYear?.name : activeAcademicYear.name}
            </span>
          )}
          {isHistoricalMode && !compact && (
            <span className="opacity-75 font-bold text-[10px] uppercase">(Historical)</span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border border-border">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-bold text-foreground">
          <BookOpen className="h-4 w-4 text-emerald-600" />
          Academic Year Lifecycle
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Active year */}
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer rounded-xl p-2 font-medium"
          onClick={resetToActiveYear}
        >
          <Badge
            variant="outline"
            className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 font-extrabold text-[10px]"
          >
            Active
          </Badge>
          <span className="font-bold text-sm truncate">{activeAcademicYear.name}</span>
          {!isHistoricalMode && <span className="ml-auto text-xs text-emerald-600 font-bold">✓ Current</span>}
        </DropdownMenuItem>

        {/* Future years */}
        {futureYears.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-2 py-1">
              <Clock3 className="h-3 w-3 text-blue-500" />
              Future (Preparation)
            </DropdownMenuLabel>
            {futureYears.map((year) => (
              <DropdownMenuItem
                key={year.id}
                className="flex items-center gap-2 cursor-pointer rounded-xl p-2 text-xs text-muted-foreground"
                onClick={() => setViewingAcademicYear(year)}
              >
                <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold">
                  Future
                </Badge>
                <span className="truncate">{year.name}</span>
                {isHistoricalMode && viewingAcademicYear?.id === year.id && (
                  <span className="ml-auto text-xs text-primary font-bold">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Closed historical years */}
        {closedYears.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-2 py-1">
              <Lock className="h-3 w-3 text-slate-400" />
              Closed (Read-Only)
            </DropdownMenuLabel>
            {closedYears.map((year) => (
              <DropdownMenuItem
                key={year.id}
                className="flex items-center gap-2 cursor-pointer rounded-xl p-2 text-xs"
                onClick={() => setViewingAcademicYear(year)}
              >
                <Badge variant="outline" className="text-slate-600 border-slate-300 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold">
                  Closed
                </Badge>
                <span className="truncate">{year.name}</span>
                {isHistoricalMode && viewingAcademicYear?.id === year.id && (
                  <span className="ml-auto text-xs text-amber-600 font-bold">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Historical mode warning */}
        {isHistoricalMode && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-900/60 mt-1">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span className="leading-tight text-[11px]">You are viewing a non-active academic year. Modifications are restricted.</span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
