"use client"

/**
 * High-performance IndexedDB persistent storage utility for offline asset caching
 * (School Logos, User Profiles, User Avatars, and App Assets).
 */

const DB_NAME = "zetimer_app_assets"
const DB_VERSION = 1
const ASSETS_STORE = "assets"

let dbPromise: Promise<IDBDatabase> | null = null

function openAssetsDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error("[IndexedDBStore] Failed to open IndexedDB:", request.error)
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

/** Set a key-value record in IndexedDB */
export async function setIndexedDBItem<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openAssetsDB()
    const tx = db.transaction(ASSETS_STORE, "readwrite")
    const store = tx.objectStore(ASSETS_STORE)
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ key, data, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn(`[IndexedDBStore] Failed to set item for key ${key}:`, err)
  }
}

/** Get a key-value record from IndexedDB */
export async function getIndexedDBItem<T>(key: string): Promise<T | null> {
  try {
    const db = await openAssetsDB()
    const tx = db.transaction(ASSETS_STORE, "readonly")
    const store = tx.objectStore(ASSETS_STORE)
    return new Promise<T | null>((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result?.data ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn(`[IndexedDBStore] Failed to get item for key ${key}:`, err)
    return null
  }
}

/** Clear asset cache item from IndexedDB */
export async function removeIndexedDBItem(key: string): Promise<void> {
  try {
    const db = await openAssetsDB()
    const tx = db.transaction(ASSETS_STORE, "readwrite")
    const store = tx.objectStore(ASSETS_STORE)
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn(`[IndexedDBStore] Failed to delete item for key ${key}:`, err)
  }
}

/**
 * Cache user profile in IndexedDB and localStorage
 */
export async function cacheUserProfile(user: any): Promise<void> {
  if (!user) return
  try {
    await setIndexedDBItem("user_profile", user)
    if (typeof window !== "undefined") {
      localStorage.setItem("attendance_current_user", JSON.stringify(user))
    }
  } catch (err) {
    console.warn("[IndexedDBStore] Failed to cache user profile:", err)
  }
}

/**
 * Get user profile from IndexedDB with fallback to localStorage
 */
export async function getCachedUserProfile(): Promise<any | null> {
  try {
    const idbUser = await getIndexedDBItem<any>("user_profile")
    if (idbUser) return idbUser

    if (typeof window !== "undefined") {
      const lsRaw = localStorage.getItem("attendance_current_user")
      if (lsRaw) return JSON.parse(lsRaw)
    }
    return null
  } catch (err) {
    console.warn("[IndexedDBStore] Failed to retrieve user profile:", err)
    return null
  }
}

/**
 * Cache school logo URL or image data in IndexedDB
 */
export async function cacheSchoolLogo(schoolId: string, logoUrl: string): Promise<void> {
  if (!schoolId) return
  try {
    await setIndexedDBItem(`school_logo_${schoolId}`, logoUrl)
    await setIndexedDBItem("latest_school_logo", logoUrl)
  } catch (err) {
    console.warn(`[IndexedDBStore] Failed to cache school logo for ${schoolId}:`, err)
  }
}

/**
 * Get cached school logo URL or image data from IndexedDB
 */
export async function getCachedSchoolLogo(schoolId?: string): Promise<string | null> {
  try {
    if (schoolId) {
      const logo = await getIndexedDBItem<string>(`school_logo_${schoolId}`)
      if (logo) return logo
    }
    return await getIndexedDBItem<string>("latest_school_logo")
  } catch (err) {
    console.warn("[IndexedDBStore] Failed to retrieve school logo:", err)
    return null
  }
}
