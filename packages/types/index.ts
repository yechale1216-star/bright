/**
 * @brightpath/types
 * Shared type definitions for Bright Path portals
 */

export type UserRole =
  | "admin"
  | "school_admin"
  | "super_admin"
  | "academic_head"
  | "teacher"
  | "librarian"
  | "transport_manager"
  | "staff_attendance_officer"
  | "hr_officer"
  | "registrar"
  | "discipline_officer"
  | "staff"
  | "parent"
  | "student";

export const SCHOOL_STAFF_ROLES: readonly UserRole[] = [
  "admin",
  "school_admin",
  "super_admin",
  "academic_head",
  "teacher",
  "librarian",
  "transport_manager",
  "staff_attendance_officer",
  "hr_officer",
  "registrar",
  "discipline_officer",
  "staff",
] as const;

export const STUDENT_PARENT_ROLES: readonly UserRole[] = [
  "student",
  "parent",
] as const;

export interface BaseUser {
  id: string;
  email?: string;
  name?: string;
  full_name?: string;
  role: UserRole | string;
  schoolId?: string;
  phone?: string;
  profile_photo?: string | null;
}

export interface StudentProfile {
  id: string;
  studentId: string;
  studentCode: string;
  name: string;
  role: "student";
  grade?: string;
  section?: string;
  stream?: string | null;
  schoolId: string;
  schoolName: string;
  schoolLogo?: string;
  profile_photo?: string | null;
}

export interface ParentProfile extends BaseUser {
  role: "parent";
  phone: string;
}

export interface SchoolContext {
  id: string;
  name: string;
  logo?: string;
  customSchoolId?: string;
  role?: string;
}
