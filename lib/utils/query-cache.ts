"use client"

import { perfMonitor } from "./performance-monitor"

/**
 * query-cache.ts
 * ──────────────
 * Stale-While-Revalidate (SWR) cache and in-flight request deduplicator.
 * Features:
 *  1. Immediate synchronous return of cached data (0ms rendering latency)
 *  2. Background revalidation when data is stale
 *  3. In-flight request pooling (multiple identical requests share one Promise)
 *  4. LocalStorage persistence for critical entities across reloads/restarts
 *  5. Tag-based cache invalidation
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  key: string
}

interface FetchOptions<T> {
  /** Time in ms before cached data is considered stale and background revalidated. Default: 30,000ms (30s) */
  staleTime?: number
  /** Whether to persist to localStorage. Default: true */
  persist?: boolean
  /** Force refetch from network bypassing cache. Default: false */
  forceRefetch?: boolean
  /** Callback fired when fresh data arrives in the background */
  onBackgroundUpdate?: (data: T) => void
}

class QueryCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private inflightRequests: Map<string, Promise<any>> = new Map()

  constructor() {
    // Hydro-load critical cache keys from localStorage if on browser
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith("_swr_cache_")) {
            const raw = localStorage.getItem(key)
            if (raw) {
              const parsed: CacheEntry<any> = JSON.parse(raw)
              this.memoryCache.set(parsed.key, parsed)
            }
          }
        }
      } catch (err) {
        console.warn("[QueryCache] Hydration failed:", err)
      }
    }
  }

  /**
   * Primary entry point: Get data with Stale-While-Revalidate semantics.
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: FetchOptions<T> = {}
  ): Promise<T> {
    const {
      staleTime = 30_000,
      persist = true,
      forceRefetch = false,
      onBackgroundUpdate,
    } = options

    const now = Date.now()
    const cached = this.memoryCache.get(key) as CacheEntry<T> | undefined

    if (forceRefetch) {
      perfMonitor.recordCacheAccess(false, key)
      return this.executeAndCache(key, fetcher, persist)
    }

    if (cached) {
      perfMonitor.recordCacheAccess(true, key)
      const isStale = now - cached.timestamp > staleTime

      if (!isStale) {
        // Cache is fresh! Return immediately.
        return cached.data
      }

      // Cache is stale. Trigger background revalidation asynchronously
      // and return stale data immediately so the UI is unblocked.
      this.revalidateInBackground(key, fetcher, persist, onBackgroundUpdate)
      return cached.data
    }

    // Cache miss!
    perfMonitor.recordCacheAccess(false, key)
    return this.executeAndCache(key, fetcher, persist)
  }

  /**
   * Synchronously read current cached value if available (0ms load).
   */
  get<T>(key: string): T | null {
    const cached = this.memoryCache.get(key)
    if (cached) {
      perfMonitor.recordCacheAccess(true, key)
      return cached.data as T
    }
    perfMonitor.recordCacheAccess(false, key)
    return null
  }

  /**
   * Manually populate cache.
   */
  set<T>(key: string, data: T, persist = true): void {
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
    }
    this.memoryCache.set(key, entry)

    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(`_swr_cache_${key}`, JSON.stringify(entry))
      } catch (e) {
        // QuotaExceededError safety catch
        console.warn("[QueryCache] Storage limit reached for:", key)
      }
    }
  }

  /**
   * Invalidate cache entries by exact key or regex pattern.
   */
  invalidate(keyOrPattern: string | RegExp): void {
    const keysToInvalidate: string[] = []

    this.memoryCache.forEach((_, key) => {
      if (typeof keyOrPattern === "string") {
        if (key === keyOrPattern || key.startsWith(keyOrPattern)) {
          keysToInvalidate.push(key)
        }
      } else if (keyOrPattern.test(key)) {
        keysToInvalidate.push(key)
      }
    })

    keysToInvalidate.forEach((key) => {
      this.memoryCache.delete(key)
      if (typeof window !== "undefined") {
        localStorage.removeItem(`_swr_cache_${key}`)
      }
    })

    if (typeof window !== "undefined") {
      try {
        const allKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k) allKeys.push(k)
        }

        const toRemove: string[] = []
        allKeys.forEach((lKey) => {
          if (lKey.startsWith("_swr_cache_")) {
            const rawKey = lKey.replace("_swr_cache_", "")
            if (typeof keyOrPattern === "string") {
              if (rawKey === keyOrPattern || rawKey.startsWith(keyOrPattern)) {
                toRemove.push(lKey)
              }
            } else if (keyOrPattern.test(rawKey)) {
              toRemove.push(lKey)
            }
          }
        })
        toRemove.forEach((k) => localStorage.removeItem(k))
      } catch (e) {
        console.warn("[QueryCache] Invalidation of localStorage failed:", e)
      }
    }
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.memoryCache.clear()
    this.inflightRequests.clear()
    if (typeof window !== "undefined") {
      const swrKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("_swr_cache_")) {
          swrKeys.push(k)
        }
      }
      swrKeys.forEach((k) => localStorage.removeItem(k))
    }
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async executeAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    persist: boolean
  ): Promise<T> {
    // Request Deduplication / Inflight Pooling:
    // If a request for `key` is already pending, return the same promise.
    if (this.inflightRequests.has(key)) {
      return this.inflightRequests.get(key) as Promise<T>
    }

    const startTime = performance.now()
    const requestPromise = (async () => {
      try {
        const data = await fetcher()
        this.set(key, data, persist)
        perfMonitor.recordApiCall(key, Math.round(performance.now() - startTime), 200)
        return data
      } catch (err) {
        perfMonitor.recordApiCall(key, Math.round(performance.now() - startTime), 500)
        throw err
      } finally {
        this.inflightRequests.delete(key)
      }
    })()

    this.inflightRequests.set(key, requestPromise)
    return requestPromise
  }

  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    persist: boolean,
    onBackgroundUpdate?: (data: T) => void
  ): Promise<void> {
    try {
      const freshData = await this.executeAndCache(key, fetcher, persist)
      if (onBackgroundUpdate) {
        onBackgroundUpdate(freshData)
      }
    } catch (err) {
      console.warn(`[QueryCache] Silent background revalidation failed for ${key}:`, err)
    }
  }
}

export const queryCache = new QueryCache()
