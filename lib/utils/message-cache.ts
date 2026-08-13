"use client"

/**
 * Telegram-style offline message cache using IndexedDB.
 *
 * Stores:
 *   - messages[]      per conversation (keyed by conversationId)
 *   - conversations[] sidebar list (single "sidebar" record)
 *   - outbox[]        pending messages to be sent when back online
 *
 * Design principles:
 *   - appendCachedMessage uses a targeted IDB update rather than
 *     read-all → splice → write-all, making it O(1) per append.
 *   - Outbox uses individual records (keyed by tempId) so failed
 *     messages can be removed independently.
 */

const DB_NAME = "zetimer_messages"
const DB_VERSION = 2                          // bumped: adds outbox store
const MESSAGES_STORE = "messages"             // { conversationId, messages[], updatedAt }
const CONVERSATIONS_STORE = "conversations"   // { id: "sidebar", items[], updatedAt }
const OUTBOX_STORE = "outbox"                 // { tempId, payload, createdAt, retries }

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

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, { keyPath: "conversationId" })
      }

      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        db.createObjectStore(CONVERSATIONS_STORE, { keyPath: "id" })
      }

      // New in v2: offline outbox — keyed by tempId for independent removal
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: "tempId" })
        outbox.createIndex("createdAt", "createdAt", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error("[MessageCache] Failed to open IndexedDB:", request.error)
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

// ─── Helper: promisify any IDB request ──────────────────────────────────────

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ─── Messages ───────────────────────────────────────────────────────────────

/**
 * Replace the entire message list for a conversation.
 * Called after a full server fetch.
 */
export async function cacheMessages(conversationId: string, messages: any[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    // Cap at 200 recent messages per conversation for persistent storage
    const trimmed = messages.length > 200 ? messages.slice(-200) : messages
    await idbPut(tx.objectStore(MESSAGES_STORE), { conversationId, messages: trimmed, updatedAt: Date.now() })
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] cacheMessages failed:", err)
  }
}

/**
 * Prepend older messages (fetched via cursor pagination) to an existing conversation cache.
 */
export async function prependCachedMessages(conversationId: string, olderMessages: any[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    const store = tx.objectStore(MESSAGES_STORE)

    const record = await idbGet<{ conversationId: string; messages: any[]; updatedAt: number }>(
      store, conversationId
    )

    const existing = record?.messages ?? []
    const existingIds = new Set(existing.map((m: any) => m.id))
    const filteredOlder = olderMessages.filter((m: any) => !existingIds.has(m.id))
    
    const combined = [...filteredOlder, ...existing]
    const trimmed = combined.length > 250 ? combined.slice(-250) : combined

    await idbPut(store, { conversationId, messages: trimmed, updatedAt: Date.now() })
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] prependCachedMessages failed:", err)
  }
}

/**
 * Load cached messages for a conversation. Returns null if no cache.
 */
export async function getCachedMessages(conversationId: string): Promise<any[] | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readonly")
    const record = await idbGet<{ conversationId: string; messages: any[] }>(
      tx.objectStore(MESSAGES_STORE),
      conversationId
    )
    return record?.messages ?? null
  } catch (err) {
    console.warn("[MessageCache] getCachedMessages failed:", err)
    return null
  }
}

/**
 * Append a single new message to an existing conversation cache.
 *
 * Performance note: this does a targeted get+put on a single IDB record,
 * NOT a full read of all conversations. For a conversation with 500 messages,
 * the old pattern (read-all, find, rewrite) was O(N) serialisation work;
 * this is O(1) for the IDB layer since the record is keyed by conversationId.
 */
export async function appendCachedMessage(conversationId: string, message: any): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    const store = tx.objectStore(MESSAGES_STORE)

    const record = await idbGet<{ conversationId: string; messages: any[]; updatedAt: number }>(
      store, conversationId
    )

    if (!record) {
      await idbPut(store, { conversationId, messages: [message], updatedAt: Date.now() })
    } else {
      // Deduplicate by id before appending
      if (record.messages.some((m: any) => m.id === message.id)) {
        return
      }
      // Trim to last 200 messages to cap IDB growth
      const trimmed = record.messages.length >= 200
        ? record.messages.slice(-199)
        : record.messages
      await idbPut(store, {
        conversationId,
        messages: [...trimmed, message],
        updatedAt: Date.now(),
      })
    }

    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] appendCachedMessage failed:", err)
  }
}

/**
 * Update a single message in the cache (edits, deletes, reactions, read status).
 */
export async function updateCachedMessage(
  conversationId: string,
  messageId: string,
  updater: (msg: any) => any
): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    const store = tx.objectStore(MESSAGES_STORE)

    const record = await idbGet<{ conversationId: string; messages: any[]; updatedAt: number }>(
      store, conversationId
    )
    if (!record) return

    await idbPut(store, {
      ...record,
      messages: record.messages.map((m: any) => (m.id === messageId ? updater(m) : m)),
      updatedAt: Date.now(),
    })
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] updateCachedMessage failed:", err)
  }
}

/**
 * Clear messages in IndexedDB for a conversation (sets messages to []).
 * Used when the user clears chat history. Keeps the conversation entry
 * in the sidebar but empties the message list so cleared messages
 * do not reappear from local cache.
 */
