package com.zetime.app;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import android.util.Log;

/**
 * IncomingCallActivity — native full-screen incoming call shown over the lock screen.
 *
 * Displayed immediately when:
 *   • The device is locked and a call FCM arrives (via fullScreenIntent in CallService)
 *   • CallService calls startActivity() directly as a fallback
 *
 * Design: Telegram-style — blur/dark background, avatar with pulse rings,
 * large Decline (red) and Accept (green) buttons.
 *
 * On Accept → opens MainActivity with callAction=ANSWER
 * On Decline → POSTs /api/calls/public-reject and finishes
 */
public class IncomingCallActivity extends Activity {

    private static final String TAG = "IncomingCallActivity";

    private String callId;
    private String callerId;
    private String callerName;
    private String callerAvatar;
    private String callType;
    private String serverUrl;

    private View        pulseRing1;
    private View        pulseRing2;
    private ImageView   imgAvatar;
    private TextView    tvInitials;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // ─────────────────────────────────────────────────────────────────────────
    // onCreate
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen WITHOUT dismissing the keyguard.
        // FLAG_DISMISS_KEYGUARD causes the OS to show the PIN prompt on secure
        // devices, blocking the call UI. Using FLAG_SHOW_WHEN_LOCKED renders
        // the activity OVER the keyguard (Telegram-style).
        applyLockScreenFlags();

        // Immersive full-screen
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        setContentView(R.layout.activity_incoming_call);

        // Read intent extras
        bindIntentExtras(getIntent());

        Log.d(TAG, "Incoming call from: " + callerName + " (" + callType + ")");

        // Bind + populate views
        setupViews();

        // Async load avatar photo
        loadCallerAvatar();

        // Start avatar pulse
        startPulseAnimation();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // onNewIntent — handle re-delivery (singleInstance)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyLockScreenFlags();

        bindIntentExtras(intent);
        Log.d(TAG, "IncomingCallActivity: new intent for call from " + callerName);

