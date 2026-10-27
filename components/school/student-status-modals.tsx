"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { notifications } from "@/lib/utils/notifications"
import { db, type Student } from "@/lib/db/database"
import { ShieldAlert, History, UserCheck, AlertTriangle, UserX, ArrowRightLeft, GraduationCap, Archive, Calendar, Info, Clock, CheckCircle2 } from "lucide-react"

export interface ChangeStatusModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
  onSuccess: () => void
}

export function ChangeStatusModal({ isOpen, onClose, student, onSuccess }: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState<string>("")
  const [effectiveDate, setEffectiveDate] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [suspensionEndDate, setSuspensionEndDate] = useState<string>("")
  const [destinationSchool, setDestinationSchool] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && student) {
      setNewStatus("")
      setEffectiveDate(new Date().toISOString().split("T")[0])
      setReason("")
      setSuspensionEndDate("")
      setDestinationSchool("")
    }
  }, [isOpen, student])

  if (!student) return null

  const currentStatus = (student.status || "ACTIVE").toUpperCase()

  // Allowed transitions per requirement:
  // ACTIVE -> SUSPENDED, WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED
  // SUSPENDED -> ACTIVE, WITHDRAWN, TRANSFERRED, ARCHIVED
  // WITHDRAWN -> ARCHIVED (re-enroll is a separate flow)
  // TRANSFERRED -> ARCHIVED (re-enroll is a separate flow)
  // GRADUATED -> ARCHIVED
  // ARCHIVED -> none (terminal)
  const getAvailableStatuses = () => {
    switch (currentStatus) {
      case "ACTIVE":
        return [
          { value: "SUSPENDED", label: "Suspended (Temporary disciplinary action)" },
          { value: "WITHDRAWN", label: "Withdrawn (Officially left the school)" },
          { value: "TRANSFERRED", label: "Transferred (Transferred to another school)" },
          { value: "ARCHIVED", label: "Archived (Historical retention)" },
        ]
      case "SUSPENDED":
        return [
          { value: "ACTIVE", label: "Active (Restore permissions)" },
          { value: "WITHDRAWN", label: "Withdrawn (Officially departed)" },
          { value: "TRANSFERRED", label: "Transferred (Transferred to another school)" },
          { value: "ARCHIVED", label: "Archived (Historical retention)" },
        ]
      case "WITHDRAWN":
      case "TRANSFERRED":
      case "GRADUATED":
        return [
          { value: "ARCHIVED", label: "Archived (Historical retention)" },
        ]
      default:
        return []
    }
  }

  const availableOptions = getAvailableStatuses()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStatus) {
      notifications.error("Validation Error", "Please select a target lifecycle status.")
      return
    }
    if (!effectiveDate) {
      notifications.error("Validation Error", "Effective date is required.")
      return
    }
    if (!reason || reason.trim().length < 3) {
      notifications.error("Validation Error", "Please provide a valid reason (minimum 3 characters).")
      return
    }
    if (newStatus === "SUSPENDED") {
      if (!suspensionEndDate) {
        notifications.error("Validation Error", "Suspension end date is required.")
        return
      }
      if (new Date(suspensionEndDate) <= new Date(effectiveDate)) {
        notifications.error("Validation Error", "Suspension end date must be after the effective date.")
        return
      }
    }

    setIsSubmitting(true)
    try {
      await db.changeStudentStatus(student.id, {
        newStatus,
        effectiveDate,
        reason: reason.trim(),
        destinationSchool: newStatus === "TRANSFERRED" ? destinationSchool.trim() : undefined,
        suspensionEndDate: newStatus === "SUSPENDED" ? suspensionEndDate : undefined,
      })
      notifications.success("Status Updated", `Student status has been changed to ${newStatus}.`)
      onSuccess()
      onClose()
    } catch (err: any) {
      notifications.error("Error Changing Status", err.message || "Failed to update student status.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Change Student Status
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage lifecycle transitions for {student.name || "this student"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Current Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <p className="font-bold text-foreground">{student.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{student.student_id}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block mb-0.5">Current Status</span>
              <Badge variant="outline" className="font-black text-[11px] uppercase tracking-wider">
                {currentStatus}
              </Badge>
            </div>
          </div>

          {availableOptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                {currentStatus === "ARCHIVED"
                  ? "Archived student records are retained for historical purposes and cannot be transitioned to another status."
                  : "No valid direct status transitions are available for this record. Use Re-Enroll to restore departed students."}
              </span>
            </div>
          ) : (
            <>
              {/* New Status Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">New Lifecycle Status *</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue placeholder="Select target status..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {availableOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Effective Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Effective Date *</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              {/* Conditional: Suspension End Date */}
              {newStatus === "SUSPENDED" && (
                <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/60">
                  <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Suspension End Date *
                  </Label>
                  <Input
                    type="date"
                    value={suspensionEndDate}
                    onChange={(e) => setSuspensionEndDate(e.target.value)}
                    className="rounded-xl h-10 text-xs bg-white dark:bg-slate-900"
                  />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    The student will be temporarily restricted until this date.
                  </p>
                </div>
              )}

              {/* Conditional: Destination School */}
              {newStatus === "TRANSFERRED" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Destination School Name</Label>
                  <Input
                    placeholder="e.g. Saint Joseph High School"
                    value={destinationSchool}
                    onChange={(e) => setDestinationSchool(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Reason / Authorization Notes *</Label>
                <Textarea
                  placeholder="Provide supporting reasons and official authorization details..."
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-xl text-xs resize-none"
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold">
              Cancel
            </Button>
            {availableOptions.length > 0 && (
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="rounded-xl text-xs font-black uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                {isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm Status Change
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface StatusHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
}

export function StatusHistoryModal({ isOpen, onClose, student }: StatusHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && student?.id) {
      setIsLoading(true)
      db.getStudentStatusHistory(student.id)
        .then((items) => setHistory(items || []))
        .catch((err) => {
          console.error("Failed to load status history:", err)
          notifications.error("Error", "Could not fetch status history.")
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, student])

  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
            <History className="h-5 w-5 text-primary" />
            Status & Lifecycle History
          </DialogTitle>
          <DialogDescription className="text-xs">
            Complete chronological audit trail of status changes for {student.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          {isLoading ? (
            <div className="py-12 flex justify-center items-center gap-2 text-xs text-muted-foreground font-semibold">
              <Spinner size="sm" /> Loading status history...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground font-medium">
              No status changes recorded for this student yet. Student was enrolled as {student.status || "ACTIVE"}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase text-slate-500">
                        {item.fromStatus}
                      </Badge>
                      <span className="text-slate-400 font-bold">→</span>
                      <Badge className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                        {item.toStatus}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 font-medium pl-1">
                    {item.reason}
                  </p>

                  {item.metadata?.destinationSchool && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 pl-1 font-semibold">
                      Destination School: {item.metadata.destinationSchool}
                    </p>
                  )}

                  {item.metadata?.suspensionEndDate && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 pl-1 font-semibold">
                      Suspension Period: Until {new Date(item.metadata.suspensionEndDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface ReEnrollModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
  activeAcademicYear: any
  onSuccess: () => void
}

export function ReEnrollModal({ isOpen, onClose, student, activeAcademicYear, onSuccess }: ReEnrollModalProps) {
  const [grades, setGrades] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [streams, setStreams] = useState<any[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>("")
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [selectedStreamId, setSelectedStreamId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingStructure, setIsLoadingStructure] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsLoadingStructure(true)
      Promise.all([
        db.getGrades ? db.getGrades() : Promise.resolve([]),
        db.getStreams ? db.getStreams() : Promise.resolve([]),
      ])
        .then(([gList, strList]) => {
          setGrades(gList || [])
          setStreams(strList || [])
          if ((student as any)?.gradeId) setSelectedGradeId((student as any).gradeId)
          if ((student as any)?.streamId) setSelectedStreamId((student as any).streamId)
        })
        .catch((err) => console.error("Failed to load academic structure:", err))
        .finally(() => setIsLoadingStructure(false))
    }
  }, [isOpen, student])

  useEffect(() => {
    if (selectedGradeId) {
      db.getSections ? db.getSections(selectedGradeId, selectedStreamId || undefined)
        .then((secList: any) => {
          setSections(secList || [])
          if (secList && secList.length > 0) {
            setSelectedSectionId(secList[0].id)
          } else {
            setSelectedSectionId("")
          }
        })
        .catch(() => setSections([])) : setSections([])
    } else {
      setSections([])
      setSelectedSectionId("")
    }
  }, [selectedGradeId, selectedStreamId])

  if (!student) return null

  const handleReEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAcademicYear?.id) {
      notifications.error("Error", "No active academic year found in the system.")
      return
    }
    if (!selectedGradeId || !selectedSectionId) {
      notifications.error("Validation Error", "Please select a grade and section for re-enrollment.")
      return
    }

    setIsSubmitting(true)
    try {
      await db.reEnrollStudent(student.id, {
        academicYearId: activeAcademicYear.id,
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        streamId: selectedStreamId || null,
      })
      notifications.success("Student Re-Enrolled", `${student.name || "Student"} has been re-enrolled into ${activeAcademicYear.name || "the current academic year"}.`)
      onSuccess()
      onClose()
    } catch (err: any) {
      notifications.error("Re-Enrollment Failed", err.message || "Failed to re-enroll student.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
            <GraduationCap className="h-5 w-5 text-primary" />
            Re-Enroll Former Student
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create an official new enrollment record for {student.name} in academic year {activeAcademicYear?.name || "current"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReEnroll} className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-foreground">{student.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{student.student_id}</p>
              </div>
              <Badge variant="outline" className="font-bold text-[10px] uppercase text-rose-600 border-rose-200">
                Current: {student.status}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 border-t pt-2 border-slate-200 dark:border-slate-800">
              Target Academic Year: <strong className="text-foreground">{activeAcademicYear?.name || "Active Year"}</strong>
            </p>
          </div>

          {isLoadingStructure ? (
            <div className="py-6 flex justify-center items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="sm" /> Loading class options...
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Grade Level *</Label>
                <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue placeholder="Select Grade..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs font-medium">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {streams.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Academic Stream (if applicable)</Label>
                  <Select value={selectedStreamId || "none"} onValueChange={(val) => setSelectedStreamId(val === "none" ? "" : val)}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <SelectValue placeholder="None / General" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="text-xs font-medium">None / General</SelectItem>
                      {streams.map((str) => (
                        <SelectItem key={str.id} value={str.id} className="text-xs font-medium">
                          {str.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Assignment *</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={!selectedGradeId || sections.length === 0}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue placeholder={sections.length === 0 ? "No sections available" : "Select Section..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {sections.map((sec) => (
                      <SelectItem key={sec.id} value={sec.id} className="text-xs font-medium">
                        Section {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedGradeId || !selectedSectionId}
              className="rounded-xl text-xs font-black uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isSubmitting ? <Spinner size="sm" /> : <GraduationCap className="h-4 w-4" />}
              Complete Re-Enrollment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

