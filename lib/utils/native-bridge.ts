import { Camera, CameraResultType } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { registerPlugin } from '@capacitor/core';

interface CallPlugin {
  endCall: () => Promise<void>;
  startRinging: (options: {
    callerName: string;
    callId?: string;
    callerId?: string;
    callType?: string;
    serverUrl?: string;
    callerAvatar?: string;
  }) => Promise<void>;
  showCallBanner: (options: {
    callerName: string;
    callId?: string;
    callerId?: string;
    callType?: string;
    serverUrl?: string;
    callerAvatar?: string;
  }) => Promise<void>;
  dismissCallBanner: () => Promise<void>;
  saveAuthToken: (options: { token: string; apiUrl?: string }) => Promise<void>;
  deregisterFcmToken: () => Promise<void>;
  getPendingCall: () => Promise<{
    hasPending: boolean;
    action?: string;
    type?: string;
    route?: string;
    conversationId?: string;
    studentId?: string;
    schoolId?: string;
    callId?: string;
    callerId?: string;
    callerName?: string;
    callType?: string;
  }>;
  addListener: (
    eventName: 'onCallAction' | 'onForegroundNotification',
    listenerFunc: (data: any) => void
  ) => Promise<any>;
  requestPermissions: (options?: { permissions: string[] }) => Promise<any>;
  checkPermissions: () => Promise<any>;
  setAudioModeInCall: (options?: { speakerphone?: boolean }) => Promise<void>;
  setAudioModeNormal: () => Promise<void>;
  setSpeakerphone: (options: { enabled: boolean }) => Promise<void>;
  isLocationEnabled: () => Promise<{ enabled: boolean }>;
  openAppSettings: () => Promise<void>;
  openLocationSettings: () => Promise<void>;
}

const CallPlugin = registerPlugin<CallPlugin>('CallPlugin');

