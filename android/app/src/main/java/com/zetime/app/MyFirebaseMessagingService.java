package com.zetime.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.zetime.app.R;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "MyFirebaseMessaging";

    // Notification channel IDs - versioned to _v8 to reset cached OS preferences
    private static final String CHANNEL_CALLS    = "incoming_calls_v8";
    private static final String CHANNEL_HIGH     = "high_priority_v8";
    private static final String CHANNEL_DEFAULT  = "default_priority_v8";
    private static final String CHANNEL_LOW      = "low_priority_v8";

    // Notification ID ranges
    private static final int NOTIF_ID_CALL = 1001;

    private boolean isAppInForeground() {
        if (MainActivity.isAppInForeground) {
            return true;
        }
        try {
            android.app.ActivityManager.RunningAppProcessInfo appProcessInfo = new android.app.ActivityManager.RunningAppProcessInfo();
            android.app.ActivityManager.getMyMemoryState(appProcessInfo);
            return (appProcessInfo.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    || appProcessInfo.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM from: " + remoteMessage.getFrom());

        // Copy map to ensure it is mutable so we can safely inject fallback values
        Map<String, String> data = new java.util.HashMap<>(remoteMessage.getData());
        Log.d(TAG, "FCM payload: " + data);
        
        // Log diagnostics to aid in troubleshooting HUN suppression
        logNotificationDiagnostics();

        String type = data.get("type");
        String title = data.get("title");
        String body = data.get("body");

        if (remoteMessage.getNotification() != null) {
            if (title == null) title = remoteMessage.getNotification().getTitle();
            if (body == null) body = remoteMessage.getNotification().getBody();
        }

        if (type == null) {
            if ((title != null && !title.isEmpty()) || (body != null && !body.isEmpty())) {
                type = "general";
                data.put("type", type);
                if (data.get("title") == null) data.put("title", title);
                if (data.get("body") == null) data.put("body", body);
            } else {
                Log.d(TAG, "FCM payload is empty/missing type and notification details, ignoring.");
                return;
            }
        }

        switch (type) {
            case "incoming_call":
                Log.d(TAG, "Handling incoming call");
                String callId = data.get("callId");
                if (callId != null && CallManager.isCallDuplicate(callId)) {
                    Log.d(TAG, "Duplicate FCM incoming_call event ignored. callId: " + callId);
                    break;
                }

                if (isAppInForeground()) {
                    Log.d(TAG, "App is in foreground. Ignoring FCM call notification, relying on WebSocket/Socket.IO.");
                    break;
                }
                handleIncomingCall(data);
                break;
            case "cancel_call":
                Log.d(TAG, "Handling cancel call");
                handleCancelCall(data);
                break;
            case "new_message":
            case "late_arrival":
            case "absent_arrival":
            case "excused_arrival":
            case "new_announcement":
            case "system_update":
            case "account_security":
                Log.d(TAG, "Handling generic notification: " + type);
                handleGenericNotification(data);
                break;
            default:
                Log.d(TAG, "Unknown FCM type: " + type);
                handleGenericNotification(data);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GENERIC NOTIFICATION HANDLING
    // ─────────────────────────────────────────────────────────────────────────

    private void handleGenericNotification(Map<String, String> data) {
        String type           = data.get("type");
        String title          = data.get("title");  // Now = school name
        String body           = data.get("body");
        String route          = data.get("route");
        String conversationId = data.get("conversationId");
        String studentId      = data.get("studentId");
        String schoolId       = data.get("schoolId");
        String schoolName     = data.get("schoolName");
        String categoryLabel  = data.get("categoryLabel");  // e.g. "Absent Alert", "Announcement"
        String tag            = data.get("tag");
        
        if (title == null) title = "Zetime Alert";
        if (body  == null) body  = "You have a new update";
        if (type  == null) type  = "general";

        // Post directly to JS if app is currently in foreground, but do NOT suppress native system tray display
        if (isAppInForeground() && MainActivity.getInstance() != null) {
            Log.d(TAG, "App is in foreground. Posting directly to JS without suppressing system tray display.");
            com.getcapacitor.JSObject notifData = new com.getcapacitor.JSObject();
            for (Map.Entry<String, String> entry : data.entrySet()) {
                notifData.put(entry.getKey(), entry.getValue());
            }
            MainActivity.getInstance().postForegroundNotification(notifData);
        }

        NotificationManager nm = (NotificationManager) this.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        createNotificationChannels(nm);

        // Determine priority, channel, and vibration
        String channelId = CHANNEL_DEFAULT;
        int importance = NotificationCompat.PRIORITY_DEFAULT;
        long[] vibratePattern = new long[]{0, 200, 100, 200};
        String category = NotificationCompat.CATEGORY_EVENT;

        if ("new_message".equals(type) || "account_security".equals(type)) {
            channelId = CHANNEL_HIGH;
            importance = NotificationCompat.PRIORITY_HIGH;
            vibratePattern = new long[]{0, 250, 150, 250};
            category = "new_message".equals(type) ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_STATUS;
        } else if ("system_update".equals(type)) {
            channelId = CHANNEL_LOW;
            importance = NotificationCompat.PRIORITY_LOW;
            vibratePattern = null;
            category = NotificationCompat.CATEGORY_STATUS;
        }

        // Open app to target route on tap
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("notifType", type);
        openIntent.putExtra("route", route);
        openIntent.putExtra("openConversationId", conversationId);
        openIntent.putExtra("studentId", studentId);
        openIntent.putExtra("schoolId", schoolId);

        int requestCode = (conversationId != null) ? conversationId.hashCode() 
                        : (studentId != null) ? studentId.hashCode() 
                        : (int) System.currentTimeMillis();

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, Math.abs(requestCode),
                openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Sound config using generated R.raw.notification
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(importance)
                .setCategory(category)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Visible on lock screen
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setLights(0xFF00FF00, 3000, 3000); // Pulse LED

        if (!CHANNEL_LOW.equals(channelId)) {
            builder.setSound(soundUri);
            if (vibratePattern != null) {
                builder.setVibrate(vibratePattern);
            }
        } else {
            builder.setSound(null);
        }

        // Handle badges if present
        int unreadCount = 0;
        if (data.containsKey("badge")) {
            try { unreadCount = Integer.parseInt(data.get("badge")); } catch (Exception e) {}
        }
        if (unreadCount > 0) {
            builder.setNumber(unreadCount);
        }

        // Stacking / Grouping
        String groupKey = tag;
        if (groupKey == null) {
            if ("new_message".equals(type)) {
                groupKey = "chat-" + (conversationId != null ? conversationId : "default");
            } else if (type.contains("arrival") || type.contains("absent") || type.contains("excused")) {
                groupKey = "attendance";
            } else if ("new_announcement".equals(type)) {
                groupKey = "announcements";
            } else {
                groupKey = "general";
            }
        }

        builder.setGroup(groupKey);
        builder.setGroupSummary(false);

        int notifId = (conversationId != null) ? Math.abs(conversationId.hashCode()) 
                    : (studentId != null) ? Math.abs(studentId.hashCode()) 
                    : (int) System.currentTimeMillis();

        // ── Notification Layout ────────────────────────────────────────────────
        // title   = School Name (set at top, most prominent line)
        // subText = Category type ("Absent Alert", "Late Arrival", "Announcement")
        // body    = The actual message text (expanded via BigTextStyle)

        // Title: prefer title from payload (= school name) else fall back to "ZeTime"
        String displayTitle = (title != null && !title.isEmpty()) ? title : "ZeTime";
        builder.setContentTitle(displayTitle);

        // SubText: show category label if provided, else fall back to schoolName or type
        if (categoryLabel != null && !categoryLabel.isEmpty()) {
            builder.setSubText(categoryLabel);
        } else if (schoolName != null && !schoolName.isEmpty()) {
            builder.setSubText(schoolName);
        }

        nm.notify(notifId, builder.build());

        // Group summary notification (required for stacking on Android 7+)
        showGroupSummary(nm, groupKey, type, channelId, unreadCount);
    }

    private void showGroupSummary(NotificationManager nm, String groupKey, String type, String channelId, int unreadCount) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, Math.abs(groupKey.hashCode()),
                openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String summaryText = "Zetime Notifications";
        if (groupKey.startsWith("chat-")) {
            summaryText = "Zetime Chat Messages";
        } else if ("attendance".equals(groupKey)) {
            summaryText = "Zetime Attendance Updates";
        } else if ("announcements".equals(groupKey)) {
            summaryText = "Zetime Announcements";
        }

        NotificationCompat.Builder summary = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setStyle(new NotificationCompat.InboxStyle().setSummaryText(summaryText))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setGroup(groupKey)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setContentIntent(pi);

        if (unreadCount > 0) {
            summary.setNumber(unreadCount);
        }

        nm.notify(Math.abs(groupKey.hashCode()), summary.build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCOMING CALL
    // ─────────────────────────────────────────────────────────────────────────

    private void handleIncomingCall(Map<String, String> data) {
        String callerName  = data.get("callerName");
        String callerAvatar = data.get("callerAvatar");
        String callId      = data.get("callId");
        String callerId    = data.get("callerId");
        String callType    = data.get("callType");
        String serverUrl   = data.get("serverUrl");

        // Start CallService as a foreground service — it owns the notification lifecycle.
        // CallService.showForegroundNotification() posts the HUN + fullScreenIntent (ID 1002).
        // We must NOT also call showIncomingCallNotification() here because that would post a
        // second conflicting notification (ID 1001) that races the service's startForeground(),
        // causing the system to show two banners and potentially drop the fullScreenIntent.
        Intent intent = new Intent(this, CallService.class);
        intent.putExtra("ACTION", "START_CALL");
        intent.putExtra("callerName", callerName);
        intent.putExtra("callerAvatar", callerAvatar);
        intent.putExtra("callId", callId);
        intent.putExtra("callerId", callerId);
        intent.putExtra("callType", callType);
        intent.putExtra("serverUrl", serverUrl);
        try {
            ContextCompat.startForegroundService(this, intent);
            Log.d(TAG, "CallService started as foreground service for incoming call");
        } catch (Exception e) {
            Log.e(TAG, "startForegroundService failed, falling back to startService", e);
            try {
                this.startService(intent);
            } catch (Exception ex) {
                Log.e(TAG, "Failed to start CallService completely", ex);
            }
        }
    }

    private void handleCancelCall(Map<String, String> data) {
        // Stop the background CallService (for locked/background calls)
        Intent intent = new Intent(this, CallService.class);
        this.stopService(intent);

        NotificationManager nm = (NotificationManager) this.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIF_ID_CALL);
            nm.cancel(1002);
        }

        // Dismiss the foreground banner if showing (for foreground calls)
        CallManager.getInstance().handleCallCanceled();
    }

    private void showIncomingCallNotification(String callerName, String callId, String callType, String callerId, String serverUrl, String callerAvatar) {
        NotificationManager nm = (NotificationManager) this.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        createNotificationChannels(nm);

        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("callerId", callerId);
        fullScreenIntent.putExtra("isIncomingCall", true);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callType", callType);
        fullScreenIntent.putExtra("serverUrl", serverUrl);
        PendingIntent fsPendingIntent = PendingIntent.getActivity(this, 99,
                fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        answerIntent.putExtra("callAction",  "ANSWER");
        answerIntent.putExtra("callId",      callId);
        answerIntent.putExtra("callerId",    callerId);
        answerIntent.putExtra("callType",    callType);
        answerIntent.putExtra("callerName",  callerName);
        answerIntent.putExtra("serverUrl",   serverUrl);
        PendingIntent answerPI = PendingIntent.getActivity(this, 1, answerIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent declineIntent = new Intent(this, CallNotificationActionReceiver.class);
        declineIntent.setAction("ACTION_DECLINE");
        declineIntent.putExtra("callId",    callId);
        declineIntent.putExtra("serverUrl", serverUrl);
        PendingIntent declinePI = PendingIntent.getBroadcast(this, 2, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String callerLabel = callerName != null ? callerName : "Unknown Caller";
        // Task 2: call type label used for ZeTime branded title
        String callTypeLabel = "VIDEO".equalsIgnoreCase(callType) ? "Video" : "Voice";
        // Title is the ZeTime branded call type; body is the caller name (no duplicate)
        String callNotifTitle = "ZeTime " + callTypeLabel + " Call";

        // Generate initials bitmap
        android.graphics.Bitmap initialsBitmap = createInitialsBitmap(callerLabel);

        // Build native CallStyle Person
        Person caller = new Person.Builder()
                .setName(callerLabel)
                .setIcon(IconCompat.createWithBitmap(initialsBitmap))
                .setImportant(true)
                .build();

        // Build CallStyle
        NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forIncomingCall(
                caller, declinePI, answerPI);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_CALLS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(callNotifTitle)       // "ZeTime Voice Call" / "ZeTime Video Call"
                .setContentText(callerLabel)            // just the caller name — no duplicate
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(false)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fsPendingIntent, true)
                .setSound(null)          // sound handled by MediaPlayer/CallService
                .setSilent(true)         // avoid double sound on channel (allows HUN popup flags)
                .setStyle(callStyle);

        nm.notify(NOTIF_ID_CALL, builder.build());

        // Asynchronously load the caller avatar if URL is provided
        loadAvatarAndResource(callerAvatar, callerLabel, declinePI, answerPI, NOTIF_ID_CALL, builder, nm);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATION CHANNELS Setup
    // ─────────────────────────────────────────────────────────────────────────

    private void createNotificationChannels(NotificationManager nm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        AudioAttributes aa = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification);

        // 1. High Priority Channel
        NotificationChannel highCh = new NotificationChannel(
                CHANNEL_HIGH, "High Priority Alert", NotificationManager.IMPORTANCE_HIGH);
        highCh.setDescription("Voice/video calls, chat messages, and security alerts.");
        highCh.enableVibration(true);
        highCh.setVibrationPattern(new long[]{0, 250, 150, 250});
        highCh.setShowBadge(true);
        highCh.setSound(soundUri, aa);
        nm.createNotificationChannel(highCh);

        // 2. Default Priority Channel
        NotificationChannel defaultCh = new NotificationChannel(
                CHANNEL_DEFAULT, "Default Notification", NotificationManager.IMPORTANCE_DEFAULT);
        defaultCh.setDescription("Attendance alerts and announcements.");
        defaultCh.enableVibration(true);
        defaultCh.setVibrationPattern(new long[]{0, 200, 100, 200});
        defaultCh.setShowBadge(true);
        defaultCh.setSound(soundUri, aa);
        nm.createNotificationChannel(defaultCh);

        // 3. Low Priority Channel
        NotificationChannel lowCh = new NotificationChannel(
                CHANNEL_LOW, "Low Priority Update", NotificationManager.IMPORTANCE_LOW);
        lowCh.setDescription("System updates and minor alerts.");
        lowCh.enableVibration(false);
        lowCh.setShowBadge(true);
        lowCh.setSound(null, null);
        nm.createNotificationChannel(lowCh);

        // 4. Calls Channel (existing)
        NotificationChannel callCh = new NotificationChannel(
                CHANNEL_CALLS, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
        callCh.setDescription("Incoming voice and video call notifications");
        callCh.enableVibration(true);
        callCh.setVibrationPattern(new long[]{0, 1000, 500, 1000});
        callCh.setBypassDnd(true);
        callCh.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        AudioAttributes callAa = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
        callCh.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), callAa);
        nm.createNotificationChannel(callCh);
        Log.d(TAG, "Notification channels verified");
    }

    private void logNotificationDiagnostics() {
        try {
            androidx.core.app.NotificationManagerCompat nmc = androidx.core.app.NotificationManagerCompat.from(this);
            boolean enabled = nmc.areNotificationsEnabled();
            Log.d(TAG, "[DIAGNOSTICS] Notifications enabled at system level: " + enabled);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm = (NotificationManager) this.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    for (String cid : new String[]{CHANNEL_CALLS, CHANNEL_HIGH, CHANNEL_DEFAULT, CHANNEL_LOW}) {
                        NotificationChannel chan = nm.getNotificationChannel(cid);
                        if (chan != null) {
                            Log.d(TAG, "[DIAGNOSTICS] Channel status check: ID=" + chan.getId()
                                + ", Name=" + chan.getName()
                                + ", Importance=" + chan.getImportance()
                                + ", BypassesDnd=" + chan.canBypassDnd()
                                + ", Sound=" + chan.getSound());
                        } else {
                            Log.w(TAG, "[DIAGNOSTICS] Channel ID=" + cid + " not initialized yet!");
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Diagnostics failed", e);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed: " + token);

        // Read the stored auth token and API URL from SharedPreferences
        android.content.SharedPreferences prefs = getSharedPreferences("zetime_prefs", android.content.Context.MODE_PRIVATE);
        String authToken = prefs.getString("auth_token", null);
        if (authToken == null || authToken.isEmpty()) {
            Log.d(TAG, "No auth token found in SharedPreferences. Skipping token refresh on server.");
            return;
        }

        String baseUrl = prefs.getString("api_url", "https://zetime-backend-dmlv.onrender.com");
        String apiUrl = baseUrl + "/api/auth/push-token";

        // Persist the new token to the backend so server-side pushes keep working
        // We do this on a background thread to avoid blocking the main thread
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL(apiUrl);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setRequestProperty("Authorization", "Bearer " + authToken);

                String jsonBody = "{\"token\":\"" + token + "\"}";
                byte[] bytes = jsonBody.getBytes("UTF-8");
                conn.getOutputStream().write(bytes);

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "FCM token refresh POST response: " + responseCode);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to save refreshed FCM token to server: " + e.getMessage());
            }
        }).start();
    }

    private android.graphics.Bitmap createInitialsBitmap(String name) {
        int size = 120;
        android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
        
        // Background circle
        android.graphics.Paint paint = new android.graphics.Paint();
        paint.setAntiAlias(true);
        paint.setColor(0xFF1a2351); // Dark blue Zetime background
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        
        // Initials text
        String[] parts = name.split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) initials.append(p.charAt(0));
            if (initials.length() >= 2) break;
        }
        String text = initials.toString().toUpperCase();
        
        paint.setColor(0xFFFFFFFF); // White text
        paint.setTextSize(48);
        paint.setTextAlign(android.graphics.Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, android.graphics.Typeface.BOLD));
        
        // Center text Vertically
        android.graphics.Rect bounds = new android.graphics.Rect();
        paint.getTextBounds(text, 0, text.length(), bounds);
        float y = (size / 2f) - bounds.exactCenterY();
        
        canvas.drawText(text, size / 2f, y, paint);
        return bitmap;
    }

    private android.graphics.Bitmap getCircleBitmap(android.graphics.Bitmap bitmap) {
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        android.graphics.Bitmap output = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);

        final int color = 0xff424242;
        final android.graphics.Paint paint = new android.graphics.Paint();
        final android.graphics.Rect rect = new android.graphics.Rect(0, 0, size, size);

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        paint.setColor(color);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, rect, rect, paint);
        return output;
    }

    private void loadAvatarAndResource(String avatarUrl, final String callerLabel, final PendingIntent declinePI, final PendingIntent answerPI, final int notifId, final NotificationCompat.Builder builder, final NotificationManager nm) {
        if (avatarUrl == null || avatarUrl.isEmpty()) return;
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL(avatarUrl);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.connect();
                java.io.InputStream input = connection.getInputStream();
                android.graphics.Bitmap myBitmap = android.graphics.BitmapFactory.decodeStream(input);
                if (myBitmap != null) {
                    android.graphics.Bitmap circularBitmap = getCircleBitmap(myBitmap);
                    
                    // Create Person with the downloaded avatar
                    Person caller = new Person.Builder()
                            .setName(callerLabel)
                            .setIcon(IconCompat.createWithBitmap(circularBitmap))
                            .setImportant(true)
                            .build();
                    
                    // Re-apply CallStyle
                    NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forIncomingCall(
                            caller, declinePI, answerPI);
                    
                    builder.setStyle(callStyle);
                    builder.setLargeIcon(circularBitmap);
                    
                    // Re-notify
                    nm.notify(notifId, builder.build());
                    Log.d(TAG, "Successfully loaded and updated notification avatar");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error downloading caller avatar: " + e.getMessage());
            }
        }).start();
    }
}