        // Refresh displayed caller info
        if (tvInitials != null) tvInitials.setText(buildInitials(callerName));
        TextView tvCallerName = findViewById(R.id.tv_caller_name);
        if (tvCallerName != null) tvCallerName.setText(callerName);
        TextView tvCallType   = findViewById(R.id.tv_call_type);
        if (tvCallType != null) {
            boolean isVideo = "VIDEO".equalsIgnoreCase(callType);
            tvCallType.setText(isVideo ? "Addis Hiwot incoming video call" : "Addis Hiwot incoming voice call");
        }
        loadCallerAvatar();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private void applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );
    }

    private void bindIntentExtras(Intent intent) {
        callId      = intent.getStringExtra("callId");
        callerId    = intent.getStringExtra("callerId");
        callerName  = intent.getStringExtra("callerName");
        callerAvatar = intent.getStringExtra("callerAvatar");
        callType    = intent.getStringExtra("callType");
        serverUrl   = intent.getStringExtra("serverUrl");

        if (callerName == null || callerName.isEmpty()) callerName = "Unknown Caller";
    }

    private void setupViews() {
        TextView tvCallType   = findViewById(R.id.tv_call_type);
        TextView tvCallerName = findViewById(R.id.tv_caller_name);
        tvInitials            = findViewById(R.id.tv_avatar_initials);
        imgAvatar             = findViewById(R.id.iv_avatar_photo); // optional ImageView for real photo
        Button   btnAccept    = findViewById(R.id.btn_accept);
        Button   btnDecline   = findViewById(R.id.btn_decline);
        Button   btnMessage   = findViewById(R.id.btn_message);
        pulseRing1 = findViewById(R.id.pulse_ring_1);
        pulseRing2 = findViewById(R.id.pulse_ring_2);

        tvCallerName.setText(callerName);
        tvInitials.setText(buildInitials(callerName));

        boolean isVideo = "VIDEO".equalsIgnoreCase(callType);
        tvCallType.setText(isVideo ? "Addis Hiwot incoming video call" : "Addis Hiwot incoming voice call");

        // ── Accept ──────────────────────────────────────────────────────────
        btnAccept.setOnClickListener(v -> {
            Log.d(TAG, "User tapped Accept");
            stopCallServiceRinging();
            cancelCallNotification();

            Intent open = new Intent(this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            open.putExtra("callAction",  "ANSWER");
            open.putExtra("callId",      callId);
            open.putExtra("callerId",    callerId);
            open.putExtra("callerName",  callerName);
            open.putExtra("callType",    callType);
            open.putExtra("serverUrl",   serverUrl);
            startActivity(open);
            finish();
        });

        // ── Decline ─────────────────────────────────────────────────────────
        btnDecline.setOnClickListener(v -> {
            Log.d(TAG, "User tapped Decline");
            stopCallServiceRinging();
            cancelCallNotification();
            sendDeclineToServer(null);
            finish();
        });

        // ── Message actions ──────────────────────────────────────────────────
        if (btnMessage != null) {
            btnMessage.setOnClickListener(v -> {
                Log.d(TAG, "User tapped Message");
                showMessageActionsDialog();
            });
        }
    }

    private String buildInitials(String name) {
        if (name == null || name.isEmpty()) return "?";
        String[] parts = name.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) sb.append(p.charAt(0));
            if (sb.length() >= 2) break;
        }
        return sb.toString().toUpperCase();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ASYNC AVATAR LOADING
    // ─────────────────────────────────────────────────────────────────────────

    private void loadCallerAvatar() {
        if (callerAvatar == null || callerAvatar.isEmpty()) return;
        final String url = callerAvatar;
        new Thread(() -> {
            try {
                java.net.URL netUrl = new java.net.URL(url);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) netUrl.openConnection();
                conn.setDoInput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.connect();
                java.io.InputStream input = conn.getInputStream();
                android.graphics.Bitmap raw = android.graphics.BitmapFactory.decodeStream(input);
                if (raw != null) {
                    android.graphics.Bitmap circular = makeCircular(raw);
                    mainHandler.post(() -> {
                        if (imgAvatar != null && tvInitials != null && !isFinishing()) {
                            imgAvatar.setImageBitmap(circular);
                            imgAvatar.setVisibility(View.VISIBLE);
                            tvInitials.setVisibility(View.GONE);
                        }
                    });
                }
            } catch (Exception e) {
                Log.e(TAG, "Avatar load failed: " + e.getMessage());
            }
        }).start();
    }

    private android.graphics.Bitmap makeCircular(android.graphics.Bitmap src) {
        int size = Math.min(src.getWidth(), src.getHeight());
        android.graphics.Bitmap out = android.graphics.Bitmap.createBitmap(
                size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(out);
        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        android.graphics.Rect r = new android.graphics.Rect(0, 0, size, size);
        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(
                android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(src, r, r, paint);
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PULSE ANIMATION
    // ─────────────────────────────────────────────────────────────────────────

    private void startPulseAnimation() {
        if (pulseRing1 == null || pulseRing2 == null) return;
        animateRing(pulseRing1, 0);
        animateRing(pulseRing2, 900);
    }

    private void animateRing(View ring, long startDelay) {
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(ring, View.SCALE_X, 1f, 2.2f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(ring, View.SCALE_Y, 1f, 2.2f);
        ObjectAnimator alpha  = ObjectAnimator.ofFloat(ring, View.ALPHA,  0.6f, 0f);

        AnimatorSet set = new AnimatorSet();
        set.playTogether(scaleX, scaleY, alpha);
        set.setDuration(2400);
        set.setStartDelay(startDelay);
        set.setInterpolator(new AccelerateDecelerateInterpolator());
        set.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                if (!isFinishing()) {
                    ring.setScaleX(1f);
                    ring.setScaleY(1f);
                    ring.setAlpha(0.6f);
                    set.setStartDelay(0);
                    set.start();
                }
            }
        });
        set.start();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RINGING CLEANUP
    // ─────────────────────────────────────────────────────────────────────────

    private void stopCallServiceRinging() {
        try {
            Intent stop = new Intent(this, CallService.class);
            stop.putExtra("ACTION", "STOP_CALL");
            startService(stop);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop CallService", e);
        }
    }

    private void cancelCallNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(1001);
                nm.cancel(1002);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel notification", e);
        }
    }

    private void sendDeclineToServer(final String messageText) {
        if (serverUrl == null || callId == null) return;
        final String fCallId    = callId;
        final String fServerUrl = serverUrl;
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL(fServerUrl + "/api/calls/public-reject");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                
                String body;
                if (messageText != null && !messageText.trim().isEmpty()) {
                    String escapedMsg = messageText.replace("\"", "\\\"");
                    body = "{\"callId\":\"" + fCallId + "\",\"message\":\"" + escapedMsg + "\"}";
                } else {
                    body = "{\"callId\":\"" + fCallId + "\"}";
                }
                
                conn.getOutputStream().write(body.getBytes("utf-8"));
                Log.d(TAG, "Decline POST response: " + conn.getResponseCode());
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error sending decline", e);
            }
        }).start();
    }

    private void showMessageActionsDialog() {
        final String[] options = {
            "Can't talk now. What's up?",
            "I'll call you right back.",
            "I'll call you later.",
            "Can you call me later?",
            "Write custom message..."
        };

        AlertDialog.Builder builder = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert);
        builder.setTitle("Reply with Message");
        builder.setItems(options, (dialog, which) -> {
            if (which == options.length - 1) {
                showCustomMessageDialog();
            } else {
                String msg = options[which];
                declineWithQuickReply(msg);
            }
        });
        builder.setNegativeButton("Cancel", null);
        
        AlertDialog dialog = builder.create();
        // Since this activity is shown when locked, ensure the dialog's window inherits proper lock screen properties
        if (dialog.getWindow() != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
            }
            dialog.getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        dialog.show();
    }

    private void showCustomMessageDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert);
        builder.setTitle("Custom Message");
        
        final EditText input = new EditText(this);
        input.setHint("Type your message here...");
        input.setTextColor(Color.WHITE);
        
        int paddingPx = (int) (16 * getResources().getDisplayMetrics().density);
        FrameLayout container = new FrameLayout(this);
        container.setPadding(paddingPx, paddingPx, paddingPx, paddingPx);
        container.addView(input);
        
        builder.setView(container);
        builder.setPositiveButton("Send", (dialog, which) -> {
            String msg = input.getText().toString().trim();
            if (!msg.isEmpty()) {
                declineWithQuickReply(msg);
            }
        });
        builder.setNegativeButton("Cancel", null);
        
        AlertDialog dialog = builder.create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        dialog.show();
    }

    private void declineWithQuickReply(String messageText) {
        Log.d(TAG, "Declining call with quick reply message");
        stopCallServiceRinging();
        cancelCallNotification();
        sendDeclineToServer(messageText);
        finish();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (pulseRing1 != null) pulseRing1.clearAnimation();
        if (pulseRing2 != null) pulseRing2.clearAnimation();
    }
}
