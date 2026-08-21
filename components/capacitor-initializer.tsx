
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { NativeBridge } from '@/lib/utils/native-bridge'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useAuth } from '@/lib/context/auth-context'
import { toast } from 'sonner'

// Root/entry screens where back button should trigger "exit app" behavior
const ROOT_PATHS = [
  '/',
  '/login',
  '/parent/dashboard',
  '/school/admin',
  '/school/teacher',
]

function isRootPath(pathname: string): boolean {
  return ROOT_PATHS.some(root => pathname === root || pathname === root + '/')
}

export function CapacitorInitializer() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  // Track the last back press timestamp for "press again to exit"
  const lastBackPressRef = useRef<number>(0)
  // Store pathname in a ref so the backButton listener always has the latest value
  const pathnameRef = useRef(pathname)

  // Keep pathnameRef in sync
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // ─── Android Hardware Back Button Handler ──────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const backButtonHandler = App.addListener('backButton', ({ canGoBack }) => {
      const currentPath = pathnameRef.current

      console.log(`[BackButton] pressed | path: ${currentPath} | canGoBack: ${canGoBack}`)

      // If we're on a root screen, use "press again to exit" pattern
      if (isRootPath(currentPath)) {
        const now = Date.now()
        const timeSinceLastPress = now - lastBackPressRef.current

        if (timeSinceLastPress < 2000) {
          // Second press within 2 seconds — exit the app
          console.log('[BackButton] Double-press detected on root screen. Exiting app.')
          App.exitApp()
        } else {
          // First press — show toast warning
          lastBackPressRef.current = now
          toast('Press back again to exit', {
            duration: 2000,
            position: 'bottom-center',
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '14px',
            },
          })
          console.log('[BackButton] First press on root screen. Waiting for second press.')
        }
        return
      }

      // Not a root screen — navigate back
      if (canGoBack) {
        console.log('[BackButton] Navigating back via history.')
        window.history.back()
      } else {
        // Fallback: if Capacitor says we can't go back but we're not on root,
        // try router.back() which works with Next.js internal history
        console.log('[BackButton] No browser history, using router.back().')
        router.back()
      }
    })

    return () => {
      backButtonHandler.then(handle => handle.remove()).catch(() => { })
    }
  }, [router])

  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('[CapacitorInitializer] Received navigate event:', detail);
      if (detail && detail.route) {
        router.push(detail.route);
      } else if (detail && detail.type === 'new_message' && detail.conversationId) {
        router.push(`/parent/communication`);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('zetime:open_conversation', {
            detail: { conversationId: detail.conversationId }
          }));
        }, 300);
      }
    };

    window.addEventListener('zetime:navigate', handleNavigateEvent);
    return () => {
      window.removeEventListener('zetime:navigate', handleNavigateEvent);
    };
  }, [router]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      console.log('Zetime: Native Platform Detected. Initializing Bridge...')

      // If user is authenticated, ensure the token is synced to native SharedPreferences as well
      const syncTokenAndFeatures = async () => {
        const token = localStorage.getItem('attendance_token');
        if (token) {
          console.log('[CapacitorInitializer] Syncing auth token to native side...');
          await NativeBridge.saveAuthToken(token);
        }

        console.log('[CapacitorInitializer] Running NativeBridge.initPush...');
        await NativeBridge.initPush();
      };

      syncTokenAndFeatures().catch(err => {
        console.warn('Authentication/Push initialization failed:', err)
      });

      // Deep Linking & Network Monitoring
      NativeBridge.initDeepLinks(router)
      NativeBridge.initNetworkListener()

      // Listen to foreground notifications from native push service
      let foregroundSub: any = null;
      try {
        foregroundSub = NativeBridge.addForegroundNotificationListener((data: any) => {
          console.log('[Native] Foreground notification received:', data);
          window.dispatchEvent(new CustomEvent('zetime:in_app_notification', {
            detail: {
              type: data.type,
              title: data.title || 'Addis Hiwot Notification',
              body: data.body || 'You have a new update',
              route: data.route,
              conversationId: data.conversationId,
              studentId: data.studentId,
              schoolId: data.schoolId,
              badge: data.badge
            }
          }));
        });
      } catch (err) {
        console.warn('Failed to listen to native foreground notifications:', err);
      }

      // Listen for app foreground/resume events to invalidate cache and refresh UI
      let appStateSub: any = null;
      try {
        appStateSub = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('[CapacitorInitializer] App resumed. Invalidating caches...');
            try {
              const { queryCache } = require('@/lib/utils/query-cache');
              queryCache.clear();
            } catch (err) {
              console.warn('[CapacitorInitializer] Failed to clear query cache:', err);
            }
            // Dispatch events to active components to force reloading from network
            window.dispatchEvent(new CustomEvent('studentDataChanged'));
            window.dispatchEvent(new CustomEvent('attendanceDataChanged'));
            window.dispatchEvent(new CustomEvent('staffAttendanceDataChanged'));
            window.dispatchEvent(new CustomEvent('settingsDataChanged'));
            window.dispatchEvent(new CustomEvent('teacherDataChanged'));
            window.dispatchEvent(new CustomEvent('userDataChanged'));
            window.dispatchEvent(new CustomEvent('parentNotificationsChanged'));
            window.dispatchEvent(new CustomEvent('disciplineDataChanged'));
          }
        });
      } catch (err) {
        console.warn('Failed to listen to appStateChange:', err);
      }

      // Splash screen is now hidden manually by StartupLoadingScreen to guarantee smooth transition
      // SplashScreen.hide()

      return () => {
        if (foregroundSub) {
          foregroundSub.then((s: any) => s?.remove()).catch(() => { });
        }
        if (appStateSub) {
          appStateSub.then((s: any) => s?.remove()).catch(() => { });
        }
      };
    }
  }, [router, user?.id])

  return null
}
