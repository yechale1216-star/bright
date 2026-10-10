// DEV MODE: This service worker clears all caches and unregisters itself
// so the live development server can serve all assets directly.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => caches.delete(name)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.registration.unregister()
    )
  )
})

// Pass ALL requests straight through to the network — no caching
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
