"use client"

import React, { useEffect } from "react"
import { authStorage } from "@/lib/auth/auth-storage"
import { refreshTokenSingleFlight } from "@/lib/auth/auth-refresh"

/**
 * Global fetch interceptor:
 * 1. Attaches `credentials: 'include'` and Bearer token to all `/api/` requests.
 * 2. Implements a default request timeout (20s) using AbortController to prevent infinite spinners.
 * 3. Catches 401 Unauthorized responses centrally.
 * 4. Coordinates a single-flight token refresh across all concurrent 401s.
 * 5. Retries eligible requests ONCE upon successful refresh.
 * 6. Emits `sessionExpired` only if refresh fails, triggering clean redirection to /login.
 */

if (typeof window !== "undefined" && !(window as any).__zt_fetch_intercepted) {
  const originalFetch = window.fetch

  window.fetch = async function (...args: [RequestInfo | URL, RequestInit?]): Promise<Response> {
    let [resource, config] = args
    config = config ? { ...config } : {}

    let url = ""
    if (typeof resource === "string") {
      url = resource
    } else if (resource instanceof URL) {
      url = resource.toString()
    } else if (resource instanceof Request) {
      url = resource.url
    }

    const isOwnApi = url.includes("/api/")
    const isAuthRoute =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/refresh") ||
      url.includes("/api/auth/logout") ||
      url.includes("/api/parent/login")

    // 1. Enrich own API requests
    if (isOwnApi) {
      config.credentials = "include"

      // Attach token if not already provided
      const token = authStorage.getToken()
      if (token) {
        if (!config.headers) {
          config.headers = { Authorization: `Bearer ${token}` }
        } else if (config.headers instanceof Headers) {
          if (!config.headers.has("Authorization")) {
            config.headers.set("Authorization", `Bearer ${token}`)
          }
        } else if (Array.isArray(config.headers)) {
          const hasAuth = config.headers.some(([k]) => k.toLowerCase() === "authorization")
          if (!hasAuth) {
            config.headers.push(["Authorization", `Bearer ${token}`])
          }
        } else if (typeof config.headers === "object") {
          const headersObj = config.headers as Record<string, string>
          if (!headersObj["Authorization"] && !headersObj["authorization"]) {
            headersObj["Authorization"] = `Bearer ${token}`
          }
        }
      }
    }

    // 2. Default bounded timeout (25s) to guarantee no request hangs indefinitely
    let timeoutTimer: NodeJS.Timeout | null = null
    if (!config.signal) {
      const controller = new AbortController()
      config.signal = controller.signal
      timeoutTimer = setTimeout(() => {
        controller.abort()
      }, 25000)
    }

    try {
      const response = await originalFetch(resource, config)
      if (timeoutTimer) clearTimeout(timeoutTimer)

      // 3. Centralized 401 handling
      const isRetry = (config as any)?._isRetry === true
      if (response.status === 401 && isOwnApi && !isAuthRoute && !isRetry) {
        console.warn(`[FetchInterceptor] 401 detected on ${url}. Attempting single-flight session refresh...`)

        const refreshed = await refreshTokenSingleFlight()

        if (refreshed) {
          console.log(`[FetchInterceptor] Refresh succeeded. Retrying ${url} once...`)
          const retryConfig = { ...config, _isRetry: true }
          const newToken = authStorage.getToken()

          if (newToken) {
            if (retryConfig.headers instanceof Headers) {
              retryConfig.headers.set("Authorization", `Bearer ${newToken}`)
            } else if (Array.isArray(retryConfig.headers)) {
              retryConfig.headers = retryConfig.headers.filter(([k]) => k.toLowerCase() !== "authorization")
              retryConfig.headers.push(["Authorization", `Bearer ${newToken}`])
            } else if (typeof retryConfig.headers === "object") {
              ;(retryConfig.headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`
            }
          }

          return originalFetch(resource, retryConfig)
        } else {
          console.warn("[FetchInterceptor] Refresh failed. Session is unauthenticated.")
          window.dispatchEvent(new Event("sessionExpired"))
        }
      }

      return response
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      throw err
    }
  }

  ;(window as any).__zt_fetch_intercepted = true
}

export function FetchInterceptor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      console.log("[FetchInterceptor] zetime:unauthorized event detected.")
      window.dispatchEvent(new Event("sessionExpired"))
    }

    window.addEventListener("zetime:unauthorized", handleUnauthorizedEvent)
    return () => {
      window.removeEventListener("zetime:unauthorized", handleUnauthorizedEvent)
    }
  }, [])

  return <>{children}</>
}
