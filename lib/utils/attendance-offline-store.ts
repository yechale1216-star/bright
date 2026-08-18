"use client"

import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"

const DB_NAME = "zetimer_offline_attendance"
const DB_VERSION = 1
const STORE_QUEUE = "attendance_outbox"
const STORE_ROSTER = "roster_cache"
const STORE_STATE = "state_cache"

export interface OfflineAttendanceRecord {
  studentId: string
  status: string
  session?: string | null
  remarks?: string
  date: string
  latitude?: number | null
  longitude?: number | null
  locationVerified?: boolean
  locationDistance?: number | null
}

export interface OfflineAttendanceBatch {
  id: string
  schoolId: string
  records: OfflineAttendanceRecord[]
  locationData?: {
    latitude?: number | null
    longitude?: number | null
    locationVerified?: boolean
    locationDistance?: number | null
  }
  timestamp: number
  date: string
  session?: string | null
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORE_ROSTER)) {
        db.createObjectStore(STORE_ROSTER, { keyPath: "key" })
      }
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error("[OfflineAttendanceStore] Failed to open IndexedDB:", request.error)
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * Add or merge an attendance batch to the offline IndexedDB outbox.
 * If an unsynced batch already exists for the same (schoolId, date, session),
 * it merges/updates the records instead of accumulating duplicate batches.
 */
export async function queueOfflineAttendance(
  schoolId: string,
  records: OfflineAttendanceRecord[],
  locationData?: any,
  date?: string,
  session?: string | null
): Promise<string> {
  const normDate = date ? date.split("T")[0] : new Date().toISOString().split("T")[0]
  const normSess = session ? session.trim().toLowerCase() : null
  const cleanSess = (normSess && normSess !== 'none' && normSess !== 'daily') ? normSess : null

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readwrite")
    const store = tx.objectStore(STORE_QUEUE)

    const existingBatches: OfflineAttendanceBatch[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    // Find if an unsynced batch for the same context exists
    const match = existingBatches.find(
      b => b.schoolId === schoolId &&
           b.date === normDate &&
           (b.session ? b.session.trim().toLowerCase() : null) === cleanSess
    )

    let finalBatch: OfflineAttendanceBatch

    if (match) {
      // Merge records: new records overwrite matching studentId records
      const recordMap = new Map<string, OfflineAttendanceRecord>()
      match.records.forEach(r => recordMap.set(r.studentId, r))
      records.forEach(r => recordMap.set(r.studentId, r))

      finalBatch = {
        ...match,
        records: Array.from(recordMap.values()),
        locationData: locationData || match.locationData,
        timestamp: Date.now(),
      }
    } else {
      const batchId = `offline_att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      finalBatch = {
        id: batchId,
        schoolId,
        records,
        locationData,
        timestamp: Date.now(),
        date: normDate,
        session: cleanSess,
      }
    }

    await new Promise<void>((resolve, reject) => {
      const req = store.put(finalBatch)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    console.log(`[OfflineAttendanceStore] Queued/updated ${finalBatch.records.length} records in batch ${finalBatch.id}`)
    return finalBatch.id
  } catch (err) {
    console.error("[OfflineAttendanceStore] Failed to queue attendance:", err)
    const batchId = `offline_att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const batch: OfflineAttendanceBatch = {
      id: batchId,
      schoolId,
      records,
      locationData,
      timestamp: Date.now(),
      date: normDate,
      session: cleanSess,
    }
    // Fallback to localStorage
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("zetimer_offline_att_queue") || "[]"
        const list = JSON.parse(raw) as OfflineAttendanceBatch[]
        const matchIdx = list.findIndex(
          b => b.schoolId === schoolId && b.date === normDate && (b.session ? b.session.trim().toLowerCase() : null) === cleanSess
        )
        if (matchIdx >= 0) {
          const recordMap = new Map<string, OfflineAttendanceRecord>()
          list[matchIdx].records.forEach(r => recordMap.set(r.studentId, r))
          records.forEach(r => recordMap.set(r.studentId, r))
          list[matchIdx].records = Array.from(recordMap.values())
          list[matchIdx].timestamp = Date.now()
          if (locationData) list[matchIdx].locationData = locationData
        } else {
          list.push(batch)
        }
        localStorage.setItem("zetimer_offline_att_queue", JSON.stringify(list))
      }
    } catch (lsErr) {
      console.error("[OfflineAttendanceStore] LocalStorage fallback failed:", lsErr)
    }
    return batchId
  }
}

/**
 * Retrieve all pending offline attendance batches
 */
