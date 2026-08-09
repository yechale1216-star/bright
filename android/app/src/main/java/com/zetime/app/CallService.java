package com.zetime.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
import android.net.Uri;
import android.os.Build;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.zetime.app.R;

public class CallService extends Service {
    private static final String TAG = "CallService";
    // Sync channel ID, using 'v8' so Android does not reuse old cached settings
    private static final String CHANNEL_ID = "incoming_calls_v8";
    private static final int NOTIF_ID = 1002;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private AudioFocusRequest audioFocusRequest; // API 26+

    // Extras stored for building the foreground notification action buttons
    private String pendingCallerName;
    private String pendingCallerAvatar;
    private String pendingCallId;
    private String pendingCallerId;
    private String pendingCallType;
    private String pendingServerUrl;

    @Override
    public void onCreate() {
        super.onCreate();
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            // SCREEN_BRIGHT_WAKE_LOCK wakes the display when a call arrives with locked screen
            wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                    | PowerManager.ACQUIRE_CAUSES_WAKEUP
                    | PowerManager.ON_AFTER_RELEASE,
                    "Zetime:CallWakeLock"
            );
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getStringExtra("ACTION");
        if ("START_CALL".equals(action)) {
            // Stop any existing ringing first
            stopRinging();

            // Dismiss any active foreground CallManager banner to avoid UI overlap
            try {
                CallManager.getInstance().dismissBanner();
                Log.d(TAG, "Dismissed CallManager banner before starting background ringtone");
            } catch (Exception e) {
                Log.e(TAG, "Error dismissing CallManager banner", e);
            }

            pendingCallerName   = intent.getStringExtra("callerName");
            pendingCallerAvatar = intent.getStringExtra("callerAvatar");
            pendingCallId       = intent.getStringExtra("callId");
            pendingCallerId     = intent.getStringExtra("callerId");
            pendingCallType     = intent.getStringExtra("callType");
            pendingServerUrl    = intent.getStringExtra("serverUrl");

            Log.d(TAG, "Starting call ringing for: " + pendingCallerName + ", callId: " + pendingCallId);

            // Log diagnostic info to help troubleshoot HUN suppression (battery saver, notification options)
            logNotificationDiagnostics(this);

            // Show foreground notification FIRST (required within 5s on Android 12+)
            showForegroundNotification();
            // Then start ringing (acquires audio focus + wake lock)
            startRinging();

        } else if ("STOP_CALL".equals(action)) {
            Log.d(TAG, "Stopping call ringing");
            stopRinging();
            stopForeground(true);
            stopSelf();
        }
        return START_STICKY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RINGING: Audio focus → MediaPlayer → Vibrator → WakeLock
    // ─────────────────────────────────────────────────────────────────────────

    private void startRinging() {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        // 1. Request audio focus for ringtone (STREAM_RING, AUDIOFOCUS_GAIN_TRANSIENT)
        if (audioManager != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build();
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                            .setAudioAttributes(playbackAttributes)
                            .setAcceptsDelayedFocusGain(false)
                            .setOnAudioFocusChangeListener(focusChange -> {
                                Log.d(TAG, "Audio focus changed: " + focusChange);
                            })
                            .build();
                    int result = audioManager.requestAudioFocus(audioFocusRequest);
                    Log.d(TAG, "Audio focus request result: " + result);
                } else {
                    audioManager.requestAudioFocus(null,
                            AudioManager.STREAM_RING,
                            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error requesting audio focus", e);
            }
        }

        // 2. Start MediaPlayer ringtone
        try {
            if (mediaPlayer == null) {
                Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(this, ringtoneUri);

                // STREAM_RING respects the system ring volume and plays even when
                // the notification stream is muted (native phone-call behaviour)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build());
                } else {
                    //noinspection deprecation
                    mediaPlayer.setAudioStreamType(AudioManager.STREAM_RING);
                }

                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
                Log.d(TAG, "Ringtone started");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting ringtone", e);
        }

        // 3. Vibrate in phone-call pattern
        try {
            if (vibrator != null) {
                long[] pattern = new long[]{0, 1000, 600, 1000, 600};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    //noinspection deprecation
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration", e);
        }

        // 4. Acquire WakeLock to wake the screen (up to 45 s)
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(45_000L);
                Log.d(TAG, "WakeLock acquired");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring wake lock", e);
        }
    }

