"use client"

export interface Student {
  id: string
  name?: string
  student_id?: string
  grade?: string
  stream?: string
  section?: string
  parent_email?: string
  parent_phone?: string
  parent_name?: string
  existingParentId?: string
  gender?: string
  date_of_birth?: string
  first_name?: string
  last_name?: string
  roll_number?: string
  schoolId?: string
  gradeId?: string
  sectionId?: string
  streamId?: string
  class_id?: string
  address?: string
  status?: string
  relationshipType?: string
  parent_address?: string
  parent_password?: string
  accountStatus?: string
  activation_code?: string | null
  activation_code_expires?: string | Date | null
  lifecycleStatus?: string
  lifecycleEffectiveDate?: string | Date | null
  suspensionEndDate?: string | Date | null
  destinationSchool?: string | null
  statusReason?: string | null
  activationSlip?: any
  enrollmentStatus?: string
}

export interface AttendanceRecord {
  id: string
  student_id: string
  attendance_date: string
  status: "present" | "late" | "absent" | "excused" | "Present" | "Late" | "Absent" | "Excused"
  remarks?: string
  note?: string
  created_at: string
  updated_at?: string
  schoolId?: string
  date?: string
  class_id?: string
  session?: "morning" | "afternoon" | null
  latitude?: number | null
  longitude?: number | null
  locationVerified?: boolean | null
  locationDistance?: number | null
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  class_id?: string
  grade?: string
  section?: string
  stream?: string
  subject?: string
  gradeId?: string
  sectionId?: string
  streamId?: string
  subjectId?: string
  role?: string
  schoolId?: string
  gradeObj?: any
  sectionObj?: any
  streamObj?: any
  teacher?: {
    id: string
    full_name: string
    email: string
    profile_photo?: string
  }
  class?: {
    id: string
    name: string
    grade: string
    section: string
  }
}