export async function getOfflineAttendanceQueue(): Promise<OfflineAttendanceBatch[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readonly")
    const store = tx.objectStore(STORE_QUEUE)
    const batches = await new Promise<OfflineAttendanceBatch[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    // Combine with any localStorage fallback items
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("zetimer_offline_att_queue")
        if (raw) {
          const lsBatches = JSON.parse(raw) as OfflineAttendanceBatch[]
          const existingIds = new Set(batches.map(b => b.id))
          for (const b of lsBatches) {
            if (!existingIds.has(b.id)) batches.push(b)
          }
        }
      } catch { /* ignore */ }
    }

    return batches
  } catch (err) {
    console.warn("[OfflineAttendanceStore] Failed to retrieve queue from IndexedDB:", err)
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("zetimer_offline_att_queue")
        if (raw) return JSON.parse(raw)
      } catch { /* ignore */ }
    }
    return []
  }
}

/**
 * Remove a specific batch after successful sync
 */
export async function removeOfflineAttendanceBatch(batchId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readwrite")
    const store = tx.objectStore(STORE_QUEUE)
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(batchId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn(`[OfflineAttendanceStore] Failed to delete batch ${batchId}:`, err)
  }

  // Also clean from localStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("zetimer_offline_att_queue")
      if (raw) {
        const list = JSON.parse(raw).filter((b: OfflineAttendanceBatch) => b.id !== batchId)
        localStorage.setItem("zetimer_offline_att_queue", JSON.stringify(list))
      }
    } catch { /* ignore */ }
  }
}

export function getClientApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (typeof window === "undefined") return headers

  const token = localStorage.getItem("attendance_token")
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  try {
    const userRaw = localStorage.getItem("attendance_current_user")
    if (userRaw) {
      const user = JSON.parse(userRaw)
      const schoolId = user?.schoolId || user?.school_id || user?.school?.id
      if (schoolId) headers["x-school-id"] = String(schoolId)
    }
    const xSchoolId = localStorage.getItem("x-school-id")
    if (xSchoolId && !headers["x-school-id"]) headers["x-school-id"] = xSchoolId
  } catch { /* ignore */ }

  return headers
}

/**
 * Flush and synchronize all queued offline attendance submissions to the server
 */
let isFlushing = false
export async function flushOfflineAttendanceQueue(
  customHeaders?: any
): Promise<{ syncedBatches: number; totalRecords: number; errors: string[] }> {
  if (isFlushing) return { syncedBatches: 0, totalRecords: 0, errors: [] }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { syncedBatches: 0, totalRecords: 0, errors: ["Device is currently offline"] }
  }

  const headers = customHeaders || getClientApiHeaders()

  isFlushing = true
  let syncedBatches = 0
  let totalRecords = 0
  const errors: string[] = []

  try {
    const queue = await getOfflineAttendanceQueue()
    if (queue.length === 0) {
      isFlushing = false
      return { syncedBatches: 0, totalRecords: 0, errors: [] }
    }

    console.log(`[OfflineAttendanceStore] Synchronizing ${queue.length} offline attendance batches...`)

    for (const batch of queue) {
      try {
        await apiFetch(
          `${API_URL}/api/attendance/bulk`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              records: batch.records,
              latitude: batch.locationData?.latitude,
              longitude: batch.locationData?.longitude,
              locationVerified: batch.locationData?.locationVerified,
              locationDistance: batch.locationData?.locationDistance,
            }),
          }
        )

        await removeOfflineAttendanceBatch(batch.id)
        syncedBatches++
        totalRecords += batch.records.length
      } catch (err: any) {
        console.error(`[OfflineAttendanceStore] Failed to sync batch ${batch.id}:`, err)
        errors.push(err.message || `Failed to sync batch ${batch.id}`)
      }
    }

    if (syncedBatches > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("attendanceDataChanged"))
      window.dispatchEvent(new CustomEvent("offlineAttendanceSynced", {
        detail: { syncedBatches, totalRecords }
      }))
    }
  } catch (err: any) {
    console.error("[OfflineAttendanceStore] Batch flush exception:", err)
    errors.push(err.message || "Unknown error during flush")
  } finally {
    isFlushing = false
  }

  return { syncedBatches, totalRecords, errors }
}

/**
 * Cache classroom roster in IndexedDB for instant offline loading
 */
export async function cacheRosterOffline(schoolId: string, students: any[]): Promise<void> {
  if (!schoolId || !students) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_ROSTER, "readwrite")
    const store = tx.objectStore(STORE_ROSTER)
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ key: `roster_${schoolId}`, data: students, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn("[OfflineAttendanceStore] Failed to cache roster:", err)
  }
}

/**
 * Retrieve cached classroom roster from IndexedDB
 */
export async function getCachedRosterOffline(schoolId: string): Promise<any[] | null> {
  if (!schoolId) return null
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_ROSTER, "readonly")
    const store = tx.objectStore(STORE_ROSTER)
    return await new Promise<any[] | null>((resolve, reject) => {
      const req = store.get(`roster_${schoolId}`)
      req.onsuccess = () => resolve(req.result?.data ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn("[OfflineAttendanceStore] Failed to retrieve cached roster:", err)
    return null
  }
}
