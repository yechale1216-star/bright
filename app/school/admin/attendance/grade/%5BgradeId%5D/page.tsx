"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, User, TrendingUp, Calendar, AlertCircle, MessageSquare } from "lucide-react"
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
      <div className="flex items-center justify-center h-[400px]">
        <Spinner size="lg" className="text-primary" />
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
        <Card className="md:col-span-2 border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Student List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
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
                {students.map((student) => (
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
