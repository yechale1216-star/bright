"use client"

import { getApiUrl } from "@/lib/api-config"
import { authStorage, AUTH_KEYS } from "@/lib/auth/auth-storage"

/**
 * Single-flight Token Refresh Coordinator
 * ───────────────────────────────────────
 * Prevents race conditions when multiple API calls return 401 simultaneously.
 * Only ONE refresh request is dispatched to the backend. All other callers await
 * the same in-flight promise.
 */

let refreshPromise: Promise<boolean> | null = null

export async function refreshTokenSingleFlight(): Promise<boolean> {
  if (refreshPromise) {
    console.log("[AuthRefresh] Refresh already in progress. Joining pending promise...")
    return refreshPromise
  }

  refreshPromise = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      console.warn("[AuthRefresh] Refresh request timed out (8s limit reached)")
      controller.abort()
    }, 8000)

    try {
      const token = authStorage.getToken()
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        console.warn(`[AuthRefresh] Refresh returned status ${res.status}`)
        return false
      }

      const json = await res.json()
      if (json.success && json.data?.token) {
        const newToken = json.data.token
        const updatedUser = json.data.user

        console.log("[AuthRefresh] ✅ Session successfully refreshed with new token")

        // Persist token and updated profile to both localStorage and Native Preferences
        await authStorage.setToken(newToken)
        if (updatedUser) {
          const existingUser = authStorage.getUser()
          const mergedUser = { ...(existingUser || {}), ...updatedUser }
          await authStorage.setSession(newToken, mergedUser)
        }

        // Notify Native Bridge if running on Android
        try {
          const { NativeBridge } = await import("@/lib/utils/native-bridge")
          if (NativeBridge.isNative()) {
            await NativeBridge.saveAuthToken(newToken)
          }
        } catch {}

        // Notify app components of updated user session
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("userSessionChanged"))
        }

        return true
      }

      return false
    } catch (err: any) {
      clearTimeout(timer)
      if (err?.name === "AbortError") {
        console.warn("[AuthRefresh] Aborted due to timeout")
      } else {
        console.warn("[AuthRefresh] Error during token refresh:", err?.message || err)
      }
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}
