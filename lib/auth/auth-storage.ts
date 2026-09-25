"use client"

import { Preferences } from "@capacitor/preferences"
import { Capacitor } from "@capacitor/core"

/**
 * Resilient, cross-platform auth storage helper.
 *
 * Keeps critical authentication tokens and session data in sync between:
 * 1. Web DOM storage (`localStorage`)
 * 2. Native Android SharedPreferences (via `@capacitor/preferences`)
 *
 * This ensures auth survives:
 * - Android Recent Apps swiping/closure
 * - Process death by Android OS
 * - Activity recreation
 * - Webview storage delay / cache recreation
 */

export const AUTH_KEYS = {
  TOKEN: "attendance_token",
  USER: "attendance_current_user",
  SESSION_ID: "_zt_session_id",
  SCHOOL_ID: "x-school-id",
  FEATURES: "attendance_features",
  AVAILABLE_SCHOOLS: "available_schools",
  PARENT_STUDENTS: "parent_students",
  PARENT_SELECTED_STUDENT: "parent_selected_student_id",
  ACTIVE_SCHOOL: "active_school",
} as const

class AuthStorage {
  private isClient(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined"
  }

  private isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  /**
   * Restores stored auth credentials from Native Preferences into localStorage
   * on app cold start if localStorage was cleared or not yet hydrated.
   */
  async restoreSession(): Promise<{ token: string | null; userStr: string | null }> {
    if (!this.isClient()) return { token: null, userStr: null }

    let token = localStorage.getItem(AUTH_KEYS.TOKEN)
    let userStr = localStorage.getItem(AUTH_KEYS.USER)

    // If already in localStorage, ensure native preferences have it as backup
    if (token && userStr) {
      if (this.isNative()) {
        this.backupToNative(token, userStr).catch(() => {})
      }
      return { token, userStr }
    }

    // If missing from localStorage, attempt recovery from Native Preferences
    if (this.isNative()) {
      try {
        const [nativeTokenRes, nativeUserRes, nativeSchoolRes] = await Promise.all([
          Preferences.get({ key: AUTH_KEYS.TOKEN }),
          Preferences.get({ key: AUTH_KEYS.USER }),
          Preferences.get({ key: AUTH_KEYS.SCHOOL_ID }),
        ])

        const recoveredToken = nativeTokenRes.value
        const recoveredUser = nativeUserRes.value
        const recoveredSchool = nativeSchoolRes.value

        if (recoveredToken && recoveredUser) {
          console.log("[AuthStorage] Restored session from native Preferences on cold start")
          localStorage.setItem(AUTH_KEYS.TOKEN, recoveredToken)
          localStorage.setItem(AUTH_KEYS.USER, recoveredUser)
          if (recoveredSchool) {
            localStorage.setItem(AUTH_KEYS.SCHOOL_ID, recoveredSchool)
          }

          // Also restore session ID if missing
          const nativeSessionId = (await Preferences.get({ key: AUTH_KEYS.SESSION_ID })).value
          if (nativeSessionId) {
            localStorage.setItem(AUTH_KEYS.SESSION_ID, nativeSessionId)
          }

          token = recoveredToken
          userStr = recoveredUser
        }
      } catch (err) {
        console.warn("[AuthStorage] Failed to recover session from native preferences:", err)
      }
    }

    return { token, userStr }
  }

  /**
   * Persists authentication token and user to both localStorage and native storage.
   */
  async setSession(token: string | null, user: any, schoolId?: string, sessionId?: string): Promise<void> {
    if (!this.isClient()) return

    const userStr = typeof user === "string" ? user : JSON.stringify(user)

    if (token) {
      localStorage.setItem(AUTH_KEYS.TOKEN, token)
    }
    if (userStr) {
      localStorage.setItem(AUTH_KEYS.USER, userStr)
    }
    if (schoolId) {
      localStorage.setItem(AUTH_KEYS.SCHOOL_ID, schoolId)
    }
    if (sessionId) {
      localStorage.setItem(AUTH_KEYS.SESSION_ID, sessionId)
    }

    if (this.isNative()) {
      try {
        const promises: Promise<any>[] = []
        if (token) promises.push(Preferences.set({ key: AUTH_KEYS.TOKEN, value: token }))
        if (userStr) promises.push(Preferences.set({ key: AUTH_KEYS.USER, value: userStr }))
        if (schoolId) promises.push(Preferences.set({ key: AUTH_KEYS.SCHOOL_ID, value: schoolId }))
        if (sessionId) promises.push(Preferences.set({ key: AUTH_KEYS.SESSION_ID, value: sessionId }))
        await Promise.all(promises)
      } catch (err) {
        console.warn("[AuthStorage] Failed to persist session to native preferences:", err)
      }
    }
  }

  /**
   * Updates only the access token (e.g. after refresh).
   */
  async setToken(token: string): Promise<void> {
    if (!this.isClient()) return
    localStorage.setItem(AUTH_KEYS.TOKEN, token)
    if (this.isNative()) {
      Preferences.set({ key: AUTH_KEYS.TOKEN, value: token }).catch(() => {})
    }
  }

  /**
   * Retrieves the current access token.
   */
  getToken(): string | null {
    if (!this.isClient()) return null
    return localStorage.getItem(AUTH_KEYS.TOKEN)
  }

  /**
   * Retrieves the parsed user object.
   */
  getUser<T = any>(): T | null {
    if (!this.isClient()) return null
    try {
      const u = localStorage.getItem(AUTH_KEYS.USER)
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  }

  /**
   * Asynchronously backs up existing localStorage keys to native preferences.
   */
  private async backupToNative(token: string, userStr: string): Promise<void> {
    try {
      await Promise.all([
        Preferences.set({ key: AUTH_KEYS.TOKEN, value: token }),
        Preferences.set({ key: AUTH_KEYS.USER, value: userStr }),
      ])
    } catch {}
  }

  /**
   * Clears all session keys from both localStorage and native Preferences.
   */
  async clearSession(): Promise<void> {
    if (!this.isClient()) return

    const keys = [
      AUTH_KEYS.TOKEN,
      AUTH_KEYS.USER,
      AUTH_KEYS.SESSION_ID,
      AUTH_KEYS.SCHOOL_ID,
      AUTH_KEYS.FEATURES,
      AUTH_KEYS.AVAILABLE_SCHOOLS,
      AUTH_KEYS.PARENT_STUDENTS,
      AUTH_KEYS.PARENT_SELECTED_STUDENT,
      AUTH_KEYS.ACTIVE_SCHOOL,
      "_zt_fresh_login",
      "_zt_login_role",
      "zt_parent_login_ts",
    ]

    for (const k of keys) {
      localStorage.removeItem(k)
    }

    if (this.isNative()) {
      try {
        await Promise.all(keys.map(k => Preferences.remove({ key: k })))
      } catch (err) {
        console.warn("[AuthStorage] Failed to clear native preferences:", err)
      }
    }
  }
}

export const authStorage = new AuthStorage()
