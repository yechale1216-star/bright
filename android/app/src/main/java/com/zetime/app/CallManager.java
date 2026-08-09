package com.zetime.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Singleton CallManager handles the foreground incoming call banner.
 *
 * Responsibilities:
 *  • Play/stop the native ringtone and vibration
 *  • Inflate, animate, and manage the floating banner view on top of MainActivity
 *  • Prevent duplicate banners
 *  • Auto-dismiss after 45 seconds
 *  • Survive Activity recreation via singleton state
 */
public class CallManager {
    private static final String TAG = "CallManager";
    private static final long AUTO_DISMISS_MS = 45_000L;

    private static volatile CallManager sInstance;

    // ── Current call state ──────────────────────────────────────────────────
    private boolean isRinging = false;
    private String currentCallId;
    private String currentCallerId;
    private String currentCallerName;
    private String currentCallType;
    private String currentServerUrl;
    private String currentCallerAvatar;

    // ── Media ───────────────────────────────────────────────────────────────
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;

    // ── UI ───────────────────────────────────────────────────────────────────
    private View bannerView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable autoDismissRunnable;

    // ── Listener (CallPlugin bridges events to JS) ──────────────────────────
    public interface CallBannerListener {
        void onBannerAccept(String callId, String callerId, String callerName, String callType, String serverUrl);
        void onBannerDecline(String callId, String callerId, String serverUrl);
        void onBannerDismissed(String callId);
    }
    private CallBannerListener listener;

    private CallManager() {}

    public static CallManager getInstance() {
        if (sInstance == null) {
            synchronized (CallManager.class) {
                if (sInstance == null) {
                    sInstance = new CallManager();
                }
            }
        }
        return sInstance;
    }

    public void setListener(CallBannerListener listener) {
        this.listener = listener;
    }

    private static final int MAX_CALL_HISTORY = 50;
    private static final java.util.LinkedHashMap<String, Boolean> sProcessedCalls = 
        new java.util.LinkedHashMap<String, Boolean>(MAX_CALL_HISTORY, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(java.util.Map.Entry<String, Boolean> eldest) {
                return size() > MAX_CALL_HISTORY;
            }
        };

    public static synchronized boolean isCallDuplicate(String callId) {
        if (callId == null || callId.isEmpty()) return false;
        if (sProcessedCalls.containsKey(callId)) {
            return true;
        }
        sProcessedCalls.put(callId, true);
        return false;
    }

