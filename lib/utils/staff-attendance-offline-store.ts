"use client"

import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { getClientApiHeaders } from "@/lib/utils/attendance-offline-store"

const DB_NAME = "zetimer_offline_staff_attendance"
const DB_VERSION = 1
const STORE_QUEUE = "staff_checkin_outbox"

export interface OfflineStaffCheckInRecord {
  id: string
  schoolId: string
  userId: string
  type: "checkin" | "checkout"
  date: string
  timestamp: number
  latitude?: number | null
  longitude?: number | null
  locationVerified?: boolean
  locationDistance?: number | null
  faceVerified?: boolean
  faceConfidence?: number | null
  remarks?: string
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
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error("[StaffOfflineStore] Failed to open IndexedDB:", request.error)
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * Queue a staff check-in or check-out offline
 */
export async function queueOfflineStaffCheckIn(
  record: Omit<OfflineStaffCheckInRecord, "id" | "timestamp">
): Promise<string> {
  const normDate = record.date ? record.date.split("T")[0] : new Date().toISOString().split("T")[0]
  const recordId = `offline_staff_${record.userId}_${normDate}_${record.type}_${Date.now()}`
  const fullRecord: OfflineStaffCheckInRecord = {
    ...record,
    id: recordId,
    date: normDate,
    timestamp: Date.now(),
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readwrite")
    const store = tx.objectStore(STORE_QUEUE)

    const existing: OfflineStaffCheckInRecord[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    // Avoid duplicate queueing of the same user + date + type
    const match = existing.find(
      (r) => r.userId === record.userId && r.date === normDate && r.type === record.type
    )

    if (match) {
      // Overwrite match with latest metadata
      fullRecord.id = match.id
    }

    await new Promise<void>((resolve, reject) => {
      const req = store.put(fullRecord)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    console.log(`[StaffOfflineStore] Queued offline ${record.type} for ${record.userId} on ${normDate}`)
    return fullRecord.id
  } catch (err) {
    console.warn("[StaffOfflineStore] Failed to queue in IndexedDB, falling back to localStorage:", err)
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("zetimer_offline_staff_queue") || "[]"
        const list = JSON.parse(raw) as OfflineStaffCheckInRecord[]
        const matchIdx = list.findIndex(
          (r) => r.userId === record.userId && r.date === normDate && r.type === record.type
        )
        if (matchIdx >= 0) {
          list[matchIdx] = fullRecord
        } else {
          list.push(fullRecord)
        }
        localStorage.setItem("zetimer_offline_staff_queue", JSON.stringify(list))
      }
    } catch (lsErr) {
      console.error("[StaffOfflineStore] LocalStorage fallback failed:", lsErr)
    }
    return recordId
  }
}

/**
 * Retrieve all pending staff offline check-in records
 */
export async function getOfflineStaffQueue(): Promise<OfflineStaffCheckInRecord[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readonly")
    const store = tx.objectStore(STORE_QUEUE)
    const records = await new Promise<OfflineStaffCheckInRecord[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("zetimer_offline_staff_queue")
        if (raw) {
          const lsRecords = JSON.parse(raw) as OfflineStaffCheckInRecord[]
          const existingIds = new Set(records.map((r) => r.id))
          for (const r of lsRecords) {
            if (!existingIds.has(r.id)) records.push(r)
          }
        }
      } catch { /* ignore */ }
    }

    return records
  } catch (err) {
    console.warn("[StaffOfflineStore] IndexedDB read failed, trying localStorage:", err)
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("zetimer_offline_staff_queue")
        if (raw) return JSON.parse(raw)
      } catch { /* ignore */ }
    }
    return []
  }
}

/**
 * Remove a specific batch/record after successful sync
 */
export async function removeOfflineStaffRecord(id: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_QUEUE, "readwrite")
    const store = tx.objectStore(STORE_QUEUE)
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch { /* ignore */ }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("zetimer_offline_staff_queue")
      if (raw) {
        const list = JSON.parse(raw).filter((r: OfflineStaffCheckInRecord) => r.id !== id)
        localStorage.setItem("zetimer_offline_staff_queue", JSON.stringify(list))
      }
    } catch { /* ignore */ }
  }
}

/**
 * Flush all offline staff attendance records to server
 */
let isStaffFlushing = false
export async function flushOfflineStaffQueue(): Promise<{ synced: number; errors: string[] }> {
  if (isStaffFlushing) return { synced: 0, errors: [] }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, errors: ["Device is currently offline"] }
  }

  isStaffFlushing = true
  let synced = 0
  const errors: string[] = []

  try {
    const queue = await getOfflineStaffQueue()
    if (queue.length === 0) {
      isStaffFlushing = false
      return { synced: 0, errors: [] }
    }

    console.log(`[StaffOfflineStore] Synchronizing ${queue.length} staff attendance records...`)

    const headers = getClientApiHeaders()

    const res = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/sync`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ records: queue }),
      }
    )

    if (res && res.success) {
      for (const record of queue) {
        await removeOfflineStaffRecord(record.id)
      }
      synced = queue.length

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
        window.dispatchEvent(new CustomEvent("offlineStaffAttendanceSynced", {
          detail: { synced }
        }))
      }
    }
  } catch (err: any) {
    console.error("[StaffOfflineStore] Flush failed:", err)
    errors.push(err.message || "Failed to synchronize staff attendance")
  } finally {
    isStaffFlushing = false
  }

  return { synced, errors }
}
