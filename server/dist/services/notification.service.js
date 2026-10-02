"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = sendPushNotification;
exports.sendMessageNotification = sendMessageNotification;
exports.sendCallNotification = sendCallNotification;
exports.sendCallCancellation = sendCallCancellation;
exports.sendCategoryNotification = sendCategoryNotification;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
let app;
// Initialize firebase admin with env variables
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        const existingApps = (0, app_1.getApps)();
        if (existingApps.length === 0) {
            app = (0, app_1.initializeApp)({
                credential: (0, app_1.cert)(serviceAccount)
            });
            console.log('[NotificationService] Firebase Admin initialized');
        }
        else {
            app = existingApps[0];
        }
    }
    catch (e) {
        console.error('[NotificationService] Failed to initialize Firebase Admin:', e);
    }
}
/**
 * Sends a push notification to a specific user device.
 * Used for new messages and incoming calls.
 */
async function sendPushNotification(token, title, body, data = {}) {
    const activeApp = app || ((0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : undefined);
    if (!activeApp) {
        console.warn('[NotificationService] Firebase Admin not initialized. Skipping push.');
        return;
    }
    const message = {
        notification: { title, body },
        data: {
            ...data,
            type: data.type || 'message',
            tag: data.tag || (data.type === 'call' ? 'incoming-call' : 'new-message')
        },
        token: token,
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: data.type === 'call' ? 'incoming_calls_v8' : 'high_priority_v8',
                tag: data.tag || (data.type === 'call' ? 'incoming-call' : 'new-message')
            }
        },
        apns: {
            payload: {
                aps: {
                    contentAvailable: true,
                    sound: 'default',
                    category: data.type === 'call' ? 'INCOMING_CALL' : undefined
                }
            }
        },
        webpush: {
            headers: {
                Urgency: 'high'
            },
            notification: {
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.tag || (data.type === 'call' ? 'incoming-call' : 'new-message'),
                renotify: true,
                requireInteraction: data.type === 'call'
            }
        }
    };
    try {
        const messaging = (0, messaging_1.getMessaging)(activeApp);
        const response = await messaging.send(message);
        return response;
    }
    catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[NotificationService] Token is no longer valid');
            return 'EXPIRED_TOKEN';
        }
        console.error('[NotificationService] Error sending push notification:', error);
    }
}
/**
 * Sends a rich FCM message for a new chat message.
 * Includes both notification and data blocks so Android shows it on the
 * lock screen / notification tray even when the app is backgrounded or killed.
 */
async function sendMessageNotification(token, payload) {
    const activeApp = app || ((0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : undefined);
    if (!activeApp)
        return;
    const preview = payload.messagePreview.length > 100
        ? payload.messagePreview.substring(0, 97) + '...'
        : payload.messagePreview;
    const message = {
        // notification block ensures delivery on lock screen / killed app via Google Play Services
        notification: {
            title: payload.senderName,
            body: preview,
        },
        data: {
            type: 'new_message',
            notifType: 'new_message',
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            senderName: payload.senderName,
            senderAvatar: payload.senderAvatar,
            messagePreview: preview,
            messageType: payload.messageType,
            tag: `chat-${payload.conversationId}`,
            timestamp: Date.now().toString(),
        },
        token,
        android: {
            priority: 'high',
            ttl: 86400000,
            notification: {
                channelId: 'high_priority_v8',
                sound: 'notification',
                visibility: 'public',
            },
        },
        apns: {
            payload: {
                aps: { contentAvailable: true, sound: 'default', badge: 1 },
            },
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
            },
        },
        webpush: {
            headers: { Urgency: 'high' },
            notification: {
                title: payload.senderName,
                body: preview,
                icon: payload.senderAvatar || '/icon-192.png',
                badge: '/icon-192.png',
                tag: `chat-${payload.conversationId}`,
                renotify: true,
            },
        },
    };
    try {
        const messaging = (0, messaging_1.getMessaging)(activeApp);
        const response = await messaging.send(message);
        return response;
    }
    catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[NotificationService] Message token expired');
            return 'EXPIRED_TOKEN';
        }
        console.error('[NotificationService] Error sending message notification:', error);
    }
}
/**
 * Sends a DATA-ONLY high-priority FCM call notification.
 * Must NOT include a notification block — if it does, Google Play Services
 * renders a basic banner and skips onMessageReceived entirely, so our Java code
 * (which adds Answer/Decline buttons, vibration, and fullScreenIntent) never runs.
 * High-priority data messages reliably wake the app even when backgrounded.
 */