export const NativeBridge = {
  isNative: () => Capacitor.isNativePlatform(),

  // Saves JWT token to native SharedPreferences
  saveAuthToken: async (token: string, apiUrl?: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const urlToPersist = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'https://zetime-backend.onrender.com';
        await CallPlugin.saveAuthToken({ token, apiUrl: urlToPersist });
      } catch (e) {
        console.warn('[NativeBridge] saveAuthToken failed', e);
      }
    }
  },

  // Deregisters FCM token from Firebase — call on sign-out to prevent
  // the device from receiving notifications/calls after the user logs out.
  deregisterFcmToken: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.deregisterFcmToken();
        console.log('[NativeBridge] ✅ FCM token deleted from Firebase');
      } catch (e) {
        // Non-fatal — server has already cleared the token in the DB via logout API
        console.warn('[NativeBridge] deregisterFcmToken failed (non-fatal):', e);
      }
    }
  },

  // Deep Link Handling
  initDeepLinks: (router: any) => {
    if (!Capacitor.isNativePlatform()) return;
    
    App.addListener('appUrlOpen', (event: any) => {
      const slug = event.url.split('.app').pop() || event.url.split('.com').pop();
      if (slug) {
        router.push(slug);
      }
    });
  },

  // Network Sensitivity
  initNetworkListener: () => {
    if (!Capacitor.isNativePlatform()) return;
    
    Network.addListener('networkStatusChange', status => {
      // Offline UI is handled globally by GlobalOfflineOverlay in app/layout.tsx
      // No toast needed — the full-screen overlay takes over automatically
      console.log('[NativeBridge] Network status changed:', status.connected ? 'online' : 'offline');
    });
  },

  // Haptics (Vibrational Feedback)
  vibrate: async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (e) {
        console.warn('Haptics not available');
      }
    }
  },

  // Camera Integration
  takePhoto: async () => {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Camera only available on native device');
    }
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Uri
    });
    return image.webPath;
  },

  // Push Notifications Setup
  // CRITICAL: This registers for FCM and SAVES the token to the backend.
  // Without saving the token, the server has no way to send targeted push notifications.
  initPush: async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }

      if (perm.receive !== 'granted') {
        console.warn('[NativeBridge] Push permission denied by user');
        return;
      }

      await PushNotifications.register();

      // ── Token Handler ────────────────────────────────────────────────────
      // Called on first launch and whenever FCM refreshes the token.
      // We MUST send this to the backend or no server-side push will ever work.
      PushNotifications.addListener('registration', async (token) => {
        console.log('[NativeBridge] FCM token received:', token.value);
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://zetime-backend.onrender.com';
          const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('attendance_token') : null;
          
          if (authToken) {
            // Also sync the token to Java so background FCM receiver can use it on refresh
            await NativeBridge.saveAuthToken(authToken, API_URL);
          }
          
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }
          
          const res = await fetch(`${API_URL}/api/auth/push-token`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ token: token.value }),
          });
          if (res.ok) {
            console.log('[NativeBridge] ✅ FCM token saved to server');
          } else {
            const text = await res.text().catch(() => '');
            console.warn('[NativeBridge] Server rejected FCM token:', res.status, text);
          }
        } catch (e) {
          console.error('[NativeBridge] Failed to POST FCM token to server:', e);
        }
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[NativeBridge] FCM registration error:', JSON.stringify(error));
      });

      // ── Foreground Push (Capacitor fallback) ─────────────────────────────
      // When the app is open, Capacitor intercepts the push before Android shows it.
      // We fire the in-app banner manually here.
      PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
        console.log('[NativeBridge] Push received in foreground:', notification);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('zetime:in_app_notification', {
            detail: {
              type: notification.data?.type || 'general',
              title: notification.title || 'Zetime',
              body: notification.body || '',
              route: notification.data?.route,
              conversationId: notification.data?.conversationId,
              studentId: notification.data?.studentId,
              schoolId: notification.data?.schoolId,
            }
          }));
        }
      });

      // ── Notification Tap (background → app open) ──────────────────────
      PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
        console.log('[NativeBridge] Notification tapped:', action);
        const data = action.notification?.data;
        if (data && typeof window !== 'undefined') {
          // ── Task 3: Auth Guard ──────────────────────────────────────────
          // If the user is signed out, route them to the /parent/notifications
          // page which will render the SignedOutWall with a clear "please sign in" message.
          // We NEVER force-navigate into protected pages when the token is missing.
          const token = localStorage.getItem('attendance_token');
          const userStr = localStorage.getItem('attendance_current_user');
          const isSignedIn = !!(token && userStr);

          if (!isSignedIn) {
            // Navigate to the notifications page — the page itself will render
            // the signed-out wall with a clear explanatory message.
            window.dispatchEvent(new CustomEvent('zetime:navigate', {
              detail: {
                type: 'notification_signout_guard',
                route: '/parent/notifications',
              }
            }));
            return;
          }

          window.dispatchEvent(new CustomEvent('zetime:navigate', {
            detail: {
              type: data.type,
              route: data.route,
              conversationId: data.conversationId,
              studentId: data.studentId,
              schoolId: data.schoolId,
            }
          }));
        }
      });

    } catch (e) {
      console.warn('[NativeBridge] Push notification system could not be initialized:', e);
    }
  },

  // Filesystem Exports (CSV/Reports/PDFs)
  saveAndShareFile: async (fileName: string, data: string, mimeType: string, isBase64 = false) => {
    if (!Capacitor.isNativePlatform()) {
      const blob = isBase64 
        ? await (await fetch(`data:${mimeType};base64,${data}`)).blob()
        : new Blob([data], { type: mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      return;
    }

    try {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: data,
        directory: Directory.Documents,
        encoding: isBase64 ? undefined : 'utf8' as any
      });
      console.log('File written: ', result.uri);
      return result.uri;
    } catch (e) {
      console.error('Error writing file', e);
    }
  },

  // Call System Integrations
  getPendingCall: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        return await CallPlugin.getPendingCall();
      } catch (e) {
        console.warn('CallPlugin: getPendingCall failed', e);
      }
    }
    return { hasPending: false };
  },

  requestPermissions: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[NativeBridge] Requesting permissions for call...');
        const res = await CallPlugin.requestPermissions({ permissions: ['camera', 'microphone'] });
        console.log('[NativeBridge] Permissions result:', res);
        return res;
      } catch (e) {
        console.warn('CallPlugin: requestPermissions failed', e);
      }
    }
    return null;
  },

  endNativeCall: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.endCall();
      } catch (e) {
        console.warn('CallPlugin: endCall failed', e);
      }
    }
  },

  startNativeRinging: async (callerName: string, callId?: string, callerId?: string, callType?: string, serverUrl?: string, callerAvatar?: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.startRinging({ callerName, callId, callerId, callType, serverUrl, callerAvatar });
      } catch (e) {
        console.warn('CallPlugin: startRinging failed', e);
      }
    }
  },

  showCallBanner: async (callerName: string, callId?: string, callerId?: string, callType?: string, serverUrl?: string, callerAvatar?: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.showCallBanner({ callerName, callId, callerId, callType, serverUrl, callerAvatar });
      } catch (e) {
        console.warn('CallPlugin: showCallBanner failed', e);
      }
    }
  },

  dismissCallBanner: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.dismissCallBanner();
      } catch (e) {
        console.warn('CallPlugin: dismissCallBanner failed', e);
      }
    }
  },

  addCallActionListener: (callback: (data: any) => void) => {
    if (Capacitor.isNativePlatform()) {
      return CallPlugin.addListener('onCallAction', (data: any) => {
        if (data.action === 'NAVIGATE') {
          window.dispatchEvent(new CustomEvent('zetime:navigate', {
            detail: {
              type: data.type,
              route: data.route,
              conversationId: data.conversationId,
              studentId: data.studentId,
              schoolId: data.schoolId
            }
          }));
        } else {
          callback(data);
        }
      });
    }
    return null;
  },

  addForegroundNotificationListener: (callback: (data: any) => void) => {
    if (Capacitor.isNativePlatform()) {
      return CallPlugin.addListener('onForegroundNotification', (data: any) => {
        callback(data);
      });
    }
    return null;
  },

  /**
   * Switch Android audio to MODE_IN_COMMUNICATION.
   * This enables hardware Acoustic Echo Cancellation (AEC) and Noise
   * Suppression (NS) — the fix for echo/noise disruption during WebRTC calls.
   * Call when the call transitions to CONNECTED.
   */
  setAudioModeInCall: async (speakerphone = false) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.setAudioModeInCall({ speakerphone });
        console.log('[NativeBridge] Audio mode: IN_COMMUNICATION, speakerphone=' + speakerphone);
      } catch (e) {
        console.warn('[NativeBridge] setAudioModeInCall failed (non-fatal):', e);
      }
    }
  },

  /**
   * Restore audio to MODE_NORMAL after a call ends.
   * Required so that media apps (music, video) return to normal routing.
   */
  setAudioModeNormal: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.setAudioModeNormal();
        console.log('[NativeBridge] Audio mode: NORMAL restored');
      } catch (e) {
        console.warn('[NativeBridge] setAudioModeNormal failed (non-fatal):', e);
      }
    }
  },

  /**
   * Toggle speakerphone on/off during an active call.
   */
  setSpeakerphone: async (enabled: boolean) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.setSpeakerphone({ enabled });
      } catch (e) {
        console.warn('[NativeBridge] setSpeakerphone failed (non-fatal):', e);
      }
    }
  },

  /**
   * Request native Android location permission (ACCESS_FINE_LOCATION & ACCESS_COARSE_LOCATION)
   */
  requestLocationPermission: async (): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[NativeBridge] Requesting location permission...');
        const res = await CallPlugin.requestPermissions({ permissions: ['location'] });
        console.log('[NativeBridge] Location permission result:', res);
        return res?.location || 'granted';
      } catch (e) {
        console.warn('CallPlugin: requestLocationPermission failed', e);
        return 'denied';
      }
    }
    return 'granted';
  },

  /**
   * Check current location permission state
   */
  checkLocationPermission: async (): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CallPlugin.checkPermissions();
        return res?.location || 'prompt';
      } catch (e) {
        console.warn('CallPlugin: checkLocationPermission failed', e);
      }
    }
    return 'granted';
  },

  /**
   * Check if device location services (GPS) are enabled at system level
   */
  isLocationServicesEnabled: async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CallPlugin.isLocationEnabled();
        return res.enabled !== false;
      } catch (e) {
        console.warn('CallPlugin: isLocationEnabled failed', e);
        return true;
      }
    }
    return true;
  },

  /**
   * Open app settings (for permanently denied permissions)
   */
  openAppSettings: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.openAppSettings();
      } catch (e) {
        console.warn('CallPlugin: openAppSettings failed', e);
      }
    }
  },

  /**
   * Open location source settings (for disabled GPS)
   */
  openLocationSettings: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CallPlugin.openLocationSettings();
      } catch (e) {
        console.warn('CallPlugin: openLocationSettings failed', e);
      }
    }
  },
};
