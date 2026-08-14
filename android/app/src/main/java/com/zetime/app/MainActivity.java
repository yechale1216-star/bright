package com.zetime.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.media.RingtoneManager;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isAppInForeground = false;
    private static MainActivity instance = null;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        SplashScreen.installSplashScreen(this);
        registerPlugin(CallPlugin.class);
        super.onCreate(savedInstanceState);

        // Pre-create notification channels with high priorities and bypass features
        // so that OS cannot create them with default importance values on background pushes.
        createNotificationChannels();

        // Turn screen on and show over lock screen — apply BOTH the API calls (O_MR1+)
        // AND the legacy window flags because many OEM Androids (Samsung, Xiaomi) still
        // check the flags even on API 27+.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        // Configure WebView settings to prevent ANR on cold start.
        // The large Next.js static bundle can block the main thread if the WebView
        // has to parse all JS assets from disk every launch without a cache.
        try {
            if (bridge != null && bridge.getWebView() != null) {
                android.webkit.WebSettings settings = bridge.getWebView().getSettings();
                // Allow media to play immediately on call answer (no user gesture required)
                settings.setMediaPlaybackRequiresUserGesture(false);
                // Persist DOM storage (localStorage) across restarts
                settings.setDomStorageEnabled(true);
                // Use default cache mode to respect HTTP headers and avoid stale API responses
                settings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
                // Enable database storage for offline capability
                settings.setDatabaseEnabled(true);
                // Enable Geolocation for attendance tracking GPS verification
                settings.setGeolocationEnabled(true);
                android.util.Log.d("MainActivity", "WebView performance settings applied (cache, DOM storage, media, geolocation)");
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Error configuring WebView settings", e);
        }
        
        handleIntent(getIntent());
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
        CallManager.getInstance().reattachIfRinging(this);
    }

    @Override
    public void onStart() {
        super.onStart();
        isAppInForeground = true;
    }

    @Override
    public void onStop() {
        super.onStop();
        isAppInForeground = false;
    }

    private void dismissKeyguard() {
        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(android.content.Context.KEYGUARD_SERVICE);
            if (km != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    km.requestDismissKeyguard(this, null);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Error dismissing keyguard", e);
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        
        // Force display over lock screen and wake screen up on new intent (e.g. call accepted)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        
        dismissKeyguard();

        handleIntent(intent);
    }

    public void postForegroundNotification(com.getcapacitor.JSObject data) {
        CallPlugin plugin = (CallPlugin) bridge.getPlugin("CallPlugin").getInstance();
        if (plugin != null) {
            plugin.notifyForegroundNotification(data);
        }
    }

    /**
     * Saves the JWT auth token to SharedPreferences so onNewToken in
     * MyFirebaseMessagingService can include it when syncing refreshed FCM tokens.
     * Called from the Capacitor JS layer via a window message evaluated on the bridge.
     */
    public static void saveAuthTokenToPrefs(android.content.Context ctx, String token) {
        android.content.SharedPreferences prefs = ctx.getSharedPreferences("zetime_prefs", android.content.Context.MODE_PRIVATE);
        prefs.edit().putString("auth_token", token).apply();
        android.util.Log.d("MainActivity", "Auth token persisted to SharedPreferences");
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        // Support both key names:
        //   "notifType"  → set by our MyFirebaseMessagingService when app was in background (custom notification)
        //   "type"       → set by Google Play Services FCM tap when app was killed / screen locked
        String notifType = intent.getStringExtra("notifType");
        if (notifType == null || notifType.isEmpty()) {
            notifType = intent.getStringExtra("type");
        }

        // Support both conversationId key names for the same reason
        String conversationId = intent.getStringExtra("openConversationId");
        if (conversationId == null || conversationId.isEmpty()) {
            conversationId = intent.getStringExtra("conversationId");
        }

        // Support isIncomingCall from both native Java (boolean extra) and FCM data (string "true")
        boolean isIncomingCall = intent.getBooleanExtra("isIncomingCall", false)
                || "true".equals(intent.getStringExtra("isIncomingCall"));

        if (notifType != null && !notifType.isEmpty() && !"incoming_call".equals(notifType)) {
            com.getcapacitor.JSObject routeObj = new com.getcapacitor.JSObject();
            routeObj.put("action", "NAVIGATE");
            routeObj.put("type", notifType);
            routeObj.put("route", intent.getStringExtra("route"));
            routeObj.put("conversationId", conversationId);
            routeObj.put("studentId", intent.getStringExtra("studentId"));
            routeObj.put("schoolId", intent.getStringExtra("schoolId"));

            CallPlugin.setPendingCall(routeObj);

            if (bridge != null) {
                com.getcapacitor.PluginHandle handle = bridge.getPlugin("CallPlugin");
                if (handle != null) {
                    CallPlugin plugin = (CallPlugin) handle.getInstance();
                    if (plugin != null) {
                        plugin.handleNavigationAction(routeObj);
                    }
                }
            }
        } else if (intent.hasExtra("callAction")) {
            dismissKeyguard();
            String action = intent.getStringExtra("callAction");
            String callId = intent.getStringExtra("callId");
            String callerId = intent.getStringExtra("callerId");
            String callType = intent.getStringExtra("callType");
            String callerName = intent.getStringExtra("callerName");
            String serverUrl = intent.getStringExtra("serverUrl");

            android.util.Log.d("MainActivity", "[handleIntent] callAction=" + action
                    + " callId=" + callId + " callerId=" + callerId
                    + " callType=" + callType + " callerName=" + callerName);

            // Stop native ringing state and clean up notification views
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(1001);
                    nm.cancel(1002);
                }
                Intent stopService = new Intent(this, CallService.class);
                stopService.putExtra("ACTION", "STOP_CALL");
                startService(stopService);
                android.util.Log.d("MainActivity", "Successfully requested CallService to STOP_CALL ringing");
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "Error dismissing call notification or stopping CallService", e);
            }

            com.getcapacitor.JSObject callObj = new com.getcapacitor.JSObject();
            callObj.put("action", action);
            callObj.put("callId", callId);
            callObj.put("callerId", callerId);
            callObj.put("callType", callType);
            if (callerName != null) callObj.put("callerName", callerName);
            if (serverUrl != null) callObj.put("serverUrl", serverUrl);

            // Always persist as pending so JS can retrieve it after WebView loads
            CallPlugin.setPendingCall(callObj);

            if (bridge != null) {
                com.getcapacitor.PluginHandle handle = bridge.getPlugin("CallPlugin");
                if (handle != null) {
                    CallPlugin plugin = (CallPlugin) handle.getInstance();
                    if (plugin != null) {
                        // ⚡ Use handleIncomingCall (notifyListeners) so the FULL payload
                        //    (callerId, callType, callerName) reaches JS — not just the
                        //    stripped (action, callId) from handleCallAction.
                        android.util.Log.d("MainActivity", "[handleIntent] Dispatching full call object to JS: " + callObj);
                        plugin.handleIncomingCall(callObj);
                    }
                }
            }
        } else if (isIncomingCall || "incoming_call".equals(notifType)) {
            dismissKeyguard();
            String callId    = intent.getStringExtra("callId");
            String callerId  = intent.getStringExtra("callerId");
            String callerName = intent.getStringExtra("callerName");
            String callType  = intent.getStringExtra("callType");
            String serverUrl = intent.getStringExtra("serverUrl");

            com.getcapacitor.JSObject callObj = new com.getcapacitor.JSObject();
            callObj.put("action", "INCOMING_CALL");
            callObj.put("callId", callId);
            callObj.put("callerId", callerId);
            callObj.put("callerName", callerName);
            callObj.put("callType", callType);
            if (serverUrl != null) callObj.put("serverUrl", serverUrl);

            CallPlugin.setPendingCall(callObj);

            if (bridge != null) {
                com.getcapacitor.PluginHandle handle = bridge.getPlugin("CallPlugin");
                if (handle != null) {
                    CallPlugin plugin = (CallPlugin) handle.getInstance();
                    if (plugin != null) {
                        plugin.handleIncomingCall(callObj);
                    }
                }
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // 1. Calls Channel (incoming_calls_v8)
            NotificationChannel callCh = new NotificationChannel(
                    "incoming_calls_v8", "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
            callCh.setDescription("Incoming voice and video call notifications");
            callCh.enableVibration(true);
            callCh.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            callCh.setBypassDnd(true);
            callCh.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            AudioAttributes callAa = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
            callCh.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), callAa);
            nm.createNotificationChannel(callCh);

            // 2. High Priority Channel (high_priority_v8)
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification);
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

            NotificationChannel highCh = new NotificationChannel(
                    "high_priority_v8", "High Priority Alert", NotificationManager.IMPORTANCE_HIGH);
            highCh.setDescription("Voice/video calls, chat messages, and security alerts.");
            highCh.enableVibration(true);
            highCh.setVibrationPattern(new long[]{0, 250, 150, 250});
            highCh.setShowBadge(true);
            highCh.setBypassDnd(true);
            highCh.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            highCh.setSound(soundUri, aa);
            nm.createNotificationChannel(highCh);

            // 3. Default Channel
            NotificationChannel defaultCh = new NotificationChannel(
                    "default_priority_v8", "Default Notification", NotificationManager.IMPORTANCE_DEFAULT);
            defaultCh.setDescription("Attendance alerts and announcements.");
            defaultCh.enableVibration(true);
            defaultCh.setVibrationPattern(new long[]{0, 200, 100, 200});
            defaultCh.setShowBadge(true);
            defaultCh.setSound(soundUri, aa);
            nm.createNotificationChannel(defaultCh);

            // 4. Low Channel
            NotificationChannel lowCh = new NotificationChannel(
                    "low_priority_v8", "Low Priority Update", NotificationManager.IMPORTANCE_LOW);
            lowCh.setDescription("System updates and minor alerts.");
            lowCh.enableVibration(false);
            lowCh.setShowBadge(true);
            lowCh.setSound(null, null);
            nm.createNotificationChannel(lowCh);

            android.util.Log.d("MainActivity", "Notification channels initialized successfully on startup");
        }
    }
}
