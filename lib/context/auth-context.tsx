"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { authService, User, SESSION_ID_KEY } from "@/lib/auth/auth"
import { getApiUrl } from "@/lib/api-config"
import { useRouter, usePathname } from "next/navigation"
import { clearMessageCache } from "@/lib/utils/message-cache"

// Key used to mark that a fresh login just occurred — validateSession must
// not overwrite the login-confirmed role with path-inferred stale data.
const FRESH_LOGIN_KEY = "_zt_fresh_login"

interface AuthContextValue {
  user: User | null
  features: string[] | null
  authLoading: boolean
  permissionsLoading: boolean
  /** True only when authLoading=false AND permissionsLoading=false AND user state is settled.
   *  AuthGuard must wait for this before rendering protected content. */
  sessionReady: boolean
  /** Current session nonce. Changes on every login/signup/logout.
   *  SchoolContext and other contexts subscribe to this to detect user switches. */
  sessionId: string | null
  error: string | null
  isOnline: boolean
  validateSession: (options?: { forceRefetch?: boolean }) => Promise<void>
  /** Clears all session state. Pass a redirectPath to navigate after logout (default: /login). */
  logout: (redirectPath?: string) => Promise<void>
  /** Internal: registered by SchoolContext so AuthContext can clear school state
   *  without creating a circular context dependency. */
  registerClearSchoolContext: (fn: () => void) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [features, setFeatures] = useState<string[] | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const wasOfflineRef = useRef(false)
  // Ref to the SchoolContext's clearSchoolContext function (registered after mount)
  const clearSchoolContextRef = useRef<(() => void) | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isClient = typeof window !== "undefined"

  // sessionReady: true only when everything has settled for the current session.
  // This is the authoritative gate used by AuthGuard.
  const sessionReady = !authLoading && !permissionsLoading

