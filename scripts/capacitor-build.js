#!/usr/bin/env node
/**
 * capacitor-build.js
 *
 * Prepares a static Next.js export for Capacitor / Android builds.
 * Supports building:
 * 1. School Portal:           node scripts/capacitor-build.js --target=school
 * 2. Student & Parent Portal: node scripts/capacitor-build.js --target=portal
 * 3. Unified Root:            node scripts/capacitor-build.js --target=root
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ROOT_OUT = path.join(ROOT, 'out');

// Parse target from CLI args or env
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const target = (targetArg ? targetArg.split('=')[1].trim() : (process.env.APP_TARGET || 'school')).toLowerCase();

console.log(`\n============================================================`);
console.log(`  [capacitor-build] Target: ${target.toUpperCase()}`);
console.log(`============================================================\n`);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (target === 'school' || target === 'portal') {
  const appFolder = target === 'school' ? 'apps/school-portal' : 'apps/student-parent-portal';
  const targetDir = path.join(ROOT, appFolder);
  const targetOut = path.join(targetDir, 'out');

  console.log(`[capacitor-build] Building workspace app: ${appFolder}...`);

  try {
    execSync(`npx next build ${appFolder} --webpack`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CAPACITOR_BUILD: '1',
        APP_TARGET: target,
        NEXT_PUBLIC_APP_TARGET: target,
      },
      cwd: ROOT,
    });

    console.log(`\n[capacitor-build] Build succeeded for ${appFolder}`);

    // Clean root out directory and sync exported assets
    if (fs.existsSync(ROOT_OUT)) {
      fs.rmSync(ROOT_OUT, { recursive: true, force: true });
    }
    fs.mkdirSync(ROOT_OUT, { recursive: true });

    if (fs.existsSync(targetOut)) {
      console.log(`[capacitor-build] Copying ${targetOut} → ${ROOT_OUT}...`);
      copyDirRecursive(targetOut, ROOT_OUT);
    } else {
      console.warn(`[capacitor-build] Warning: ${targetOut} not found. Checking root out...`);
    }

    console.log(`[capacitor-build] ✓ Web assets prepared in ${ROOT_OUT}\n`);
  } catch (err) {
    console.error(`\n[capacitor-build] ✗ Build FAILED for ${appFolder}:`, err.message);
    process.exit(1);
  }

} else {
  // Fallback: Root build with temporary API rename
  const API_DIR = path.join(ROOT, 'app', 'api');
  const API_TMP = path.join(ROOT, 'app', '__api_cap_disabled');

  function renameSyncWithRetry(src, dest, retries = 10, delay = 300) {
    for (let i = 0; i < retries; i++) {
      try {
        if (fs.existsSync(src)) {
          fs.renameSync(src, dest);
          return true;
        }
        return false;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
          if (i === retries - 1) {
            fs.cpSync(src, dest, { recursive: true });
            fs.rmSync(src, { recursive: true, force: true });
            return true;
          }
          const limit = Date.now() + delay;
          while (Date.now() < limit) {}
        } else {
          throw err;
        }
      }
    }
  }

  let renamed = false;
  if (fs.existsSync(API_DIR)) {
    renameSyncWithRetry(API_DIR, API_TMP);
    renamed = true;
    console.log('[capacitor-build] Temporarily hidden: app/api → app/__api_cap_disabled');
  }

  let buildFailed = false;
  try {
    console.log('\n[capacitor-build] Running: next build --webpack (CAPACITOR_BUILD=1)…\n');
    execSync('npx next build --webpack', {
      stdio: 'inherit',
      env: { ...process.env, CAPACITOR_BUILD: '1', APP_TARGET: 'root' },
      cwd: ROOT,
    });
    console.log('\n[capacitor-build] ✓ Build succeeded');
  } catch (err) {
    buildFailed = true;
    console.error('\n[capacitor-build] ✗ Build FAILED');
  }

  if (renamed && fs.existsSync(API_TMP)) {
    renameSyncWithRetry(API_TMP, API_DIR);
    console.log('[capacitor-build] Restored: app/__api_cap_disabled → app/api');
  }

  if (buildFailed) process.exit(1);
}
