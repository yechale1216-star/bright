# Offline Support

Addis Hiwot uses **Capacitor** on Android and **Progressive Web App (PWA)** capabilities on the web to support limited offline functionality.

## How It Works

### Data Persistence

Attendance records, messages, and other data are persisted to the PostgreSQL database via the backend API. On mobile, Capacitor provides access to device storage for caching and temporary queuing when connectivity is lost.

### Offline Indicator

The app displays an online/offline status banner when connectivity changes:

- **Offline:** Orange banner — "You're offline. Changes will sync when you're back online."
- **Back online:** Green banner — "Back online! Syncing your changes..." (auto-dismisses after 5 seconds)

### Background Sync

Failed API operations are queued locally and retried when connectivity is restored. The queue uses exponential backoff with a maximum of 3 retries before discarding an item.

## PWA Installation

When accessed via a supported browser on Android or desktop, users can install the app to their home screen for a near-native experience:

- Standalone window (no browser UI)
- Faster loading with cached assets
- Offline fallback for previously visited pages

## Service Worker Caching Strategy

| Asset Type | Strategy |
|---|---|
| Static assets (JS, CSS, icons) | Cache-first |
| API responses | Network-first with cache fallback |
| Images | Cache with network update |

## Testing Offline Mode

### Browser (Desktop)
1. Open Chrome DevTools (F12).
2. Navigate to the **Network** tab.
3. Enable the **Offline** checkbox.
4. Test app behaviour.

### Android Device
1. Enable Airplane Mode.
2. Open the app.
3. Verify that previously loaded data is still accessible.
4. Disable Airplane Mode and confirm sync resumes.

## Troubleshooting

### App not working offline
- Clear browser/app cache and reload once while online.
- On Android, force-stop the app and reopen it.
- Verify the service worker is registered: Chrome DevTools > Application > Service Workers.

### Sync queue stuck
- Open the browser console and check for network errors.
- To manually clear the sync queue: `localStorage.removeItem('sync_queue')`.
