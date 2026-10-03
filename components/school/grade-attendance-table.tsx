"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof GradeStat, direction: 'asc' | 'desc' } | null>(null)
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
      return direction === 'asc' ? result : -result
    })
  }, [data, sortConfig])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedData.slice(start, start + PAGE_SIZE)
  }, [sortedData, page])

  const requestSort = (key: keyof GradeStat) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
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

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <Table className="min-w-[700px]">
          <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <TableRow className="border-slate-200 dark:border-slate-800">
              <TableHead onClick={() => requestSort('grade')} className="typography-label cursor-pointer text-[10px] uppercase">
                <div className="flex items-center gap-1">Grade {sortConfig?.key === 'grade' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
              </TableHead>
              <TableHead onClick={() => requestSort('section')} className="typography-label cursor-pointer text-[10px] uppercase text-center">Section</TableHead>
              <TableHead className="typography-label text-[10px] uppercase text-center">Stream</TableHead>
              <TableHead onClick={() => requestSort('totalStudents')} className="typography-label cursor-pointer text-[10px] uppercase text-center w-20">Total</TableHead>
              <TableHead className="typography-label text-[10px] uppercase text-center text-emerald-600 w-24">Present</TableHead>
              <TableHead className="typography-label text-[10px] uppercase text-center text-rose-600 w-24">Absent</TableHead>
              <TableHead className="typography-label text-[10px] uppercase text-center text-amber-500 w-24">Late</TableHead>
              <TableHead className="typography-label text-[10px] uppercase text-center text-sky-500 w-24">Excused</TableHead>
              <TableHead onClick={() => requestSort('attendanceRate')} className="typography-label cursor-pointer text-[10px] uppercase w-[160px]">
                <div className="flex items-center gap-1">Rate % {sortConfig?.key === 'attendanceRate' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="border-slate-100 dark:border-slate-800/50">
                  <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-16" /></TableCell>
                  <TableCell className="text-center flex items-center justify-center"><div className="h-5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full w-10 mt-1" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-8 mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-6 mx-auto" /></TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-8" />
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedData.map((row, idx) => (
              <TableRow key={idx} className="border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <TableCell className="typography-label text-foreground">{row.grade}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="typography-label text-[10px]">{row.section}</Badge>
                </TableCell>
                <TableCell className="typography-helper text-center text-muted-foreground uppercase">{row.stream || "-"}</TableCell>
                <TableCell className="typography-label text-center">{row.totalStudents}</TableCell>
                <TableCell className="typography-label text-center text-emerald-600">{row.present}</TableCell>
                <TableCell className="typography-label text-center text-rose-600">{row.absent}</TableCell>
                <TableCell className="typography-label text-center text-amber-500">{row.late}</TableCell>
                <TableCell className="typography-label text-center text-sky-500">{row.excused}</TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <div className="typography-label flex justify-between text-[10px]">
                      <span className={getRateColor(row.attendanceRate)}>{row.attendanceRate}%</span>
                    </div>
                    <Progress value={row.attendanceRate} className={`h-1.5 [&>div]:${getRateBg(row.attendanceRate)}`} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && sortedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="typography-label h-32 text-center text-muted-foreground">
                  No attendance data found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {sortedData.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <p className="text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{Math.min((page - 1) * PAGE_SIZE + 1, sortedData.length)}</span> to <span className="font-bold text-foreground">{Math.min(page * PAGE_SIZE, sortedData.length)}</span> of <span className="font-bold text-foreground">{sortedData.length}</span> rows
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 px-2.5 rounded-xl text-xs gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <span className="px-3 py-1 text-xs font-bold text-foreground">
              Page {page} of {Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(sortedData.length / PAGE_SIZE)}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 px-2.5 rounded-xl text-xs gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
