'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io as ClientIO, Socket } from 'socket.io-client';
import { socketUrl } from '@/lib/api-config';
import { authService } from '@/lib/auth/auth';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/lib/context/auth-context';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  /** Manually force a reconnect (e.g. after restoring from background) */
  reconnect: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  // Disconnect and reconnect socket on auth user changes to re-evaluate token
  useEffect(() => {
    if (socketRef.current) {
      console.log('[SocketProvider] Auth user changed — reconnecting socket...');
      socketRef.current.disconnect();
      if (user) {
        socketRef.current.connect();
      }
    }
  }, [user]);

  const authenticate = useCallback(async (s: Socket) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
    if (token && s.connected) {
      console.log('[SocketProvider] Authenticating socket...');
      s.emit('authenticate', { token });

      // Signal to CallProvider (and any other listeners) that the socket
      // is now authenticated and ready to send signaling events.
      // This is critical for the ANSWER flow when the app resumes from background.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('socket:authed'));
        console.log('[SocketProvider] socket:authed event dispatched');
      }

      // --- Register Push Token ---
      try {
        const { registerPushNotifications } = await import('@/lib/utils/push-notifications');
        const pushToken = await registerPushNotifications();
        if (pushToken) {
          s.emit('register_push_token', { token: pushToken });
        }
      } catch (err) {
        console.warn('[SocketProvider] Push registration failed:', err);
      }
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected && user) {
      socketRef.current.connect();
    }
  }, [user]);

  useEffect(() => {
    // ── WebSocket-first transport (skip HTTP long-polling entirely).
    // This reduces connection latency by ~300ms on initial connect and
    // eliminates the polling overhead that drains battery on mobile.
    const hasUser = typeof window !== 'undefined' ? (!!localStorage.getItem('attendance_current_user') && !!localStorage.getItem('attendance_token')) : false;

    const socketInstance = ClientIO(socketUrl, {
      // Start with polling so the connection succeeds even on Render cold starts
      // or behind proxies that block WebSocket upgrades. Socket.IO will automatically
      // upgrade to WebSocket once the initial handshake completes.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,  // Never give up — Telegram doesn't give up
      reconnectionDelay: 1000,         // Start at 1s
      reconnectionDelayMax: 30000,     // Cap at 30s (mobile: don't hammer the server)
      randomizationFactor: 0.5,        // Jitter to avoid thundering herd on server restart
      timeout: 20000,
      autoConnect: hasUser,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id);
      setIsConnected(true);
      // ── CRITICAL: Re-authenticate after every reconnect.
      // Without this, the server treats the reconnected socket as unauthenticated,
      // causing all subsequent events to be rejected silently.
      authenticate(socketInstance);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);

      // If the server disconnected us intentionally (e.g. timeout), reconnect immediately.
      // Socket.IO handles transport-close and ping-timeout automatically; we handle the rest.
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempt(s)`);
    });

    socketInstance.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] Reconnect attempt #${attempt}`);
    });

    socketInstance.on('new_message', (message: any) => {
      const currentUser = authService.getCurrentUser();

      // Don't show notification for our own messages
      if (currentUser && message.senderId === currentUser.id) return;

      // Dispatch a custom event so MessagingCenter and NotificationPopover
      // can both react immediately without re-fetching.
      window.dispatchEvent(new CustomEvent('zetime:new_message', {
        detail: {
          conversationId: message.conversationId,
          senderId:       message.senderId,
          senderName:     message.sender?.full_name || 'New Message',
          senderAvatar:   message.sender?.profile_photo || '',
          preview:        message.content || (message.type !== 'TEXT' ? '📎 Attachment' : 'New message'),
          timestamp:      message.createdAt,
        },
      }));

      // Also fire the generic badge update used by the header notification bell
      window.dispatchEvent(new Event('new_notification'));

      // Fire custom in-app notification banner (Telegram style)
      window.dispatchEvent(new CustomEvent('zetime:in_app_notification', {
        detail: {
          type: 'new_message',
          title: message.sender?.full_name || 'New Message',
          body: message.content || (message.type !== 'TEXT' ? '📎 Attachment' : 'New message'),
          conversationId: message.conversationId
        }
      }));
    });

    setSocket(socketInstance);

    // ── Network-aware reconnection.
    // When a mobile device goes offline then comes back, the socket may
    // have silently dropped. Listen to the browser online event and force
    // a reconnect rather than waiting for the next reconnection attempt.
    const handleOnline = () => {
      console.log('[Socket] Network restored — reconnecting...');
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    const handleOffline = () => {
      console.log('[Socket] Network lost — socket will auto-reconnect when back online');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Only prompt for web notification permission and register the service worker for web platforms
      if (!Capacitor.isNativePlatform()) {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(err => console.warn('[SocketProvider] Notification permission error:', err));
        }

        // Register PWA Service Worker (includes Firebase messaging)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
              console.log('[SocketProvider] Service Worker registered:', reg.scope);
            })
            .catch((err) => console.warn('[SocketProvider] SW registration failed:', err));

          // ── Handle notification tap from service worker ──────────────────────
          // When user taps a push notification (app was closed), the SW posts a
          // NOTIFICATION_CLICK message here so we can navigate to the right chat.
          navigator.serviceWorker.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg) return;
            if (msg.type === 'NOTIFICATION_CLICK' && msg.conversationId) {
              window.dispatchEvent(new CustomEvent('zetime:open_conversation', {
                detail: { conversationId: msg.conversationId },
              }));
            }
          });
        }
      }
    }

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [authenticate]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};
