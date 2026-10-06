"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/hooks/use-toast"
import { 
  BookOpen, Users, ChevronRight, Hash, Phone, Mail, User as UserIcon,
  Calendar, MapPin, Contact, AlertTriangle
} from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { db, type Student } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { cn } from "@/lib/utils/utils"
import { DisciplineApi, type StudentDiscipline } from "@/lib/discipline-service"
import { useCalendar } from "@/lib/context/calendar-context"

interface TeacherAssignment {
  id: string
  class_id: string
  class_name: string
  grade: { id: string; name: string }
  section: { id: string; name: string }
  stream?: { id: string; name: string }
  subject?: string
}


export function TeacherView() {
  const { formatDate } = useCalendar()
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<Student | null>(null)
  const [studentIncidents, setStudentIncidents] = useState<StudentDiscipline[]>([])
  const [isLoadingProfileDetails, setIsLoadingProfileDetails] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadAssignmentsAndStudents()
  }, [])

  useEffect(() => {
    if (selectedStudentProfile?.id) {
      setIsLoadingProfileDetails(true)
      DisciplineApi.getIncidents({ studentId: selectedStudentProfile.id, limit: 10 })
        .then((incidentRes) => {
          setStudentIncidents(incidentRes?.items || [])
        })
        .catch((err) => {
          console.error("Error loading student profile details:", err)
        })
        .finally(() => {
          setIsLoadingProfileDetails(false)
        })
    } else {
      setStudentIncidents([])
    }
  }, [selectedStudentProfile?.id])

  const loadAssignmentsAndStudents = async () => {
    setIsLoading(true)
    try {
      const currentUser = authService.getCurrentUser()

      if (!currentUser || !currentUser.id) {
        console.error("Missing essential user data in localStorage")
        toast({
          title: "Session Error",
          description: "Please log out and log back in to refresh your session.",
          variant: "destructive",
        })
        return
      }

      // Use teacherId if available, otherwise fallback to the user id
      // The backend service is capable of resolving user.id to teacher.id
      const targetId = (currentUser as any).teacher_id || currentUser.teacherId || currentUser.id
      
      let assignmentsData = await db.getTeacherAssignments(currentUser.schoolId || "single-school", targetId)

      if (!assignmentsData || assignmentsData.length === 0) {
        try {
          const allAssignments = await db.getTeacherAssignments(currentUser.schoolId || "single-school")
          assignmentsData = (allAssignments || []).filter((a: any) =>
            a.teacher_id === currentUser.id ||
            a.teacher_id === (currentUser as any).teacher_id ||
            a.teacherId === currentUser.id ||
            a.teacher?.id === currentUser.id ||
            a.teacher?.id === (currentUser as any).teacher_id ||
            a.teacher?.user_id === currentUser.id ||
            (currentUser.email && a.teacher?.email && a.teacher.email.toLowerCase() === currentUser.email.toLowerCase())
          ) as any
        } catch (e) {
          console.warn("Fallback assignment lookup failed in TeacherView:", e)
        }
      }

      setAssignments(assignmentsData as any)

      const allStudents = await db.getStudents(false, "ACTIVE")
      
      // Filter students only for classes assigned to this teacher
      const filteredStudents = (!assignmentsData || assignmentsData.length === 0)
        ? []
        : (allStudents || []).filter((student: Student) => {
            const isStudentActive = !student.status || student.status.toUpperCase() === "ACTIVE"
            if (!isStudentActive) return false

            return assignmentsData.some((cls: any) => {
              const studentGrade = String(student.grade || "").toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()
              const clsGradeName = String(
                (typeof cls.grade === "object" && cls.grade !== null ? cls.grade.name : cls.grade) ||
                cls.gradeObj?.name ||
                ""
              ).toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()

              const gradeMatch = studentGrade !== "" && clsGradeName !== "" && (studentGrade === clsGradeName || studentGrade.replace(/^0+/, "") === clsGradeName.replace(/^0+/, ""))
              if (!gradeMatch) return false

              const studentSection = String(student.section || "").toLowerCase().replace(/^section\s+/i, "").trim()
              const clsSectionName = String(
                (typeof cls.section === "object" && cls.section !== null ? cls.section.name : cls.section) ||
                cls.sectionObj?.name ||
                ""
              ).toLowerCase().replace(/^section\s+/i, "").trim()

              const hasSectionConstraint = clsSectionName !== "" && clsSectionName !== "all" && clsSectionName !== "general"
              if (hasSectionConstraint) {
                const sectionMatch = studentSection !== "" && (studentSection === clsSectionName || studentSection.includes(clsSectionName) || clsSectionName.includes(studentSection))
                if (!sectionMatch) return false
              }

              const studentStream = String(student.stream || "").toLowerCase().trim()
              const clsStreamName = String(
                (typeof cls.stream === "object" && cls.stream !== null ? cls.stream.name : cls.stream) ||
                cls.streamObj?.name ||
                cls.streamId ||
                ""
              ).toLowerCase().trim()

              const hasStreamConstraint = cls.streamId || (clsStreamName !== "" && clsStreamName !== "all" && clsStreamName !== "general" && clsStreamName !== "none")
              if (hasStreamConstraint && studentStream && clsStreamName) {
                if (studentStream !== clsStreamName && !studentStream.includes(clsStreamName) && !clsStreamName.includes(studentStream)) {
                  return false
                }
              }

              return true
            })
          })

      setStudents(filteredStudents as any)
      if (assignmentsData.length > 0) {
        setSelectedAssignment(assignmentsData[0] as any)
      }

      console.log("Loaded assignments:", assignmentsData.length)
      console.log("Loaded students for assigned classes:", filteredStudents.length)
    } catch (error) {
      console.error("Error loading teacher data:", error)
    } finally {
      setIsLoading(false)
    }
  }


  const displayedStudents = useMemo(() => {
    if (!selectedAssignment) return []
    const cls = selectedAssignment as any
    const clsGradeName = String(
      (typeof cls.grade === "object" && cls.grade !== null ? cls.grade.name : cls.grade) ||
      cls.gradeObj?.name ||
      ""
    ).toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()

    const clsSectionName = String(
      (typeof cls.section === "object" && cls.section !== null ? cls.section.name : cls.section) ||
      cls.sectionObj?.name ||
      ""
    ).toLowerCase().replace(/^section\s+/i, "").trim()

    const clsStreamName = String(
      (typeof cls.stream === "object" && cls.stream !== null ? cls.stream.name : cls.stream) ||
      cls.streamObj?.name ||
      cls.streamId ||
      ""
    ).toLowerCase().trim()

    return students.filter((student: Student) => {
      const studentGrade = String(student.grade || "").toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()
      const studentSection = String(student.section || "").toLowerCase().replace(/^section\s+/i, "").trim()
      const studentStream = String(student.stream || "").toLowerCase().trim()

      const gradeMatch = studentGrade !== "" && clsGradeName !== "" && (studentGrade === clsGradeName || studentGrade.replace(/^0+/, "") === clsGradeName.replace(/^0+/, ""))
      if (!gradeMatch) return false

      const hasSectionConstraint = clsSectionName !== "" && clsSectionName !== "all" && clsSectionName !== "general"
      if (hasSectionConstraint) {
        const sectionMatch = studentSection !== "" && (studentSection === clsSectionName || studentSection.includes(clsSectionName) || clsSectionName.includes(studentSection))
        if (!sectionMatch) return false
      }

      const hasStreamConstraint = cls.streamId || (clsStreamName !== "" && clsStreamName !== "all" && clsStreamName !== "general" && clsStreamName !== "none")
      if (hasStreamConstraint && studentStream && clsStreamName) {
        if (studentStream !== clsStreamName && !studentStream.includes(clsStreamName) && !clsStreamName.includes(studentStream)) {
          return false
        }
      }

      return true
    })
  }, [selectedAssignment, students])

  if (isLoading) {
    return <PageSkeleton variant="cards" />
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="px-1 md:px-0 pt-safe">
        <h2 className="text-xl md:text-3xl font-black text-foreground uppercase tracking-tight leading-none">
          My Classes
        </h2>
        <p className="text-sm font-bold text-muted-foreground/60 mt-2">Manage your classes & students</p>
      </div>

      {assignments.length === 0 ? (
        <Card className="rounded-[32px] border-none shadow-sm bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="py-20 text-center">
            <div className="w-20 h-20 bg-background rounded-[28px] shadow-sm flex items-center justify-center mx-auto mb-6 border border-border/50">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-black text-foreground uppercase tracking-tight">No Assignments</p>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-2">Your classes will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Assignments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1 md:px-0">
            {assignments.map((assignment) => {
              const isSelected = selectedAssignment?.id === assignment.id;
              return (
                <div
                  key={assignment.id}
                  className={cn(
                    "group relative overflow-hidden p-6 rounded-[32px] border-2 transition-all duration-500 cursor-pointer active:scale-[0.98]",
                    isSelected 
                      ? "bg-primary border-primary shadow-2xl shadow-primary/30" 
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-primary/30"
                  )}
                  onClick={() => setSelectedAssignment(assignment)}
                >
                  <div className="flex flex-col h-full justify-between gap-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em]",
                          isSelected ? "text-white/60" : "text-primary"
                        )}>
                          {assignment.subject || "All Subjects"}
                        </p>
                        <h3 className={cn(
                          "text-xl font-black uppercase tracking-tight leading-none",
                          isSelected ? "text-white" : "text-foreground"
                        )}>
                          Grade {String(typeof assignment.grade === 'object' ? assignment.grade?.name : (assignment.grade || '')).replace(/^Grade\s+/i, '').trim()} {typeof assignment.section === 'object' ? assignment.section?.name : (assignment.section || '')}
                        </h3>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-[20px] flex items-center justify-center transition-all duration-500",
                        isSelected ? "bg-white/20 text-white rotate-6 scale-110" : "bg-primary/10 text-primary group-hover:rotate-6"
                      )}>
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={cn(
                            "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black",
                            isSelected ? "bg-white/20 border-primary text-white" : "bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400"
                          )}>
                            {i}
                          </div>
                        ))}
                      </div>
                      <div className={cn(
                        "font-black text-[10px] uppercase tracking-widest flex items-center gap-1",
                        isSelected ? "text-white" : "text-muted-foreground/60"
                      )}>
                        Browse Students <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Decorative background overlay */}
                  <div className={cn(
                    "absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-3xl transition-opacity duration-500",
                    isSelected ? "bg-white/20 opacity-100" : "bg-primary/10 opacity-0 group-hover:opacity-100"
                  )} />
                </div>
              );
            })}
          </div>

          {/* Students List for Selected Class */}
          {selectedAssignment && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-end justify-between px-2 md:px-0">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Student Roster</p>
                  <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">
                    Grade {String(typeof selectedAssignment.grade === 'object' ? (selectedAssignment.grade as any)?.name : (selectedAssignment.grade || '')).replace(/^Grade\s+/i, '').trim()} Sec {typeof selectedAssignment.section === 'object' ? (selectedAssignment.section as any)?.name : (selectedAssignment.section || '')} {selectedAssignment.stream ? `• ${typeof selectedAssignment.stream === 'object' ? (selectedAssignment.stream as any)?.name : selectedAssignment.stream}` : ''}
                  </h3>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-transform">
                  <span className="text-xs font-black text-foreground uppercase tracking-widest">{displayedStudents.length} Total</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {displayedStudents.length === 0 ? (
                  <div className="py-24 text-center bg-slate-50 dark:bg-slate-900/30 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-20 h-20 bg-background rounded-[28px] shadow-sm flex items-center justify-center mx-auto mb-6">
                      <Users className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No students recorded in this class</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Student List */}
                    <div className="md:hidden space-y-3">
                      {displayedStudents.map((student) => (
                        <div 
                          key={student.id} 
                          className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] shadow-sm active:scale-[0.97] transition-all hover:shadow-md cursor-pointer group"
                          onClick={() => setSelectedStudentProfile(student)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-primary font-black border border-slate-100 dark:border-slate-700/50 shadow-inner group-hover:scale-105 transition-transform">
                              {student.name?.charAt(0) || <UserIcon className="w-5 h-5 text-slate-300" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-foreground uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">{student.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight flex items-center gap-1">
                                  <Hash className="w-3 h-3" /> {student.student_id || "NO-ID"}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  student.gender?.toLowerCase() === 'female' ? "text-pink-500" : "text-blue-500"
                                )}>
                                  {student.gender || "—"}
                                </span>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                               <ChevronRight className="w-5 h-5" />
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 flex gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <Phone className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[10px] font-black text-foreground">{student.parent_phone || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                <Mail className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[10px] font-black text-foreground truncate">{student.parent_email || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Student Table */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-8 py-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Student</th>
                            <th className="px-8 py-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">ID & Gender</th>
                            <th className="px-8 py-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Contact</th>
                            <th className="px-8 py-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                          {displayedStudents.map((student) => (
                            <tr 
                              key={student.id} 
                              className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 cursor-pointer"
                              onClick={() => setSelectedStudentProfile(student)}
                            >
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-primary font-black border border-slate-100 dark:border-slate-700/50">
                                    {student.name?.charAt(0) || "?"}
                                  </div>
                                  <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{student.name}</p>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit">
                                    #{student.student_id || "N/A"}
                                  </span>
                                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{student.gender || "—"}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                    <Phone className="w-3 h-3 text-emerald-500" /> {student.parent_phone || "—"}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60">
                                    <Mail className="w-3 h-3 text-blue-500" /> {student.parent_email || "—"}
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="inline-flex items-center h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-primary group-hover:text-white transition-all duration-300 justify-center">
                                  <ChevronRight className="w-5 h-5" />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Student Profile Dialog */}
      <Dialog open={!!selectedStudentProfile} onOpenChange={(open) => !open && setSelectedStudentProfile(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-[32px] border-none shadow-2xl bg-white dark:bg-slate-900">
          {selectedStudentProfile && (
            <div className="space-y-6 pb-6">
              {/* Header Banner */}
              <div className="relative bg-gradient-to-br from-primary via-primary/95 to-indigo-700 p-6 md:p-8 text-white rounded-t-[32px] overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Users className="w-48 h-48 -mr-10 -mt-10" />
                </div>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-5 relative z-10 text-center md:text-left">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0">
                    {selectedStudentProfile.name?.charAt(0) || <UserIcon className="w-10 h-10" />}
                  </div>

                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 font-mono text-xs">
                        #{selectedStudentProfile.student_id || "NO-ID"}
                      </Badge>
                      <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs">
                        Grade {String(selectedStudentProfile.grade || "").replace(/^Grade\s+/i, "")} - {selectedStudentProfile.section}
                      </Badge>
                      {selectedStudentProfile.stream && (
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs">
                          {selectedStudentProfile.stream}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                      {selectedStudentProfile.name}
                    </h2>
                    <p className="text-xs font-bold text-white/80 uppercase tracking-widest">
                      {selectedStudentProfile.gender || "Gender not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="px-6 md:px-8 space-y-6">

                {/* Quick Action Buttons */}
                {(selectedStudentProfile.parent_phone || selectedStudentProfile.parent_email) && (
                  <div className="flex flex-wrap gap-3">
                    {selectedStudentProfile.parent_phone && (
                      <Button
                        asChild
                        className="rounded-2xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all"
                      >
                        <a href={`tel:${selectedStudentProfile.parent_phone}`}>
                          <Phone className="w-4 h-4" /> Call Parent ({selectedStudentProfile.parent_phone})
                        </a>
                      </Button>
                    )}
                    {selectedStudentProfile.parent_email && (
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-2xl gap-2 font-bold border-slate-200 dark:border-slate-700"
                      >
                        <a href={`mailto:${selectedStudentProfile.parent_email}`}>
                          <Mail className="w-4 h-4" /> Email Guardian
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Personal Info */}
                  <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-primary" /> Personal Information
                    </h4>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Student ID</span>
                        <span className="font-bold text-foreground font-mono">{selectedStudentProfile.student_id || "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Grade & Section</span>
                        <span className="font-bold text-foreground">Grade {selectedStudentProfile.grade} ({selectedStudentProfile.section})</span>
                      </div>
                      {selectedStudentProfile.stream && (
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                          <span className="text-muted-foreground font-medium">Academic Stream</span>
                          <span className="font-bold text-foreground">{selectedStudentProfile.stream}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Gender</span>
                        <span className="font-bold text-foreground capitalize">{selectedStudentProfile.gender || "—"}</span>
                      </div>
                      {selectedStudentProfile.date_of_birth && (
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                          <span className="text-muted-foreground font-medium">Date of Birth</span>
                          <span className="font-bold text-foreground">{formatDate(selectedStudentProfile.date_of_birth)}</span>
                        </div>
                      )}
                      {selectedStudentProfile.address && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground font-medium">Home Address</span>
                          <span className="font-bold text-foreground text-right truncate max-w-[160px]">{selectedStudentProfile.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Guardian Info */}
                  <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                      <Contact className="w-4 h-4 text-emerald-500" /> Guardian / Parent
                    </h4>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Guardian Name</span>
                        <span className="font-bold text-foreground">{selectedStudentProfile.parent_name || "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Relationship</span>
                        <span className="font-bold text-foreground">{selectedStudentProfile.relationshipType || "Guardian"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Phone Number</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{selectedStudentProfile.parent_phone || "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-muted-foreground font-medium">Email Address</span>
                        <span className="font-bold text-foreground truncate max-w-[160px]">{selectedStudentProfile.parent_email || "—"}</span>
                      </div>
                      {selectedStudentProfile.parent_address && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground font-medium">Guardian Address</span>
                          <span className="font-bold text-foreground text-right truncate max-w-[160px]">{selectedStudentProfile.parent_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conduct & Incidents */}
                {studentIncidents.length > 0 && (
                  <div className="p-5 bg-amber-50/60 dark:bg-amber-950/20 rounded-3xl border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Discipline Records ({studentIncidents.length})
                    </h4>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {studentIncidents.map((incident) => (
                        <div key={incident.id} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-100 dark:border-slate-800 text-xs flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-foreground">{incident.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{incident.categoryName} • {formatDate(incident.date)}</p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase font-bold shrink-0",
                            incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? "border-rose-300 text-rose-600 bg-rose-50" : "border-amber-300 text-amber-600 bg-amber-50"
                          )}>
                            {incident.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

