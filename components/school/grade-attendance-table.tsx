"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface GradeStat {
  grade: string
  section: string
  stream: string | null
  totalStudents: number
  present: number
  absent: number
  late: number
  excused: number
  attendanceRate: number
  lastUpdated: string | null
}

interface TableProps {
  data: GradeStat[]
  onDrillDown: (grade: string, section: string, stream: string | null) => void
  isLoading?: boolean
}

export function GradeAttendanceTable({ data, onDrillDown, isLoading }: TableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof GradeStat; direction: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (!sortConfig) return 0
      const { key, direction } = sortConfig
      const aVal = a[key]
      const bVal = b[key]
      if (aVal === bVal) return 0
      const result = (aVal as any) > (bVal as any) ? 1 : -1
      return direction === "asc" ? result : -result
    })
  }, [data, sortConfig])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedData.slice(start, start + PAGE_SIZE)
  }, [sortedData, page])

  const requestSort = (key: keyof GradeStat) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
    setPage(1)
  }

  const getRateColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600 dark:text-emerald-400"
    if (rate >= 75) return "text-amber-600 dark:text-amber-400"
    return "text-rose-600 dark:text-rose-400"
  }

  const getRateBg = (rate: number) => {
    if (rate >= 90) return "bg-emerald-500"
    if (rate >= 75) return "bg-amber-500"
    return "bg-rose-500"
  }

  const SortIcon = ({ col }: { col: keyof GradeStat }) =>
    sortConfig?.key === col ? (
      sortConfig.direction === "asc" ? (
        <ChevronUp className="w-3 h-3 inline ml-1" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ml-1" />
      )
    ) : null

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-fit">
      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <table className="w-full min-w-[700px] text-sm border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
            <tr>
              <th onClick={() => requestSort("grade")} className="cursor-pointer h-11 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Grade <SortIcon col="grade" />
              </th>
              <th onClick={() => requestSort("section")} className="cursor-pointer h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Section <SortIcon col="section" />
              </th>
              <th className="h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Stream</th>
              <th onClick={() => requestSort("totalStudents")} className="cursor-pointer h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-20">
                Total <SortIcon col="totalStudents" />
              </th>
              <th className="h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-600 whitespace-nowrap w-24">Present</th>
              <th className="h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-rose-600 whitespace-nowrap w-24">Absent</th>
              <th className="h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-500 whitespace-nowrap w-24">Late</th>
              <th className="h-11 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-sky-500 whitespace-nowrap w-24">Excused</th>
              <th onClick={() => requestSort("attendanceRate")} className="cursor-pointer h-11 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-[160px]">
                Rate % <SortIcon col="attendanceRate" />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="px-4 py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-16" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full w-10 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-8 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="space-y-1.5"><div className="h-3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-8" /><div className="h-1.5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-full" /></div></td>
                </tr>
              ))
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-semibold text-foreground whitespace-nowrap">{row.grade}</td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <Badge variant="outline" className="typography-label text-[10px]">{row.section}</Badge>
                  </td>
                  <td className="px-4 py-3.5 text-center text-xs text-muted-foreground uppercase whitespace-nowrap">{row.stream || "-"}</td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-foreground whitespace-nowrap">{row.totalStudents}</td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-emerald-600 whitespace-nowrap">{row.present}</td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-rose-600 whitespace-nowrap">{row.absent}</td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-amber-500 whitespace-nowrap">{row.late}</td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-sky-500 whitespace-nowrap">{row.excused}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="space-y-1.5">
                      <span className={`text-xs font-bold ${getRateColor(row.attendanceRate)}`}>{row.attendanceRate}%</span>
                      <Progress value={row.attendanceRate} className={`h-1.5 [&>div]:${getRateBg(row.attendanceRate)}`} />
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!isLoading && sortedData.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No attendance data found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sortedData.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <p className="text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{Math.min((page - 1) * PAGE_SIZE + 1, sortedData.length)}</span> to <span className="font-bold text-foreground">{Math.min(page * PAGE_SIZE, sortedData.length)}</span> of <span className="font-bold text-foreground">{sortedData.length}</span> rows
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 px-2.5 rounded-xl text-xs gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <span className="px-3 py-1 text-xs font-bold text-foreground">
              Page {page} of {Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE))}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(sortedData.length / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)} className="h-8 px-2.5 rounded-xl text-xs gap-1">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
