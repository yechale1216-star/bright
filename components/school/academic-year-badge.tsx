"use client"

import { useAcademicYear } from "@/lib/context/academic-year-context"
import { Badge } from "@/components/ui/badge"
import { BookOpen, History, AlertCircle } from "lucide-react"
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
 * When in historical mode, shows a warning banner.
 * Allows admins to switch the view to a historical year for read-only report viewing.
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

  const historyYears = allAcademicYears.filter((y) => !y.isCurrent)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
            <span className="opacity-70">(Historical)</span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600" />
          Academic Year
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Active year */}
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={resetToActiveYear}
        >
          <Badge
            variant="outline"
            className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400"
          >
            Active
          </Badge>
          <span className="font-medium">{activeAcademicYear.name}</span>
          {!isHistoricalMode && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>

        {/* Historical years */}
        {historyYears.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
              <History className="h-3 w-3" />
              Historical (read-only)
            </DropdownMenuLabel>
            {historyYears.map((year) => (
              <DropdownMenuItem
                key={year.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setViewingAcademicYear(year)}
              >
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400">
                  Past
                </Badge>
                <span>{year.name}</span>
                {isHistoricalMode && viewingAcademicYear?.id === year.id && (
                  <span className="ml-auto text-xs text-muted-foreground">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Historical mode warning */}
        {isHistoricalMode && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-sm">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>You are viewing historical data. No changes can be made to past records.</span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
