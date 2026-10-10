#!/usr/bin/env node
/**
 * scripts/build-apk.js
 *
 * Automated APK builder for Bright Path:
 * 1. School Portal APK (for administrators, teachers, and staff)
 * 2. Student & Parent Portal APK (for students and parents)
 *
 * Usage:
 *   node scripts/build-apk.js --target=school
 *   node scripts/build-apk.js --target=portal
 *   node scripts/build-apk.js --all
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const GRADLE_BAT = path.join(ANDROID_DIR, 'gradlew.bat');
const GRADLE_SH = path.join(ANDROID_DIR, 'gradlew');

const TARGETS = {
  school: {
    name: 'Bright Path School Portal',
    appId: 'com.brightpath.school',
    outputName: 'BrightPath-School-Portal.apk',
  },
  portal: {
    name: 'Bright Path Student & Parent Portal',
    appId: 'com.brightpath.portal',
    outputName: 'BrightPath-Student-Parent-Portal.apk',
  },
};

function run(command, cwd = ROOT, env = {}) {
  console.log(`\n> [${cwd === ROOT ? 'root' : 'android'}] ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

function buildTarget(targetKey) {
  const targetConfig = TARGETS[targetKey];
  if (!targetConfig) {
    console.error(`[build-apk] Unknown target: "${targetKey}". Must be "school" or "portal".`);
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log(`  BUILDING APK: ${targetConfig.name}`);
  console.log(`  Target: ${targetKey} | Package ID: ${targetConfig.appId}`);
  console.log('============================================================\n');

  // Step 1: Export web bundle with target environment variables
  console.log(`[1/4] Building static Next.js assets for target: ${targetKey}...`);
  run(`node scripts/capacitor-build.js --target=${targetKey}`, ROOT, {
    APP_TARGET: targetKey,
    NEXT_PUBLIC_APP_TARGET: targetKey,
  });

  // Step 2: Capacitor Sync
  console.log(`\n[2/4] Syncing Capacitor Android project for target: ${targetKey}...`);
  run('npx cap sync android', ROOT, {
    APP_TARGET: targetKey,
    NEXT_PUBLIC_APP_TARGET: targetKey,
  });

  // Step 3: Gradle assembleDebug
  console.log(`\n[3/4] Assembling Android APK with Gradle (-PappTarget=${targetKey})...`);
  const isWindows = process.platform === 'win32';
  const gradlew = isWindows ? '.\\gradlew.bat' : './gradlew';

  // Auto-detect JAVA_HOME on Windows if not set
  if (isWindows && !process.env.JAVA_HOME) {
    const androidStudioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
    if (fs.existsSync(androidStudioJbr)) {
      process.env.JAVA_HOME = androidStudioJbr;
      console.log(`[build-apk] Auto-detected JAVA_HOME from Android Studio: ${androidStudioJbr}`);
    }
  }

  run(`${gradlew} assembleDebug -PappTarget=${targetKey}`, ANDROID_DIR, {
    APP_TARGET: targetKey,
    NEXT_PUBLIC_APP_TARGET: targetKey,
  });

  // Step 4: Copy APK to root
  const builtApkPath = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const destinationApkPath = path.join(ROOT, targetConfig.outputName);

  if (!fs.existsSync(builtApkPath)) {
    console.error(`[build-apk] Error: Built APK not found at ${builtApkPath}`);
    process.exit(1);
  }

  fs.copyFileSync(builtApkPath, destinationApkPath);
  const sizeMB = (fs.statSync(destinationApkPath).size / (1024 * 1024)).toFixed(2);

  console.log('\n============================================================');
  console.log(`  ✓ SUCCESS: ${targetConfig.name} APK Ready!`);
  console.log(`  File: ${targetConfig.outputName} (${sizeMB} MB)`);
  console.log(`  Location: ${destinationApkPath}`);
  console.log('============================================================\n');
}

// ── Main Entry ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const buildAll = args.includes('--all');
const targetArg = args.find(a => a.startsWith('--target='));
const targetValue = targetArg ? targetArg.split('=')[1].trim().toLowerCase() : null;

if (buildAll) {
  buildTarget('school');
  buildTarget('portal');
  console.log('\n🎉 Both School and Student/Parent APKs built successfully!\n');
} else if (targetValue) {
  buildTarget(targetValue);
} else {
  // Default interactive or help
  console.log(`
Usage:
  node scripts/build-apk.js --target=school    # Builds School Portal APK
  node scripts/build-apk.js --target=portal    # Builds Student & Parent Portal APK
  node scripts/build-apk.js --all              # Builds BOTH APKs sequentially
  `);
}