export async function clearCachedMessages(conversationId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    const store = tx.objectStore(MESSAGES_STORE)
    const existing = await idbGet<{ conversationId: string; messages: any[]; updatedAt: number }>(
      store, conversationId
    )
    if (existing) {
      await idbPut(store, { conversationId, messages: [], updatedAt: Date.now() })
    }
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] clearCachedMessages failed:", err)
  }
}

// ─── Conversations (Sidebar) ────────────────────────────────────────────────

/** Cache the full conversations/sidebar list for offline access. */
export async function cacheConversations(items: any[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(CONVERSATIONS_STORE, "readwrite")
    await idbPut(tx.objectStore(CONVERSATIONS_STORE), { id: "sidebar", items, updatedAt: Date.now() })
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] cacheConversations failed:", err)
  }
}

/** Load cached conversations list. Returns null if no cache. */
export async function getCachedConversations(): Promise<any[] | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(CONVERSATIONS_STORE, "readonly")
    const record = await idbGet<{ id: string; items: any[] }>(
      tx.objectStore(CONVERSATIONS_STORE), "sidebar"
    )
    return record?.items ?? null
  } catch (err) {
    console.warn("[MessageCache] getCachedConversations failed:", err)
    return null
  }
}

// ─── Offline Outbox ──────────────────────────────────────────────────────────
//
// Messages attempted while offline are stored here. When the socket
// reconnects, MessagingCenter drains the outbox and re-emits them.
// Each entry is independent (keyed by tempId) so individual retries
// and removals don't affect other pending messages.

export interface OutboxMessage {
  tempId: string
  conversationId: string
  senderId: string
  content: string
  type: string
  attachment?: any
  replyToId?: string
  createdAt: number
  retries: number
}

/** Add a message to the offline outbox. */
export async function enqueueOutboxMessage(msg: OutboxMessage): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(OUTBOX_STORE, "readwrite")
    await idbPut(tx.objectStore(OUTBOX_STORE), msg)
    await txComplete(tx)
    console.log("[MessageCache] Enqueued outbox message:", msg.tempId)
  } catch (err) {
    console.warn("[MessageCache] enqueueOutboxMessage failed:", err)
  }
}

/** Get all pending outbox messages, ordered by creation time. */
export async function getOutboxMessages(): Promise<OutboxMessage[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(OUTBOX_STORE, "readonly")
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(OUTBOX_STORE)
      const index = store.index("createdAt")
      const req = index.getAll()
      req.onsuccess = () => resolve(req.result as OutboxMessage[])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn("[MessageCache] getOutboxMessages failed:", err)
    return []
  }
}

/** Remove a successfully delivered message from the outbox. */
export async function removeOutboxMessage(tempId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(OUTBOX_STORE, "readwrite")
    await idbDelete(tx.objectStore(OUTBOX_STORE), tempId)
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] removeOutboxMessage failed:", err)
  }
}

/** Increment retry count for an outbox message. */
export async function incrementOutboxRetries(tempId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(OUTBOX_STORE, "readwrite")
    const store = tx.objectStore(OUTBOX_STORE)
    const record = await idbGet<OutboxMessage>(store, tempId)
    if (record) {
      await idbPut(store, { ...record, retries: record.retries + 1 })
    }
    await txComplete(tx)
  } catch (err) {
    console.warn("[MessageCache] incrementOutboxRetries failed:", err)
  }
}

/** Prune old cached conversation message entries (older than 14 days or exceeding 50 conversations). */
export async function pruneOldCache(maxDays = 14, maxConversations = 50): Promise<void> {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(MESSAGES_STORE)) return

    const tx = db.transaction(MESSAGES_STORE, "readwrite")
    const store = tx.objectStore(MESSAGES_STORE)

    const req = store.getAll()
    req.onsuccess = async () => {
      const records: { conversationId: string; messages: any[]; updatedAt: number }[] = req.result || []
      const now = Date.now()
      const maxAgeMs = maxDays * 24 * 60 * 60 * 1000

      // Filter records older than maxDays
      const toDelete: string[] = []
      records.forEach((rec) => {
        if (rec.updatedAt && now - rec.updatedAt > maxAgeMs) {
          toDelete.push(rec.conversationId)
        }
      })

      // If still exceeding maxConversations, delete oldest
      const remaining = records.filter(r => !toDelete.includes(r.conversationId))
      if (remaining.length > maxConversations) {
        remaining.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
        const excessCount = remaining.length - maxConversations
        for (let i = 0; i < excessCount; i++) {
          toDelete.push(remaining[i].conversationId)
        }
      }

      for (const convId of toDelete) {
        store.delete(convId)
      }
    }
  } catch (err) {
    console.warn("[MessageCache] pruneOldCache failed:", err)
  }
}

/** Clear all cached data (called on logout). */
export async function clearMessageCache(): Promise<void> {
  try {
    const db = await openDB()
    const storesToClear = [MESSAGES_STORE, CONVERSATIONS_STORE, OUTBOX_STORE].filter(store => 
      db.objectStoreNames.contains(store)
    )
    if (storesToClear.length === 0) return

    const tx = db.transaction(storesToClear, "readwrite")
    storesToClear.forEach(store => {
      tx.objectStore(store).clear()
    })
    await txComplete(tx)
    console.log("[MessageCache] Cache cleared")
  } catch (err) {
    console.warn("[MessageCache] clearMessageCache failed:", err)
  }
}
