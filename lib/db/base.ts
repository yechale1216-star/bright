"use client"

import { API_URL } from "@/lib/api-config"
import { fetchWithTimeout, RequestError } from "@/lib/utils/fetch-with-timeout"

export class BaseDatabase {
  // NOTE: No cached schoolId — always read fresh to prevent cross-school data leaks
  // after logout/login transitions in the same browser session.

  protected setSchoolId(schoolId: string | number) {
    // Deprecated: schoolId is now always derived fresh from the current user in localStorage.
    // This method is kept for backward compatibility but has no effect.
    console.warn("[BaseDatabase] setSchoolId() is deprecated. SchoolId is derived from current user.")
  }

  protected getSchoolId(): string {
    // Always read fresh — NEVER rely on a cached instance variable.
    // The db object is a module-level singleton, so a cached value would persist
    // across logout/login transitions and expose one school's data to another.
    if (typeof window === "undefined") return ""

    const user = this.getCurrentUser()
    const fromUser = user?.schoolId || user?.school_id || user?.school?.id
    if (fromUser) {
      return String(fromUser)
    }

    const xSchoolId = localStorage.getItem("x-school-id")
    if (xSchoolId) return xSchoolId

    try {
      const activeSchool = localStorage.getItem("active_school")
      if (activeSchool) {
        const parsed = JSON.parse(activeSchool)
        if (parsed?.id) return String(parsed.id)
      }
    } catch {}

    return ""
  }

  public getCurrentUser(): any {
    if (typeof window === "undefined") return null
    try {
      const data = localStorage.getItem("attendance_current_user")
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  protected getApiHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
    const schoolId = this.getSchoolId()
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    if (schoolId) {
      headers["x-school-id"] = schoolId
    }
    
    return headers
  }

  protected async handleError(res: Response): Promise<never> {
    if (res.status === 401) {
      console.warn("[BaseDatabase] Unauthorized response (401) - triggering session cleanup");
      // Use dynamic import to avoid potential circular dependencies if auth needs db
      const { authService } = await import("@/lib/auth/auth");
      authService.handleUnauthorized();
      throw new RequestError("Your session has expired. Please sign in again.", "unauthorized", 401)
    }

    let message = `HTTP ${res.status}: ${res.statusText}`
    try {
      const data = await res.json()
      message = data.message || data.error || message
    } catch {
      try {
        const text = await res.text()
        if (text && text.length < 200) message = text
      } catch {}
    }

    const type: RequestError["type"] =
      res.status === 403 ? "forbidden" :
      res.status === 404 ? "not_found" :
      res.status >= 500 ? "server" :
      "client"

    throw new RequestError(message, type, res.status)
  }

  /**
   * Enhanced fetch with timeout (20 s) and offline detection.
   * Delegates to fetchWithTimeout from the shared utility module.
   */
  protected fetch = fetchWithTimeout
}