  // Update online status from browser
  useEffect(() => {
    if (!isClient) return
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      wasOfflineRef.current = true
      console.log("[AuthContext] Connection recovered: online")
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log("[AuthContext] Connection lost: offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [isClient])

  const registerClearSchoolContext = useCallback((fn: () => void) => {
    clearSchoolContextRef.current = fn
  }, [])

  const logout = useCallback(async (redirectPath?: string) => {
    if (isClient) {
      // Clear the fresh-login marker so the next validateSession runs fully
      localStorage.removeItem(FRESH_LOGIN_KEY)
      localStorage.removeItem("_zt_login_role")
    }

    // Await the authService logout so API and Native calls finish before navigation
    await authService.logout()

    // Clear offline message cache on logout
    try {
      await clearMessageCache()
    } catch (e) {
      console.warn("Failed to clear message cache on logout:", e);
    }

    // ATOMIC STATE CLEAR: wipe ALL in-memory React state synchronously so no
    // stale data can leak into the next user's session — not even for one frame.
    clearSchoolContextRef.current?.()
    setUser(null)
    setFeatures(null)
    setSessionId(null)
    setAuthLoading(false)
    setPermissionsLoading(false)
    setError(null)

    // Redirect to the specified path, or to /login if we are currently on a protected page.
    // Never redirect if we are already on a public/auth page to avoid redirect loops.
    if (isClient) {
      const publicPages = ["/login", "/signup", "/reset-password", "/forgot-password"]
      const currentPath = window.location.pathname
      const isAlreadyOnPublicPage = publicPages.some(p => currentPath.startsWith(p))

      if (redirectPath) {
        // Explicit redirect always wins (e.g. token-expired → /login?reason=expired)
        window.location.href = redirectPath
      } else if (!isAlreadyOnPublicPage) {
        // Manual logout from a protected page → go to /login
        window.location.href = "/login"
      }
      // If already on a public page, just clear state and stay — no redirect needed.
    }
  }, [isClient])


  const validateSession = useCallback(async (options?: { forceRefetch?: boolean }) => {
    if (!isClient) return

    const token = localStorage.getItem("attendance_token") // Legacy token
    const cachedUserStr = localStorage.getItem("attendance_current_user")
    const cachedFeaturesStr = localStorage.getItem("attendance_features")
    const storedSessionId = localStorage.getItem(SESSION_ID_KEY)

    if (options?.forceRefetch) {
      console.log("[AuthContext][validateSession] Force refetch requested — bypassing fresh login cache shortcut")
    }

    if (!cachedUserStr) {
      // No user in storage, user is unauthenticated
      console.log("[AuthContext][validateSession] No user in storage — unauthenticated")
      // ATOMIC CLEAR: wipe everything before settling as unauthenticated
      clearSchoolContextRef.current?.()
      setUser(null)
      setFeatures(null)
      setSessionId(null)
      setAuthLoading(false)
      setPermissionsLoading(false)
      return
    }

    let currentUser: User | null = null
    try {
      currentUser = JSON.parse(cachedUserStr)
    } catch {
      console.warn("[AuthContext][validateSession] Failed to parse cached user — logging out")
      logout()
      return
    }

    // SESSION CHANGE DETECTION:
    // If the sessionId in localStorage differs from what we have in React state,
    // a new user has logged in. Clear all previous in-memory state FIRST before
    // loading the new session. 
    // EXCEPTION: If this is a fresh login, we skip clearing because the login process
    // has already populated the new session state (available schools, etc.) and clearing 
    // it now would cause a race condition (wiping the data just fetched).
    const isSessionChange = storedSessionId !== sessionId || options?.forceRefetch
    const isFreshLoginCheck = localStorage.getItem(FRESH_LOGIN_KEY) === "1"
    // A school switch also writes a new token, which looks like a session change to
    // validateSession. Don't wipe the school context in this case — it was just set intentionally.
    const isSchoolSwitch = localStorage.getItem("_zt_school_switch") === "1"
    if (isSchoolSwitch) {
      localStorage.removeItem("_zt_school_switch")
    }

    if (isSessionChange && !isFreshLoginCheck && !isSchoolSwitch) {
      console.log(`[AuthContext][validateSession] Session changed/force-refetch (${sessionId} → ${storedSessionId}) — clearing stale state`)
      clearSchoolContextRef.current?.()
      setUser(null)
      setFeatures(null)
      setError(null)
      setSessionId(storedSessionId)
      setAuthLoading(true)
      setPermissionsLoading(true)
    }

    // EAGER SWR HYDRATION:
    // If we have a cached user and features, hydrate React state immediately
    // so sessionReady becomes true in 0ms, unblocking rendering and splash screen.
    setUser(currentUser)
    setSessionId(storedSessionId)
    if (cachedFeaturesStr) {
      try { setFeatures(JSON.parse(cachedFeaturesStr)) } catch { setFeatures([]) }
    } else {
      setFeatures([])
    }
    setAuthLoading(false)
    setPermissionsLoading(false)

    // FRESH LOGIN GUARD:
    // If a fresh login just happened, we already have the correct, server-confirmed
    // role stored in localStorage by the login API. We must NOT let path-based
    // role inference (x-requested-role from the current URL) overwrite it.
    const isFreshLogin = localStorage.getItem(FRESH_LOGIN_KEY) === "1" && !options?.forceRefetch
    const freshLoginRole = localStorage.getItem("_zt_login_role") || ""
    if (isFreshLogin) {
      console.log(`[AuthContext][validateSession] Fresh login detected — preserving confirmed role: ${freshLoginRole}`)
      // Clear the marker so future validate calls work normally
      localStorage.removeItem(FRESH_LOGIN_KEY)
      localStorage.removeItem("_zt_login_role")
      return
    }
    setError(null)

    // Build common request headers once
    const schoolId = localStorage.getItem("x-school-id") || currentUser?.schoolId || ""
    const profileHeaders: Record<string, string> = { "Content-Type": "application/json" }
    if (token) profileHeaders["Authorization"] = `Bearer ${token}`
    if (schoolId) profileHeaders["x-school-id"] = schoolId

    // Situational Role Inference — only apply when NOT on a login/neutral page
    const currentPath = typeof window !== "undefined" ? window.location.pathname : pathname
    if (currentPath.startsWith('/parent')) profileHeaders["x-requested-role"] = 'parent'
    else if (currentPath.startsWith('/school/teacher')) profileHeaders["x-requested-role"] = 'teacher'
    else if (currentPath.startsWith('/school/admin')) profileHeaders["x-requested-role"] = 'school_admin'
    else if (currentPath.startsWith('/school/registrar')) profileHeaders["x-requested-role"] = 'registrar'
    else if (currentPath.startsWith('/school/discipline-officer')) profileHeaders["x-requested-role"] = 'discipline_officer'

    // PARALLEL REVALIDATION:
    const needsFeatures = currentUser?.role !== "parent" && !!currentUser?.schoolId
    const featuresSchoolId = currentUser?.schoolId || schoolId

    const profilePromise = fetch(`${getApiUrl()}/api/users/profile`, {
      headers: profileHeaders,
      cache: 'no-store',
      credentials: 'include'
    })

    const featuresPromise: Promise<Response | null> = Promise.resolve(null) // All features granted in Single-School Edition

    console.log(`[AuthContext][validateSession] Parallel revalidation | path: ${currentPath} | role: ${profileHeaders['x-requested-role'] || 'none'}`)

    // Resolve profile
    try {
      let profileRes = await profilePromise

      if (profileRes.status === 401) {
        console.warn("[AuthContext][validateSession] Token invalid (401) — checking if Bearer token can recover session")
        if (token) {
          try {
            const retryHeaders: Record<string, string> = {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            }
            if (schoolId) retryHeaders["x-school-id"] = schoolId
            if (profileHeaders["x-requested-role"]) retryHeaders["x-requested-role"] = profileHeaders["x-requested-role"]

            const retryRes = await fetch(`${getApiUrl()}/api/users/profile`, {
              headers: retryHeaders,
              cache: 'no-store',
            })

            if (retryRes.ok) {
              console.log("[AuthContext][validateSession] Bearer-token retry succeeded — session recovered")
              const retryJson = await retryRes.json()
              if (retryJson.success && retryJson.data) {
                const dbUser = retryJson.data
                const updatedUser: User = {
                  ...currentUser!,
                  name: dbUser.full_name || dbUser.name || currentUser!.name,
                  email: dbUser.email || currentUser!.email,
                  phone: dbUser.phone || currentUser!.phone || "",
                  profile_photo: dbUser.profile_photo || currentUser!.profile_photo || "",
                  role: dbUser.role || currentUser!.role,
                  schoolId: dbUser.schoolId || dbUser.school_id || currentUser!.schoolId,
                  schoolName: dbUser.schoolName || currentUser!.schoolName || "",
                  schoolLogo: dbUser.schoolLogo || currentUser!.schoolLogo || "",
                  onboardingCompleted: dbUser.onboardingCompleted ?? currentUser!.onboardingCompleted,
                  isVerified: dbUser.isVerified ?? dbUser.is_verified ?? currentUser!.isVerified ?? false,
                }
                setUser(updatedUser)
                setSessionId(storedSessionId)
                setError(null)
                localStorage.setItem("attendance_current_user", JSON.stringify(updatedUser))
                currentUser = updatedUser
              } else {
                setUser(currentUser)
                setSessionId(storedSessionId)
                setError(null)
              }
              setAuthLoading(false)
            } else {
              console.warn("[AuthContext][validateSession] Bearer retry also failed — token truly expired")
              logout("/login?reason=expired")
              return
            }
          } catch (retryErr) {
            console.warn("[AuthContext][validateSession] Bearer retry threw error:", retryErr)
            setUser(currentUser)
            setSessionId(storedSessionId)
            setAuthLoading(false)
            setPermissionsLoading(false)
            return
          }
        } else {
          console.warn("[AuthContext][validateSession] No Bearer token and cookie failed — session expired")
          logout("/login?reason=expired")
          return
        }
      } else if (!profileRes.ok) {
        throw new Error(`Profile fetch returned status ${profileRes.status}`)
      } else {
        const profileJson = await profileRes.json()
        if (profileJson.success && profileJson.data) {
          const dbUser = profileJson.data

          const currentUser2: any = currentUser!
          currentUser = {
            id: dbUser.id,
            email: dbUser.email,
            phone: dbUser.phone || "",
            name: dbUser.full_name || dbUser.name,
            role: dbUser.role,
            schoolId: dbUser.schoolId || dbUser.school_id || "",
            schoolName: dbUser.schoolName || "",
            schoolLogo: dbUser.schoolLogo || "",
            teacherId: dbUser.teacher_id || "",
            profile_photo: dbUser.profile_photo || "",
            onboardingCompleted: dbUser.onboardingCompleted ?? false,
          }

          const currentPath2 = typeof window !== "undefined" ? window.location.pathname : pathname
          const isOnNeutralPage = !currentPath2.startsWith('/parent') &&
            !currentPath2.startsWith('/school/teacher') &&
            !currentPath2.startsWith('/school/admin') &&
            !currentPath2.startsWith('/super-admin')

          let resolvedRole = dbUser.role || currentUser!.role
          if (isOnNeutralPage && currentUser!.role && dbUser.role && currentUser!.role !== dbUser.role) {
            console.warn(`[AuthContext][validateSession] Role mismatch on neutral page — preserving cached role '${currentUser!.role}' over DB role '${dbUser.role}'`)
            resolvedRole = currentUser!.role
          }
          if (currentUser!.role && dbUser.role && currentUser!.role !== dbUser.role) {
            console.warn(`[AuthContext][validateSession] Role: cached='${currentUser!.role}' db='${dbUser.role}' resolved='${resolvedRole}'`)
          }

          const updatedUser: User = {
            ...currentUser!,
            name: dbUser.full_name || dbUser.name || currentUser!.name,
            email: dbUser.email || currentUser!.email,
            phone: dbUser.phone || currentUser!.phone || "",
            profile_photo: dbUser.profile_photo || currentUser!.profile_photo || "",
            role: resolvedRole,
            schoolId: dbUser.schoolId || dbUser.school_id || currentUser!.schoolId,
            schoolName: dbUser.schoolName || currentUser!.schoolName || "",
            schoolLogo: dbUser.schoolLogo || currentUser!.schoolLogo || "",
            onboardingCompleted: dbUser.onboardingCompleted ?? currentUser!.onboardingCompleted,
            isVerified: dbUser.isVerified ?? dbUser.is_verified ?? currentUser!.isVerified ?? false,
          }

          console.log(`[AuthContext][validateSession] Profile loaded | userId: ${updatedUser.id} | finalRole: ${updatedUser.role}`)
          setUser(updatedUser)
          setSessionId(storedSessionId)
          localStorage.setItem("attendance_current_user", JSON.stringify(updatedUser))
          if (updatedUser.schoolId) localStorage.setItem("x-school-id", updatedUser.schoolId)
          
          // Cache User Profile & School Logo to IndexedDB asynchronously
          import("@/lib/utils/indexeddb-store").then(({ cacheUserProfile, cacheSchoolLogo }) => {
            cacheUserProfile(updatedUser)
            if (updatedUser.schoolLogo && updatedUser.schoolId) {
              cacheSchoolLogo(updatedUser.schoolId, updatedUser.schoolLogo)
            }
          }).catch(err => console.warn("IndexedDB cache error:", err))

          currentUser = updatedUser
        } else {
          throw new Error("Profile API returned success: false")
        }
      }
    } catch (err) {
      console.warn("[AuthContext][validateSession] Profile fetch failed:", err)
      if (currentUser) {
        console.log("[AuthContext][validateSession] Using cached user due to profile fetch failure")
        setUser(currentUser)
        setSessionId(storedSessionId)
        setError(null)
      } else {
        setError("Network or server connection failed. Please retry.")
      }
    } finally {
      setAuthLoading(false)
    }

    // In Single-School Edition, all features are always granted
    if (currentUser) {
      setFeatures([])
      localStorage.setItem("attendance_features", JSON.stringify([]))
      setPermissionsLoading(false)
    } else {
      setFeatures(null)
      setPermissionsLoading(false)
    }
  }, [isClient, logout, pathname, sessionId])

  // Initial session validation on mount
  useEffect(() => {
    validateSession()
  }, [validateSession])

  // Re-validate when network recovers from offline state
  useEffect(() => {
    if (!isOnline) return
    if (!wasOfflineRef.current) return
    wasOfflineRef.current = false
    console.log("[AuthContext] Network recovered from offline. Re-validating session...")
    validateSession()
  }, [isOnline, validateSession])

  // Sync session changes from other tabs or service-level updates
  useEffect(() => {
    const handleSessionChange = () => {
      console.log("[AuthContext] Session changed event detected. Syncing local user...");
      const cached = localStorage.getItem("attendance_current_user")
      if (cached) {
        try {
          setUser(JSON.parse(cached))
        } catch (e) {
          console.error("[AuthContext] Failed to parse session change data", e)
        }
      }
    }

    // When onboarding completes, run a FULL re-validation (profile + features from backend).
    const handleOnboardingCompleted = () => {
      console.log("[AuthContext] Onboarding completed — running full session re-validation...")
      validateSession()
    }

    const handleSessionExpired = () => {
      console.log("[AuthContext] Session expired event detected. Logging out...")
      logout("/login?reason=expired")
    }

    window.addEventListener("userSessionChanged", handleSessionChange)
    window.addEventListener("storage", handleSessionChange) // Support cross-tab sync too
    window.addEventListener("onboardingCompleted", handleOnboardingCompleted)
    window.addEventListener("sessionExpired", handleSessionExpired)
    return () => {
      window.removeEventListener("userSessionChanged", handleSessionChange)
      window.removeEventListener("storage", handleSessionChange)
      window.removeEventListener("onboardingCompleted", handleOnboardingCompleted)
      window.removeEventListener("sessionExpired", handleSessionExpired)
    }
  }, [validateSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        features,
        authLoading,
        permissionsLoading,
        sessionReady,
        sessionId,
        error,
        isOnline,
        validateSession,
        logout,
        registerClearSchoolContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
