"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, User, TrendingUp, Calendar, AlertCircle, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"

function GradeDrillDownContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const gradeId = params.gradeId as string
  const section = searchParams.get("section")
  const stream = searchParams.get("stream")
  const session = searchParams.get("session") || "total"
  
  const [students, setStudents] = useState<any[]>([])
  const [gradeName, setGradeName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return students.slice(start, start + PAGE_SIZE)
  }, [students, page])

  useEffect(() => {
    loadDrillDownData()
  }, [gradeId, section, stream, session])

  const loadDrillDownData = async () => {
    setIsLoading(true)
    try {
      const [data, schoolSettings] = await Promise.all([
        db.getAttendanceDrillDownStats(gradeId, { section, stream, session }),
        db.getSettings()
      ])
      setStudents(data)
      setSettings(schoolSettings)
      if (data.length > 0) {
        setGradeName(gradeId)
      }
    } catch (error) {
      console.error("Failed to load detailed grade analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "present": return <Badge className="bg-green-500">Present</Badge>
      case "late": return <Badge className="bg-yellow-500">Late</Badge>
      case "absent": return <Badge className="bg-red-500">Absent</Badge>
      case "excused": return <Badge className="bg-blue-500">Excused</Badge>
      default: return <Badge variant="outline">N/A</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-[420px] bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-[420px] bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {gradeName} {section ? `- Section ${section}` : ""} {stream ? `(${stream})` : ""}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Detailed student attendance tracking and trends.</p>
            {settings?.attendanceMode === 'session_based' && (
              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                {session === 'total' ? 'All Sessions' : `${session} Session`}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Student List ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
              <Table className="min-w-[650px]">
                <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">ID</TableHead>
                    <TableHead className="text-center text-green-600">Present</TableHead>
                    <TableHead className="text-center text-amber-500">Late</TableHead>
                    <TableHead className="text-center text-indigo-500">Excused</TableHead>
                    <TableHead className="text-center text-red-600">Absent</TableHead>
                    <TableHead className="text-right">Rate %</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No students found for this section.
                      </TableCell>
                    </TableRow>
                  ) : paginatedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.fullName}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{student.studentId}</TableCell>
                      <TableCell className="text-center font-bold text-green-600">{student.present}</TableCell>
                      <TableCell className="text-center font-bold text-amber-500">{student.late}</TableCell>
                      <TableCell className="text-center font-bold text-indigo-500">{student.excused}</TableCell>
                      <TableCell className="text-center font-bold text-red-600">{student.absent}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold">{student.attendanceRate}%</span>
                          <Progress value={student.attendanceRate} className="h-1 w-20" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => router.push(`/school/admin/messages?studentId=${student.id}&parentName=${encodeURIComponent(student.parent_name || '')}`)}
                          title="Message Parent"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {students.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <p className="text-muted-foreground font-medium">
                  Showing <span className="font-bold text-foreground">{Math.min((page - 1) * PAGE_SIZE + 1, students.length)}</span> to <span className="font-bold text-foreground">{Math.min(page * PAGE_SIZE, students.length)}</span> of <span className="font-bold text-foreground">{students.length}</span> students
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
                    Page {page} of {Math.max(1, Math.ceil(students.length / PAGE_SIZE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(students.length / PAGE_SIZE)}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Frequent Absences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {students
                .filter(s => s.absent > 3)
                .sort((a, b) => b.absent - a.absent)
                .map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{student.fullName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{student.studentId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="font-black">{student.absent} Days</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                        onClick={() => router.push(`/school/admin/messages?studentId=${student.id}&parentName=${encodeURIComponent(student.parent_name || '')}`)}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              {students.filter(s => s.absent > 3).length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No students with frequent absences.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function GradeDrillDownPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[400px]">
        <Spinner size="lg" className="text-primary" />
      </div>
    }>
      <GradeDrillDownContent />
    </Suspense>
  )
}