    public boolean isRinging() {
        return isRinging;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API: Show / Dismiss
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Show the Telegram-style floating incoming call banner on the given Activity.
     * Also starts the native ringtone and vibration.
     */
    public void showBanner(Activity activity,
                           String callerName, String callId, String callerId,
                           String callType, String serverUrl) {
        showBanner(activity, callerName, callId, callerId, callType, serverUrl, null);
    }

    public void showBanner(Activity activity,
                           String callerName, String callId, String callerId,
                           String callType, String serverUrl, String callerAvatar) {
        if (activity == null || activity.isFinishing()) return;

        // Prevent duplicates
        if (callId != null && isCallDuplicate(callId)) {
            Log.d(TAG, "Duplicate incoming call ignored in CallManager. callId=" + callId);
            return;
        }

        if (isRinging && callId != null && callId.equals(currentCallId)) {
            Log.d(TAG, "Banner already showing for callId=" + callId);
            return;
        }

        // If CallService is running in the background, stop it first to prevent duplicate ringtone
        try {
            Intent stopService = new Intent(activity, CallService.class);
            stopService.putExtra("ACTION", "STOP_CALL");
            activity.startService(stopService);
            Log.d(TAG, "Requested CallService to STOP_CALL before displaying foreground banner");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping CallService from CallManager", e);
        }

        // If another call is ringing, dismiss it first
        if (isRinging) {
            dismissBannerInternal(activity, false);
        }

        // Save state
        currentCallId     = callId;
        currentCallerId   = callerId;
        currentCallerName = callerName;
        currentCallType   = callType;
        currentServerUrl  = serverUrl;
        currentCallerAvatar = callerAvatar;
        isRinging = true;

        Log.d(TAG, "Showing foreground call banner for: " + callerName);

        mainHandler.post(() -> {
            try {
                inflateAndAttachBanner(activity);
                startRingtone(activity);
                startVibration(activity);
                scheduleAutoDismiss(activity);
            } catch (Exception e) {
                Log.e(TAG, "Failed to show banner", e);
            }
        });
    }

    /**
     * Dismiss the banner, stop ringtone & vibration.
     * Safe to call from any thread.
     */
    public void dismissBanner() {
        mainHandler.post(() -> {
            Activity activity = MainActivity.getInstance();
            dismissBannerInternal(activity, false);
        });
    }

    /**
     * Called when the remote caller cancels/hangs up before being answered.
     */
    public void handleCallCanceled() {
        mainHandler.post(() -> {
            Activity activity = MainActivity.getInstance();
            dismissBannerInternal(activity, true);
            if (activity != null) {
                Toast.makeText(activity, "Call canceled", Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Re-attach the banner if the Activity was recreated while ringing
     * (e.g. screen rotation).
     */
    public void reattachIfRinging(Activity activity) {
        if (!isRinging || activity == null) return;
        mainHandler.post(() -> {
            try {
                inflateAndAttachBanner(activity);
            } catch (Exception e) {
                Log.e(TAG, "Failed to reattach banner", e);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BANNER VIEW
    // ═══════════════════════════════════════════════════════════════════════

    private void inflateAndAttachBanner(Activity activity) {
        if (activity == null || activity.isFinishing()) return;

        // Remove existing banner if any
        removeBannerView(activity);

        ViewGroup container = activity.findViewById(android.R.id.content);
        if (container == null) return;

        bannerView = LayoutInflater.from(activity)
                .inflate(R.layout.layout_foreground_call_banner, container, false);

        // Populate views
        TextView tvInitials  = bannerView.findViewById(R.id.banner_avatar_initials);
        android.widget.ImageView imgAvatar = bannerView.findViewById(R.id.banner_avatar_image);
        TextView tvName      = bannerView.findViewById(R.id.banner_caller_name);
        TextView tvSubtitle  = bannerView.findViewById(R.id.banner_call_subtitle);
        Button   btnDecline  = bannerView.findViewById(R.id.banner_btn_decline);
        Button   btnAccept   = bannerView.findViewById(R.id.banner_btn_accept);

        String name = (currentCallerName != null && !currentCallerName.isEmpty())
                ? currentCallerName : "Unknown Caller";
        tvName.setText(name);

        // Build initials (up to 2 chars)
        String[] parts = name.split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) initials.append(p.charAt(0));
            if (initials.length() >= 2) break;
        }
        tvInitials.setText(initials.toString().toUpperCase());

        // Asynchronously load the caller avatar if URL is provided
        if (currentCallerAvatar != null && !currentCallerAvatar.isEmpty()) {
            final String avatarUrl = currentCallerAvatar;
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
                        final android.graphics.Bitmap circularBitmap = getCircleBitmap(myBitmap);
                        mainHandler.post(() -> {
                            if (imgAvatar != null && tvInitials != null) {
                                imgAvatar.setImageBitmap(circularBitmap);
                                imgAvatar.setVisibility(View.VISIBLE);
                                tvInitials.setVisibility(View.GONE);
                            }
                        });
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error downloading caller avatar: " + e.getMessage());
                }
            }).start();
        } else {
            if (imgAvatar != null) imgAvatar.setVisibility(View.GONE);
            if (tvInitials != null) tvInitials.setVisibility(View.VISIBLE);
        }

        boolean isVideo = "VIDEO".equalsIgnoreCase(currentCallType);
        tvSubtitle.setText(isVideo ? "Addis Hiwot incoming video call" : "Addis Hiwot incoming voice call");

        // Button listeners
        btnDecline.setOnClickListener(v -> {
            Log.d(TAG, "Banner: Decline pressed");
            String cid = currentCallId;
            String crid = currentCallerId;
            String surl = currentServerUrl;
            dismissBannerInternal(activity, false);
            sendDeclineToServer(activity, cid, surl);
            if (listener != null) {
                listener.onBannerDecline(cid, crid, surl);
            }
        });

        btnAccept.setOnClickListener(v -> {
            Log.d(TAG, "Banner: Accept pressed");
            String cid   = currentCallId;
            String crid  = currentCallerId;
            String cname = currentCallerName;
            String ctype = currentCallType;
            String surl  = currentServerUrl;
            dismissBannerInternal(activity, false);
            if (listener != null) {
                listener.onBannerAccept(cid, crid, cname, ctype, surl);
            }
        });

        // Set layout params: top of screen, full width
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP);

        // System status bar inset — push the banner below the status bar
        int statusBarHeight = 0;
        int resId = activity.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) {
            statusBarHeight = activity.getResources().getDimensionPixelSize(resId);
        }
        lp.topMargin = statusBarHeight;

        container.addView(bannerView, lp);

        // Slide-down entrance animation
        bannerView.setTranslationY(-1000f);
        bannerView.setAlpha(0f);
        bannerView.animate()
                .translationY(0f)
                .alpha(1f)
                .setDuration(350)
                .setInterpolator(new android.view.animation.DecelerateInterpolator(1.5f))
                .start();
    }

    private void removeBannerView(Activity activity) {
        if (bannerView != null) {
            ViewGroup parent = (ViewGroup) bannerView.getParent();
            if (parent != null) {
                parent.removeView(bannerView);
            }
            bannerView = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RINGTONE & VIBRATION
    // ═══════════════════════════════════════════════════════════════════════

    private void startRingtone(Context ctx) {
        try {
            if (mediaPlayer != null) return; // already ringing

            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(ctx, ringtoneUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_RING);
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Error starting ringtone", e);
        }
    }

    private void stopRingtone() {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.stop();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping ringtone", e);
        }
    }

    private void startVibration(Context ctx) {
        try {
            vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                long[] pattern = new long[]{0, 800, 500, 800, 500};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration", e);
        }
    }

    private void stopVibration() {
        try {
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping vibration", e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-DISMISS TIMER
    // ═══════════════════════════════════════════════════════════════════════

    private void scheduleAutoDismiss(final Activity activity) {
        cancelAutoDismiss();
        autoDismissRunnable = () -> {
            Log.d(TAG, "Auto-dismissing banner after timeout");
            dismissBannerInternal(activity, false);
            if (listener != null) {
                listener.onBannerDismissed(currentCallId);
            }
        };
        mainHandler.postDelayed(autoDismissRunnable, AUTO_DISMISS_MS);
    }

    private void cancelAutoDismiss() {
        if (autoDismissRunnable != null) {
            mainHandler.removeCallbacks(autoDismissRunnable);
            autoDismissRunnable = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL DISMISS
    // ═══════════════════════════════════════════════════════════════════════

    private void dismissBannerInternal(Activity activity, boolean wasCanceled) {
        if (!isRinging && bannerView == null) return;

        cancelAutoDismiss();
        stopRingtone();
        stopVibration();
        isRinging = false;

        if (bannerView != null && activity != null && !activity.isFinishing()) {
            // Slide-up exit animation
            bannerView.animate()
                    .translationY(-1000f)
                    .alpha(0f)
                    .setDuration(250)
                    .setListener(new AnimatorListenerAdapter() {
                        @Override
                        public void onAnimationEnd(Animator animation) {
                            removeBannerView(activity);
                        }
                    })
                    .start();
        } else {
            bannerView = null;
        }

        // Reset call state
        currentCallId     = null;
        currentCallerId   = null;
        currentCallerName = null;
        currentCallType   = null;
        currentServerUrl  = null;
        currentCallerAvatar = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SERVER COMMUNICATION
    // ═══════════════════════════════════════════════════════════════════════

    /** POST /api/calls/public-reject on a background thread */
    private void sendDeclineToServer(Context ctx, String callId, String serverUrl) {
        if (serverUrl == null || callId == null) return;
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL(serverUrl + "/api/calls/public-reject");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                String body = "{\"callId\":\"" + callId + "\"}";
                conn.getOutputStream().write(body.getBytes("utf-8"));
                Log.d(TAG, "Decline POST response: " + conn.getResponseCode());
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error sending decline", e);
            }
        }).start();
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
}
