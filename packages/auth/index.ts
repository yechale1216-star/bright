/**
 * @brightpath/auth
 * Shared authentication storage, tokens, and verification utilities
 */

export { authStorage, AUTH_KEYS } from "../../lib/auth/auth-storage";
export { authService, type LoginCredentials, type AuthResponse } from "../../lib/auth/auth";
export { SCHOOL_STAFF_ROLES, STUDENT_PARENT_ROLES, type UserRole } from "../types";

/**
 * Checks if a given role belongs to school staff
 */
export function isSchoolStaffRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return (
    normalized === "admin" ||
    normalized === "school_admin" ||
    normalized === "school-admin" ||
    normalized === "super_admin" ||
    normalized === "academic_head" ||
    normalized === "teacher" ||
    normalized === "librarian" ||
    normalized === "transport_manager" ||
    normalized === "staff_attendance_officer" ||
    normalized === "hr_officer" ||
    normalized === "registrar" ||
    normalized === "discipline_officer" ||
    normalized === "staff"
  );
}

/**
 * Checks if a given role belongs to student or parent
 */
export function isStudentOrParentRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "student" || normalized === "parent";
}
