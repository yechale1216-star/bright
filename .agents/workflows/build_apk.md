---
description: Build Android APK for School Portal or Student & Parent Portal
---

# Workflow: Build Android APK for the Two Portals

This repository contains two separate frontends:
1. **School Portal** (`apps/school-portal`): For administrators, teachers, and school staff.
2. **Student & Parent Portal** (`apps/student-parent-portal`): For students and parents.

Both can be built into dedicated, standalone Android APKs with distinct package IDs so they can be installed side-by-side on the same Android device.

---

## Quick One-Command Build

### 1. Build School Portal APK
```powershell
npm run build:apk:school
```
- **Generated File**: `BrightPath-School-Portal.apk` (at repository root)
- **App Name**: Bright Path School Portal
- **Package ID**: `com.brightpath.school`

---

### 2. Build Student & Parent Portal APK
```powershell
npm run build:apk:portal
```
- **Generated File**: `BrightPath-Student-Parent-Portal.apk` (at repository root)
- **App Name**: Bright Path Student & Parent
- **Package ID**: `com.brightpath.portal`

---

### 3. Build Both APKs Sequentially
```powershell
npm run build:apk:all
```
Builds both APKs one after the other and places both `.apk` files at the repository root.

---

## Manual Step-by-Step Build

If you prefer running individual steps manually:

### For School Portal:
```powershell
# 1. Export web bundle into out/
node scripts/capacitor-build.js --target=school

# 2. Sync into Android project
$env:APP_TARGET="school"
npx cap sync android

# 3. Assemble APK
cd android
.\gradlew.bat assembleDebug -PappTarget=school

# 4. Copy to root
Copy-Item "app\build\outputs\apk\debug\app-debug.apk" -Destination "..\BrightPath-School-Portal.apk" -Force
cd ..
```

### For Student & Parent Portal:
```powershell
# 1. Export web bundle into out/
node scripts/capacitor-build.js --target=portal

# 2. Sync into Android project
$env:APP_TARGET="portal"
npx cap sync android

# 3. Assemble APK
cd android
.\gradlew.bat assembleDebug -PappTarget=portal

# 4. Copy to root
Copy-Item "app\build\outputs\apk\debug\app-debug.apk" -Destination "..\BrightPath-Student-Parent-Portal.apk" -Force
cd ..
```

---

## Installing on a Connected Android Device

Enable USB Debugging on your Android phone, connect it via USB, and run:
```powershell
# Install School Portal:
adb install -r BrightPath-School-Portal.apk

# Install Student & Parent Portal:
adb install -r BrightPath-Student-Parent-Portal.apk
```
