"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, ShieldCheck, ShieldAlert, Camera, RefreshCw, ArrowLeft } from "lucide-react"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { FaceVerificationCamera } from "@/components/school/face-verification-camera"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { API_URL } from "@/lib/api-config"

interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string
  profile_photo?: string
  faceEnrollment?: {
    id: string
    enrolledAt: string
  } | null
}

export function StaffFaceEnrollModal({
  open,
  onOpenChange,
  onEnrolled,
  /** When provided, the modal opens directly on the enroll camera for this user */
  preselectedUserId,
  preselectedUserName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnrolled?: () => void
  preselectedUserId?: string
  preselectedUserName?: string
}) {
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null)
  const [isEnrollCameraOpen, setIsEnrollCameraOpen] = useState(false)
  const [isSavingEnrollment, setIsSavingEnrollment] = useState(false)

  const getHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {}
    const token = localStorage.getItem("attendance_token")
    const schoolId = localStorage.getItem("x-school-id")
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    if (schoolId) headers["x-school-id"] = schoolId
    return headers
  }

  const loadStaff = async () => {
    setIsLoading(true)
    try {
      // Use /api/users which now includes faceEnrollment data
      const res = await apiFetch<{ success: boolean; data: StaffUser[] }>(
        `${API_URL}/api/users`,
        { headers: getHeaders() }
      )
      setStaffList(res.data ?? [])
    } catch (err: any) {
      console.error("Failed to load staff list:", err)
      // fallback: try attendance endpoint
      try {
        const records = await db.getStaffAttendance()
        const staffMap = new Map<string, StaffUser>()
        records.forEach((r: any) => {
          if (r.user && !staffMap.has(r.user.id)) {
            staffMap.set(r.user.id, r.user)
          }
        })
        setStaffList(Array.from(staffMap.values()))
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadStaff()
      setSearchTerm("")

      if (preselectedUserId) {
        // If a specific user was preselected, open camera immediately after load
        setSelectedStaff({
          id: preselectedUserId,
          full_name: preselectedUserName ?? "Staff Member",
          email: "",
          role: "",
        })
        setIsEnrollCameraOpen(true)
      } else {
        setSelectedStaff(null)
        setIsEnrollCameraOpen(false)
      }
    }
  }, [open, preselectedUserId, preselectedUserName])

  const filteredStaff = useMemo(() => {
    return staffList.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [staffList, searchTerm])

  const handleStartEnroll = (staff: StaffUser) => {
    setSelectedStaff(staff)
    setIsEnrollCameraOpen(true)
  }

  const isSavingEnrollmentRef = useRef(false)

  const handleFaceCaptured = async (result: { descriptor: number[] }) => {
    if (!selectedStaff || isSavingEnrollmentRef.current) return
    isSavingEnrollmentRef.current = true
    setIsSavingEnrollment(true)
    try {
      await db.enrollStaffFace(selectedStaff.id, result.descriptor)
      notifications.success(
        "Face Enrolled",
        `Biometric face template registered for ${selectedStaff.full_name}.`
      )
      setIsEnrollCameraOpen(false)
      setSelectedStaff(null)
      await loadStaff()
      if (onEnrolled) onEnrolled()
    } catch (err: any) {
      notifications.error("Enrollment Failed", err.message || "Failed to save biometric face template")
    } finally {
      setIsSavingEnrollment(false)
      isSavingEnrollmentRef.current = false
    }
  }

  const handleCameraCancel = () => {
    setIsEnrollCameraOpen(false)
    if (preselectedUserId) {
      // If opened for a specific user, close the whole modal
      onOpenChange(false)
    } else {
      setSelectedStaff(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-[24px]">
        {/* Camera view for enrolling a selected staff member */}
        {isEnrollCameraOpen && selectedStaff ? (
          <div className="flex flex-col h-full p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3">
                {!preselectedUserId && (
                  <button
                    onClick={handleCameraCancel}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                    <Camera className="w-5 h-5 text-primary" />
                    Enroll Face: {selectedStaff.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Select front or back camera and tap Start. Biometric landmarks are captured automatically once aligned.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 flex items-center justify-center">
              <FaceVerificationCamera
                mode="enroll"
                onVerified={handleFaceCaptured}
                onCancel={handleCameraCancel}
              />
            </div>
          </div>
        ) : (
          /* Staff list view */
          <div className="flex flex-col h-full p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <ShieldCheck className="w-6 h-6 text-primary" />
                Staff Biometric Face Enrollment
              </DialogTitle>
              <DialogDescription>
                Register or update 128-dimensional facial biometric descriptors for staff members. No raw photos are stored.
              </DialogDescription>
            </DialogHeader>

            {/* Search bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadStaff} disabled={isLoading} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            {/* Staff Roster Table */}
            <div className="flex-1 overflow-y-auto border rounded-xl min-h-0">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Biometric Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading staff directory...
                      </TableCell>
                    </TableRow>
                  ) : filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No staff members found{searchTerm ? ` matching "${searchTerm}"` : ""}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((staff) => {
                      const isEnrolled = !!staff.faceEnrollment?.id
                      return (
                        <TableRow key={staff.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border">
                                <AvatarImage src={staff.profile_photo || ""} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                  {staff.full_name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase() || "ST"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm leading-none">{staff.full_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{staff.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize font-medium text-xs">
                              {staff.role?.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isEnrolled ? (
                              <div>
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs">
                                  <ShieldCheck className="w-3 h-3" /> Enrolled
                                </Badge>
                                {staff.faceEnrollment?.enrolledAt && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {new Date(staff.faceEnrollment.enrolledAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30 gap-1 text-xs">
                                <ShieldAlert className="w-3 h-3" /> Not Enrolled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={isEnrolled ? "outline" : "default"}
                              onClick={() => handleStartEnroll(staff)}
                              className="gap-1.5 font-medium text-xs shadow-sm"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {isEnrolled ? "Re-enroll" : "Enroll Face"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
