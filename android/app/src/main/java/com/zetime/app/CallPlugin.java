package com.zetime.app;

import android.app.Activity;
import android.content.Intent;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
import android.media.AudioFocusRequest;
import android.media.AudioAttributes;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.Manifest;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "CallPlugin",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        ),
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        ),
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        )
    }
)
public class CallPlugin extends Plugin implements CallManager.CallBannerListener {
    private static final String TAG = "CallPlugin";
    private static com.getcapacitor.JSObject pendingCall = null;

    public static void setPendingCall(com.getcapacitor.JSObject call) {
        pendingCall = call;
    }

    @Override
    public void load() {
        super.load();
        // Register this plugin as the banner listener so Accept/Decline fire JS events
        CallManager.getInstance().setListener(this);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CallManager.CallBannerListener callbacks
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    public void onBannerAccept(String callId, String callerId, String callerName, String callType, String serverUrl) {
        Log.d(TAG, "Banner ACCEPT -> firing JS ANSWER event for callId=" + callId);
        JSObject ret = new JSObject();
        ret.put("action", "ANSWER");
        ret.put("callId", callId);
        ret.put("callerId", callerId);
        ret.put("callerName", callerName);
        ret.put("callType", callType);
        ret.put("serverUrl", serverUrl);
        notifyListeners("onCallAction", ret);
    }

    @Override
    public void onBannerDecline(String callId, String callerId, String serverUrl) {
        Log.d(TAG, "Banner DECLINE -> firing JS DECLINE event for callId=" + callId);
        JSObject ret = new JSObject();
        ret.put("action", "DECLINE");
        ret.put("callId", callId);
        ret.put("callerId", callerId);
        ret.put("serverUrl", serverUrl);
        notifyListeners("onCallAction", ret);
    }

    @Override
    public void onBannerDismissed(String callId) {
        Log.d(TAG, "Banner auto-dismissed for callId=" + callId);
        JSObject ret = new JSObject();
        ret.put("action", "DECLINE");
        ret.put("callId", callId);
        notifyListeners("onCallAction", ret);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Plugin Methods (JS bridge)
    // ═══════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void getPendingCall(PluginCall call) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        if (pendingCall != null) {
            ret.put("hasPending", true);
            ret.put("action", pendingCall.getString("action"));
            ret.put("type", pendingCall.getString("type"));
            ret.put("route", pendingCall.getString("route"));
            ret.put("conversationId", pendingCall.getString("conversationId"));
            ret.put("studentId", pendingCall.getString("studentId"));
            ret.put("schoolId", pendingCall.getString("schoolId"));

            // For backward compatibility on existing call receiver:
            ret.put("callId", pendingCall.getString("callId"));
            ret.put("callerId", pendingCall.getString("callerId"));
            ret.put("callerName", pendingCall.getString("callerName"));
            ret.put("callType", pendingCall.getString("callType"));

            pendingCall = null;
        } else {
            ret.put("hasPending", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        // Dismiss the foreground banner if showing
        CallManager.getInstance().dismissBanner();

        // Also stop the background CallService
        Intent intent = new Intent(getContext(), CallService.class);
        intent.putExtra("ACTION", "STOP_CALL");
        getContext().startService(intent);
        call.resolve();
    }

    /**
     * Start the background CallService (full-screen IncomingCallActivity).
     * Used for background/locked screen calls.
     */
    @PluginMethod
    public void startRinging(PluginCall call) {
        String callerName = call.getString("callerName", "Unknown");
        String callerAvatar = call.getString("callerAvatar", "");
        String callId      = call.getString("callId");
        String callerId    = call.getString("callerId");
        String callType    = call.getString("callType");
        String serverUrl   = call.getString("serverUrl");

        Intent intent = new Intent(getContext(), CallService.class);
        intent.putExtra("ACTION", "START_CALL");
        intent.putExtra("callerName", callerName);
        intent.putExtra("callerAvatar", callerAvatar);
        intent.putExtra("callId", callId);
        intent.putExtra("callerId", callerId);
        intent.putExtra("callType", callType);
        intent.putExtra("serverUrl", serverUrl);

        getContext().startService(intent);
        call.resolve();
    }

    /**
     * Show the Telegram-style floating banner over the current Activity.
     * Used for foreground incoming calls — does NOT open a separate Activity.
     */
    @PluginMethod
    public void showCallBanner(PluginCall call) {
        String callerName = call.getString("callerName", "Unknown");
        String callId      = call.getString("callId");
        String callerId    = call.getString("callerId");
        String callType    = call.getString("callType");
        String serverUrl   = call.getString("serverUrl");
        String callerAvatar = call.getString("callerAvatar", "");

        Activity activity = getActivity();
        CallManager.getInstance().showBanner(activity, callerName, callId, callerId, callType, serverUrl, callerAvatar);
        call.resolve();
    }

    /**
     * Dismiss the floating banner if currently showing.
     */
    @PluginMethod
    public void dismissCallBanner(PluginCall call) {
        CallManager.getInstance().dismissBanner();
        call.resolve();
    }

    @PluginMethod
    public void saveAuthToken(PluginCall call) {
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");
        if (token != null) {
            MainActivity.saveAuthTokenToPrefs(getContext(), token);
        }
        if (apiUrl != null) {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("zetime_prefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putString("api_url", apiUrl).apply();
            android.util.Log.d("CallPlugin", "API URL persisted to SharedPreferences: " + apiUrl);
        }
        call.resolve();
    }

    /**
     * Deletes the FCM registration token from Firebase so this device will
     * no longer receive push notifications or incoming call wakeups after sign-out.
     * The server already clears pushToken in the DB via the /logout endpoint;
     * this is the device-side cleanup that prevents stale tokens from being
     * re-used if Firebase re-delivers a cached message.
     */
    @PluginMethod
    public void deregisterFcmToken(PluginCall call) {
        new Thread(() -> {
            try {
                com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken();
                // Also wipe the stored auth token so onNewToken() won't re-register
                MainActivity.saveAuthTokenToPrefs(getContext(), "");
                android.util.Log.d("CallPlugin", "FCM token deleted — device fully deregistered");
                call.resolve();
            } catch (Exception e) {
                android.util.Log.w("CallPlugin", "Failed to delete FCM token: " + e.getMessage());
                // Resolve anyway — server-side cleanup is the primary protection
                call.resolve();
            }
        }).start();
    }


    /**
     * Switch Android audio routing into VoIP/communication mode.
     * This activates the hardware Acoustic Echo Canceler (AEC) and Noise
     * Suppressor (NS) at the driver level — the primary fix for echo and
     * background noise during WebRTC calls.  Call this when the call connects.
     * Accepts optional param: speakerphone (boolean, default false for earpiece).
     */
    // Holds the active AudioFocusRequest so we can abandon it correctly (API 26+)
    private AudioFocusRequest callAudioFocusRequest;

    /**
     * Switch Android audio into VoIP/communication mode.
     *
     * This enables hardware Acoustic Echo Cancellation (AEC), Noise Suppression (NS),
     * and Automatic Gain Control (AGC) at the driver level — the primary fix for
     * echo and background noise disruption during WebRTC calls.
     *
     * Also requests AUDIOFOCUS_GAIN so the system routes audio exclusively to this
     * session (prevents other apps from interfering with the mic or speaker).
     *
     * Call this when the call transitions to CONNECTED state.
     */
    @PluginMethod
    public void setAudioModeInCall(PluginCall call) {
        try {
            boolean useSpeaker = Boolean.TRUE.equals(call.getBoolean("speakerphone", false));
            android.media.AudioManager am =
                (android.media.AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (am != null) {
                // 1. Set MODE_IN_COMMUNICATION — activates hardware AEC/NS/AGC
                am.setMode(android.media.AudioManager.MODE_IN_COMMUNICATION);
                am.setMicrophoneMute(false);
                am.setSpeakerphoneOn(useSpeaker);

                // 2. Request exclusive audio focus for VoIP
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes voipAttrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                    callAudioFocusRequest = new AudioFocusRequest.Builder(
                            android.media.AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(voipAttrs)
                            .setAcceptsDelayedFocusGain(false)
                            .setOnAudioFocusChangeListener(focusChange ->
                                    Log.d(TAG, "Audio focus changed during call: " + focusChange))
                            .build();
                    int result = am.requestAudioFocus(callAudioFocusRequest);
                    Log.d(TAG, "Audio focus result (call): " + result);
                } else {
                    am.requestAudioFocus(null,
                            android.media.AudioManager.STREAM_VOICE_CALL,
                            android.media.AudioManager.AUDIOFOCUS_GAIN);
                }

                Log.d(TAG, "Audio: MODE_IN_COMMUNICATION, speakerphone=" + useSpeaker);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "setAudioModeInCall failed", e);
            call.reject(e.getMessage());
        }
    }

    /**
     * Check if device location services (GPS) are turned on at the system level.
     */
    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        try {
            android.location.LocationManager lm = (android.location.LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
            boolean gpsEnabled = false;
            boolean networkEnabled = false;
            if (lm != null) {
                try { gpsEnabled = lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
                try { networkEnabled = lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
            }
            JSObject ret = new JSObject();
            ret.put("enabled", gpsEnabled || networkEnabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check location services: " + e.getMessage());
        }
    }

    /**
     * Open App System Details Settings screen (useful when permission is permanently denied).
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            android.net.Uri uri = android.net.Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open app settings: " + e.getMessage());
        }
    }

    /**
     * Open Device Location Source Settings screen (useful when GPS is turned off).
     */
    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open location settings: " + e.getMessage());
        }
    }

    /**
     * Restore normal audio routing after a call ends.
     * Abandons audio focus and resets AudioManager mode so other apps (music,
     * video) regain normal audio behaviour.
     */
    @PluginMethod
    public void setAudioModeNormal(PluginCall call) {
        try {
            android.media.AudioManager am =
                (android.media.AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (am != null) {
                am.setSpeakerphoneOn(false);
                am.setMode(android.media.AudioManager.MODE_NORMAL);

                // Abandon audio focus so music/video apps can resume
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && callAudioFocusRequest != null) {
                    am.abandonAudioFocusRequest(callAudioFocusRequest);
                    callAudioFocusRequest = null;
                } else {
                    am.abandonAudioFocus(null);
                }
                Log.d(TAG, "Audio: MODE_NORMAL restored, focus released");
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "setAudioModeNormal failed", e);
            call.reject(e.getMessage());
        }
    }

    /**
     * Toggle speakerphone on/off during an active call.
     */
    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        try {
            boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            android.media.AudioManager am =
                (android.media.AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (am != null) {
                am.setSpeakerphoneOn(on);
                Log.d(TAG, "Speakerphone set to: " + on);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "setSpeakerphone failed", e);
            call.reject(e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Internal action dispatchers (called from Java, not from JS)
    // ═══════════════════════════════════════════════════════════════════════

    public void handleCallAction(String action, String payload) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("action", action);
        if ("OPEN_CHAT".equals(action)) {
            ret.put("conversationId", payload);
        } else {
            ret.put("callId", payload);
        }
        notifyListeners("onCallAction", ret);
    }

    public void handleNavigationAction(com.getcapacitor.JSObject routeObj) {
        notifyListeners("onCallAction", routeObj);
    }

    public void notifyForegroundNotification(com.getcapacitor.JSObject notifData) {
        notifyListeners("onForegroundNotification", notifData);
    }

    public void handleIncomingCall(com.getcapacitor.JSObject callObj) {
        notifyListeners("onCallAction", callObj);
    }
}
