// Zetime Firebase Messaging Service Worker
// Handles background push notifications for messages and calls

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCSIXAPFXbi5xj37eXTfVe5a2oHg_2j8mU",
  authDomain: "zetime-16774.firebaseapp.com",
  projectId: "zetime-16774",
  storageBucket: "zetime-16774.firebasestorage.app",
  messagingSenderId: "30878856713",
  appId: "1:30878856713:web:b245fd0d02e65745002ad8",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Background message handler ─────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const data = payload.data || {};
  const type = data.type;

  if (type === 'new_message') {
    handleMessageNotification(data);
  } else if (type === 'incoming_call') {
    handleCallNotification(data, payload);
  } else if (payload.notification) {
    // Generic notification fallback
    const { title, body } = payload.notification;
    self.registration.showNotification(title || 'Bright Path', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'bright-path-general',
      data: data,
    });
  }
});

// ── Message notification ───────────────────────────────────────────────────
function handleMessageNotification(data) {
  const senderName   = data.senderName     || 'New Message';
  const preview      = data.messagePreview || 'You have a new message';
  const conversationId = data.conversationId;
  const tag          = data.tag || `chat-${conversationId}`;
  const avatar       = data.senderAvatar || '/icon-192.png';

  self.registration.showNotification(senderName, {
    body: preview,
    icon: avatar,
    badge: '/icon-192.png',
    tag,                    // Same tag = stacked notifications per chat (Telegram-style)
    renotify: true,         // Always play sound even for same tag
    silent: false,
    vibrate: [250, 150, 250],
    data: {
      url: '/messaging',
      conversationId,
      type: 'new_message',
    },
    actions: [
      { action: 'open', title: '💬 Open Chat' },
    ],
  });
}

// ── Call notification ──────────────────────────────────────────────────────
function handleCallNotification(data, payload) {
  const callerName = data.callerName || 'Unknown';
  const callType   = data.callType  || 'voice';

  const title = `Incoming ${callType} call`;

  self.registration.showNotification(title, {
    body: callerName,
    icon: data.callerAvatar || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'incoming-call',
    requireInteraction: true,  // Stay on screen until user acts
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
    data: {
      url: '/messaging',
      type: 'incoming_call',
      callId: data.callId,
    },
    actions: [
      { action: 'answer',  title: '✅ Answer'  },
      { action: 'decline', title: '❌ Decline' },
    ],
  });
}

// ── Notification click handler ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const action = event.action;

  let url = data.url || '/messaging';

  if (action === 'decline') {
    // Just close — no navigation needed
    return;
  }

  // For all other clicks/actions: open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to find an existing window and focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          // Post message to the app so it can navigate to the conversation
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            conversationId: data.conversationId,
            notifType: data.type,
          });
          return client.focus();
        }
      }
      // No existing window — open a new one
      return clients.openWindow(url);
    })
  );
});

// ── Push event fallback (for browsers that bypass onBackgroundMessage) ─────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }

  // If Firebase SDK already handled it via onBackgroundMessage, skip
  // (detected by presence of "notification" key which Firebase sets after processing)
  if (payload.notification) return;

  const data = payload.data || {};
  if (data.type === 'new_message') {
    event.waitUntil(handleMessageNotification(data));
  }
});
