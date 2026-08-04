"use client"

import { useState, useEffect } from "react"
import { API_URL } from "@/lib/api-config"

interface SetupStatus {
  setupRequired: boolean | null
  isLoading: boolean
  error: string | null
}

const CACHE_KEY = "zt_setup_status_cache"
const CACHE_TTL_MS = 60 * 1000 // 1 minute — short enough to reflect DB changes

/**
 * Checks whether the one-time initial School Administrator setup is required.
 *
 * - Returns setupRequired=true if no admin/school_admin exists in the database.
 * - Returns setupRequired=false once setup is complete.
 * - Caches the result in sessionStorage for CACHE_TTL_MS to avoid repeated hits.
 * - Once setup is confirmed complete (false), the result is cached indefinitely
 *   for the session (the flag never goes from false → true).
 */
export function useSetupStatus(): SetupStatus {
  const [state, setState] = useState<SetupStatus>({
    setupRequired: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function checkSetupStatus() {
      // Try sessionStorage cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { setupRequired, cachedAt } = JSON.parse(cached)
          const age = Date.now() - cachedAt
          // If setup is complete, trust cache forever for this session.
          // If setup is required, only trust cache for CACHE_TTL_MS.
          if (!setupRequired || age < CACHE_TTL_MS) {
            if (!cancelled) {
              setState({ setupRequired, isLoading: false, error: null })
            }
            return
          }
        }
      } catch {
        // sessionStorage unavailable or corrupted — fall through to API call
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/setup-status`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          // No credentials needed — this is a public status endpoint
        })

        if (!res.ok) {
          throw new Error(`Setup status check failed: ${res.status}`)
        }

        const data = await res.json()
        const setupRequired: boolean = data.setupRequired ?? true

        // Cache result in sessionStorage
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ setupRequired, cachedAt: Date.now() })
          )
        } catch {
          // sessionStorage write failed — non-fatal
        }

        if (!cancelled) {
          setState({ setupRequired, isLoading: false, error: null })
        }
      } catch (err: any) {
        console.error("[useSetupStatus] Failed to fetch setup status:", err)
        if (!cancelled) {
          setState({
            setupRequired: null,
            isLoading: false,
            error: err.message || "Failed to check setup status",
          })
        }
      }
    }

    checkSetupStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * Clears the cached setup status so the next render re-fetches.
 * Call this after completing setup to ensure the redirect logic
 * sees the updated (setupRequired=false) state.
 */
export function clearSetupStatusCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // No-op if sessionStorage unavailable
  }
}
