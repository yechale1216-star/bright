# Mobile Testing — Android USB Setup

This guide explains how to test the Addis Hiwot application on an Android device over USB during development.

## Prerequisites

- Android phone with Developer Options enabled
- USB cable connected to your development PC
- ADB (Android Debug Bridge) installed and in your system PATH
  - [Download Android Platform Tools](https://developer.android.com/studio/releases/platform-tools)

## Step-by-Step Setup

### 1. Enable Developer Options and USB Debugging

1. Go to **Settings > About Phone**.
2. Tap **Build Number** 7 times until you see "You are now a developer".
3. Go to **Settings > System > Developer Options**.
4. Enable **USB Debugging**.

### 2. Connect Your Device

Connect the phone via USB. If prompted on the phone, select **Always allow from this computer** and tap **OK**.

### 3. Verify Connection

```bash
adb devices
```

Your device ID should appear in the list with status `device`.

### 4. Set Up Port Forwarding

This maps `localhost` ports on the phone back to your development machine:

```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:5000 tcp:5000
```

Or use the helper script:

```bash
npm run mobile:forward
```

### 5. Access the App

1. Ensure both dev servers are running (`npm run dev` and `cd server && npm run dev`).
2. Open **Chrome** on your Android phone.
3. Navigate to `http://localhost:3000`.

## Troubleshooting

### Device not detected
- Try a different USB cable.
- Confirm USB Debugging is enabled.
- Change the USB connection mode to **File Transfer** or **PTP**.

### "Unauthorized" in `adb devices`
- Check your phone screen for a permission prompt.
- Run `adb kill-server` then `adb start-server`.

### Browser cannot connect
- Confirm both dev servers are running.
- Re-run the `adb reverse` commands — they reset when the phone is unplugged.
- Port forwarding only works over USB, not Wi-Fi.

### Hot Module Replacement (HMR) not working
- Use `localhost` as the hostname, not the machine's IP address. The `adb reverse` mapping only applies to `localhost`.