async function sendCallNotification(token, data) {
    const activeApp = app || ((0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : undefined);
    if (!activeApp)
        return;
    const message = {
        // DATA-ONLY: no notification block — ensures onMessageReceived fires so Java
        // can show the full HUN with Answer/Decline action buttons + vibration + fullScreenIntent
        data: {
            type: 'incoming_call',
            notifType: 'incoming_call',
            callId: data.callId,
            callerId: data.callerId,
            callerName: data.callerName,
            callType: data.callType,
            serverUrl: data.serverUrl,
            isIncomingCall: 'true',
        },
        token: token,
        android: {
            priority: 'high', // critical: wakes the device even when screen is off
            ttl: 30000, // 30-second max age — stale calls must not ring
        },
        apns: {
            payload: {
                aps: {
                    contentAvailable: true,
                    priority: 10,
                },
            },
        },
    };
    try {
        const messaging = (0, messaging_1.getMessaging)(activeApp);
        const sendWithRetry = async (msg, retries = 3, delay = 500) => {
            try {
                return await messaging.send(msg);
            }
            catch (err) {
                if (retries > 0 && (err.code === 'messaging/internal-error' || err.code === 'messaging/server-unavailable' || err.code === 'messaging/unknown-error')) {
                    console.warn(`[NotificationService] FCM transient failure (${err.code}). Retrying call token in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    return sendWithRetry(msg, retries - 1, delay * 2);
                }
                throw err;
            }
        };
        return await sendWithRetry(message);
    }
    catch (error) {
        console.error('[NotificationService] Error sending call notification:', error);
    }
}
/**
 * Sends a notification to cancel an ongoing call ring.
 * Data-only is intentional here — no system tray entry needed, just wake the app.
 */
async function sendCallCancellation(token, callId) {
    const activeApp = app || ((0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : undefined);
    if (!activeApp)
        return;
    const message = {
        data: {
            type: 'cancel_call',
            callId,
        },
        token: token,
        android: {
            priority: 'high',
        }
    };
    try {
        const messaging = (0, messaging_1.getMessaging)(activeApp);
        return await messaging.send(message);
    }
    catch (error) {
        console.error('[NotificationService] Error sending call cancellation:', error);
    }
}
/**
 * Sends a structured, category-specific push notification.
 * Includes BOTH notification and data blocks:
 *   - notification block → Google Play Services shows it natively on lock screen / killed app
 *   - data block         → carries routing info for deep-linking when the user taps
 *   - android.notification.channelId → uses our custom channels (sound, vibration, priority)
 */
async function sendCategoryNotification(token, payload) {
    const activeApp = app || ((0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : undefined);
    if (!activeApp)
        return;
    const dataPayload = {
        type: payload.type,
        // Duplicate as notifType so MainActivity.handleIntent works for both tap paths
        notifType: payload.type,
        title: payload.title,
        body: payload.body,
        timestamp: Date.now().toString(),
    };
    if (payload.route)
        dataPayload.route = payload.route;
    if (payload.studentId)
        dataPayload.studentId = payload.studentId;
    if (payload.schoolId)
        dataPayload.schoolId = payload.schoolId;
    if (payload.schoolName)
        dataPayload.schoolName = payload.schoolName;
    if (payload.categoryLabel)
        dataPayload.categoryLabel = payload.categoryLabel;
    if (payload.badge !== undefined)
        dataPayload.badge = payload.badge.toString();
    if (payload.tag)
        dataPayload.tag = payload.tag;
    // Map notification type to Android channel ID (must match MyFirebaseMessagingService channels)
    let channelId = 'default_priority_v8';
    if (payload.type === 'new_message' || payload.type === 'account_security' || payload.type === 'student_discipline' || payload.type === 'discipline') {
        channelId = 'high_priority_v8';
    }
    else if (payload.type === 'system_update') {
        channelId = 'low_priority_v8';
    }
    const message = {
        notification: {
            // Title = school name so parent immediately knows which school sent it
            title: payload.schoolName || payload.title,
            body: payload.body,
        },
        data: dataPayload,
        token,
        android: {
            priority: 'high',
            ttl: 86400000,
            notification: {
                channelId,
                sound: channelId === 'low_priority' ? undefined : 'notification',
                visibility: 'public',
            },
        },
        apns: {
            payload: {
                aps: {
                    contentAvailable: true,
                    sound: 'default',
                    badge: payload.badge
                },
            },
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
            },
        },
        webpush: {
            headers: { Urgency: 'high' },
            notification: {
                title: payload.title,
                body: payload.body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: payload.tag || payload.type,
                renotify: true,
            },
        },
    };
    try {
        const messaging = (0, messaging_1.getMessaging)(activeApp);
        const response = await messaging.send(message);
        return response;
    }
    catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[NotificationService] Category token expired');
            return 'EXPIRED_TOKEN';
        }
        console.error('[NotificationService] Error sending category notification:', error);
    }
}
