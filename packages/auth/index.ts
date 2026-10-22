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
  return Boolean(normalized && normalized !== "student" && normalized !== "parent");
}

/**
 * Checks if a given role belongs to student or parent
 */
export function isStudentOrParentRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "student" || normalized === "parent";
}