    private void stopRinging() {
        // 1. Stop MediaPlayer
        try {
            if (mediaPlayer != null) {
                mediaPlayer.stop();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping media player", e);
        }

        // 2. Cancel vibration
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception e) {
            Log.e(TAG, "Error stopping vibration", e);
        }

        // 3. Release WakeLock
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception e) {
            Log.e(TAG, "Error releasing wake lock", e);
        }

        // 4. Abandon audio focus so WebRTC getUserMedia() can claim the microphone
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                    audioFocusRequest = null;
                } else {
                    //noinspection deprecation
                    audioManager.abandonAudioFocus(null);
                }
                Log.d(TAG, "Audio focus released");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error abandoning audio focus", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOREGROUND NOTIFICATION (Heads-Up + full-screen intent)
    // ─────────────────────────────────────────────────────────────────────────

    private void showForegroundNotification() {
        Log.d(TAG, "Constructing Heads-Up CallStyle notification for " + pendingCallerName);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // IMPORTANCE_HIGH is required for Heads-Up Notification (HUN) on Android 8+
        // bypassDnd ensures the notification interrupts Do-Not-Disturb (like Telegram)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Incoming voice and video call alerts");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 600, 1000, 600});
            channel.setBypassDnd(true);  // Bypass Do-Not-Disturb like Telegram
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            
            // Set sound on the channel so Android allows it to show as a Heads-Up banner / pop-up
            // We use Ringtone type sound here so the system configures maximum priority for calling
            Uri ringToneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            AudioAttributes callAa = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
            channel.setSound(ringToneUri, callAa);
            
            nm.createNotificationChannel(channel);
            Log.d(TAG, "Ensured incoming call channel: " + CHANNEL_ID + " IMPORTANCE_HIGH");
        }

        // ── Full-screen intent → IncomingCallActivity (for locked screen) ──
        Intent callScreenIntent = new Intent(this, IncomingCallActivity.class);
        callScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_NO_USER_ACTION
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        callScreenIntent.putExtra("callId",        pendingCallId);
        callScreenIntent.putExtra("callerId",      pendingCallerId);
        callScreenIntent.putExtra("callerName",    pendingCallerName);
        callScreenIntent.putExtra("callerAvatar",  pendingCallerAvatar);
        callScreenIntent.putExtra("callType",      pendingCallType);
        callScreenIntent.putExtra("serverUrl",     pendingServerUrl);
        PendingIntent callScreenPI = PendingIntent.getActivity(this, 99, callScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // ── Content intent (tap notification body) → MainActivity ──
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("isIncomingCall", true);
        openIntent.putExtra("callId",         pendingCallId);
        openIntent.putExtra("callerId",       pendingCallerId);
        openIntent.putExtra("callerName",     pendingCallerName);
        openIntent.putExtra("callType",       pendingCallType);
        openIntent.putExtra("serverUrl",      pendingServerUrl);
        PendingIntent openPI = PendingIntent.getActivity(this, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // ── Answer action → MainActivity with ANSWER extra ──
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        answerIntent.putExtra("callAction",   "ANSWER");
        answerIntent.putExtra("callId",       pendingCallId);
        answerIntent.putExtra("callerId",     pendingCallerId);
        answerIntent.putExtra("callType",     pendingCallType);
        answerIntent.putExtra("callerName",   pendingCallerName);
        answerIntent.putExtra("serverUrl",    pendingServerUrl);
        PendingIntent answerPI = PendingIntent.getActivity(this, 10, answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // ── Decline action → BroadcastReceiver (no UI required) ──
        Intent declineIntent = new Intent(this, CallNotificationActionReceiver.class);
        declineIntent.setAction("ACTION_DECLINE");
        declineIntent.putExtra("callId",     pendingCallId);
        declineIntent.putExtra("serverUrl",  pendingServerUrl);
        PendingIntent declinePI = PendingIntent.getBroadcast(this, 11, declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String callerLabel   = pendingCallerName != null ? pendingCallerName : "Unknown";
        String subtitleText  = "VIDEO".equalsIgnoreCase(pendingCallType)
                ? "Addis Hiwot incoming video call" : "Addis Hiwot incoming voice call";

        // Generate fallback initials avatar
        android.graphics.Bitmap initialsBitmap = createInitialsBitmap(callerLabel);

        // Build Person for CallStyle
        Person caller = new Person.Builder()
                .setName(callerLabel)
                .setIcon(IconCompat.createWithBitmap(initialsBitmap))
                .setImportant(true)
                .build();

        // Native Android CallStyle — shows green Answer / red Decline buttons
        NotificationCompat.CallStyle callStyle =
                NotificationCompat.CallStyle.forIncomingCall(caller, declinePI, answerPI);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(callerLabel)           // caller name as title (no duplicate)
                .setContentText(subtitleText)           // branded call type as body
                .setPriority(NotificationCompat.PRIORITY_MAX)         // required for HUN
                .setCategory(NotificationCompat.CATEGORY_CALL)        // system treats as phone call
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)  // show on lock screen
                .setOngoing(true)        // can't be swiped away while ringing
                .setAutoCancel(false)
                // NOTE: Do NOT call setSilent(true) or setSound(null) here.
                // setSilent(true) suppresses the Heads-Up banner entirely, causing
                // the notification to appear only in the drawer (not at screen top).
                // The channel sound fires once to trigger the HUN pop-up; MediaPlayer
                // handles the looping ringtone independently after that.
                .setContentIntent(openPI)
                .setFullScreenIntent(callScreenPI, true)  // triggers IncomingCallActivity
                .setStyle(callStyle);

        Notification notification = builder.build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
            } else {
                startForeground(NOTIF_ID, notification);
            }
            Log.d(TAG, "startForeground executed — NOTIF_ID=" + NOTIF_ID);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground notification", e);
        }

        // Asynchronously load the real caller photo (avatar URL)
        loadAvatarAsync(pendingCallerAvatar, callerLabel, declinePI, answerPI,
                callScreenPI, openPI, callTypeLabel, subtitleText, nm);

        // Directly launch IncomingCallActivity as a fallback for devices that
        // throttle the fullScreenIntent (e.g. some Android 12+ OEM skins)
        // ONLY if the screen/device is locked.
        boolean isLocked = false;
        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                isLocked = true;
            }
            if (pm != null) {
                boolean isInteractive;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                    isInteractive = pm.isInteractive();
                } else {
                    //noinspection deprecation
                    isInteractive = pm.isScreenOn();
                }
                if (!isInteractive) {
                    isLocked = true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking screen/keyguard lock state", e);
        }

        if (isLocked) {
            try {
                Intent directIntent = new Intent(this, IncomingCallActivity.class);
                directIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_NO_USER_ACTION
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                directIntent.putExtra("callId",       pendingCallId);
                directIntent.putExtra("callerId",     pendingCallerId);
                directIntent.putExtra("callerName",   pendingCallerName);
                directIntent.putExtra("callerAvatar", pendingCallerAvatar);
                directIntent.putExtra("callType",     pendingCallType);
                directIntent.putExtra("serverUrl",    pendingServerUrl);
                startActivity(directIntent);
                Log.d(TAG, "Direct launch of IncomingCallActivity succeeded because screen/device is locked.");
            } catch (Exception e) {
                Log.w(TAG, "Direct launch of IncomingCallActivity failed (expected in some background states)", e);
            }
        } else {
            Log.d(TAG, "Device is interactive/unlocked, keeping only the popup HUN (skipping direct full-screen activity launch)");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ASYNC AVATAR LOADING
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // SYSTEM DIAGNOSTICS LOGGING FOR HUN
    // ─────────────────────────────────────────────────────────────────────────

    private void logNotificationDiagnostics(Context context) {
        try {
            androidx.core.app.NotificationManagerCompat nmc = androidx.core.app.NotificationManagerCompat.from(context);
            boolean enabled = nmc.areNotificationsEnabled();
            Log.d(TAG, "[DIAGNOSTICS] System-level notifications enabled: " + enabled);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    NotificationChannel chan = nm.getNotificationChannel(CHANNEL_ID);
                    if (chan != null) {
                        Log.d(TAG, "[DIAGNOSTICS] Call Channel ID=" + chan.getId()
                            + ", Name=" + chan.getName()
                            + ", Importance=" + chan.getImportance()
                            + ", DndBypass=" + chan.canBypassDnd()
                            + ", SoundUri=" + chan.getSound());
                    } else {
                        Log.w(TAG, "[DIAGNOSTICS] Call Channel ID=" + CHANNEL_ID + " does not exist yet!");
                    }
                }
            }

            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                boolean isIgnoring = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    isIgnoring = pm.isIgnoringBatteryOptimizations(context.getPackageName());
                }
                Log.d(TAG, "[DIAGNOSTICS] ignoringBatteryOptimizations=" + isIgnoring);
                Log.d(TAG, "[DIAGNOSTICS] isPowerSaveMode=" + (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && pm.isPowerSaveMode()));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error logging notification diagnostics", e);
        }
    }

    private void loadAvatarAsync(String avatarUrl, String callerLabel,
                                  PendingIntent declinePI, PendingIntent answerPI,
                                  PendingIntent callScreenPI, PendingIntent openPI,
                                  String callTypeLabel, String subtitleText,
                                  NotificationManager nm) {
        if (avatarUrl == null || avatarUrl.isEmpty()) return;
        new Thread(() -> {
            try {
                Log.d(TAG, "Downloading caller avatar: " + avatarUrl);
                java.net.URL url2 = new java.net.URL(avatarUrl);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url2.openConnection();
                connection.setDoInput(true);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.connect();
                java.io.InputStream input = connection.getInputStream();
                android.graphics.Bitmap myBitmap = android.graphics.BitmapFactory.decodeStream(input);
                if (myBitmap != null) {
                    android.graphics.Bitmap circularBitmap = getCircleBitmap(myBitmap);

                    Person updatedCaller = new Person.Builder()
                            .setName(callerLabel)
                            .setIcon(IconCompat.createWithBitmap(circularBitmap))
                            .setImportant(true)
                            .build();

                    NotificationCompat.CallStyle updatedStyle =
                            NotificationCompat.CallStyle.forIncomingCall(updatedCaller, declinePI, answerPI);

                    NotificationCompat.Builder updatedBuilder =
                            new NotificationCompat.Builder(this, CHANNEL_ID)
                                    .setSmallIcon(R.mipmap.ic_launcher)
                                    .setContentTitle("Incoming " + callTypeLabel + " Call")
                                    .setContentText(callerLabel)
                                    .setSubText(subtitleText)
                                    .setLargeIcon(circularBitmap)
                                    .setPriority(NotificationCompat.PRIORITY_MAX)
                                    .setCategory(NotificationCompat.CATEGORY_CALL)
                                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                                    .setOngoing(true)
                                    .setAutoCancel(false)
                                    // Keep alerting flags intact on avatar update —
                                    // no setSilent / setSound(null) so HUN stays visible
                                    .setContentIntent(openPI)
                                    .setFullScreenIntent(callScreenPI, true)
                                    .setStyle(updatedStyle);

                    nm.notify(NOTIF_ID, updatedBuilder.build());
                    Log.d(TAG, "Caller photo loaded — notification updated");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error downloading caller avatar: " + e.getMessage());
            }
        }).start();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BITMAP HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private android.graphics.Bitmap createInitialsBitmap(String name) {
        int size = 160;
        android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(
                size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);

        android.graphics.Paint paint = new android.graphics.Paint();
        paint.setAntiAlias(true);
        paint.setColor(0xFF1a2351); // Zetime dark-blue
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);

        String[] parts = name.split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) initials.append(p.charAt(0));
            if (initials.length() >= 2) break;
        }
        String text = initials.toString().toUpperCase();

        paint.setColor(0xFFFFFFFF);
        paint.setTextSize(60);
        paint.setTextAlign(android.graphics.Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.create(
                android.graphics.Typeface.SANS_SERIF, android.graphics.Typeface.BOLD));

        android.graphics.Rect bounds = new android.graphics.Rect();
        paint.getTextBounds(text, 0, text.length(), bounds);
        float y = (size / 2f) - bounds.exactCenterY();
        canvas.drawText(text, size / 2f, y, paint);
        return bitmap;
    }

    private android.graphics.Bitmap getCircleBitmap(android.graphics.Bitmap bitmap) {
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        android.graphics.Bitmap output = android.graphics.Bitmap.createBitmap(
                size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);

        final android.graphics.Paint paint = new android.graphics.Paint();
        final android.graphics.Rect rect = new android.graphics.Rect(0, 0, size, size);

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        paint.setColor(0xff424242);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(
                android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, rect, rect, paint);
        return output;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopRinging();
        super.onDestroy();
    }
}
