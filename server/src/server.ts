import { createServer } from 'http';
import app from './app';
import { initSocket } from './socket';
import { connectRedis } from './redis';
import prisma from './config/db';

const PORT = Number(process.env.PORT) || 5000;
const httpServer = createServer(app);

// Prevent hanging requests and gateway races behind reverse proxies
httpServer.requestTimeout = 30000;      // 30s max request handling time
httpServer.headersTimeout = 31000;      // Must be greater than requestTimeout
httpServer.keepAliveTimeout = 65000;    // > 60s for Cloudflare/ALB/Render keep-alive

// Drop the unique constraint on School.name if it still exists (schema migration workaround)
async function applyStartupMigrations() {
  try {
    await prisma.$executeRaw`ALTER TABLE "School" DROP CONSTRAINT IF EXISTS "School_name_key"`;
    console.log('[migration] School name uniqueness constraint removed (or was already absent).');
  } catch (e) {
    console.warn('[migration] Could not remove School_name_key constraint:', e);
  }
}

async function start() {
  // 1. Connect Redis (gracefully falls back if unavailable — socket still works on single instance)
  await connectRedis();

  // 2. Initialize Socket.IO (with Redis adapter already attached inside initSocket)
  initSocket(httpServer);

  // 3. Apply startup DB migrations
  await applyStartupMigrations();

  // 4. Start HTTP server
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // 5. Periodic Automatic Absence Processing (Every 5 minutes)
  const ABSENCE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      const { processAutomaticStaffAbsences } = await import('./services/staff-attendance.service');
      const result = await processAutomaticStaffAbsences();
      if (result.markedAbsent > 0) {
        console.log(`[AutoAbsenceWorker] Processed absences: marked ${result.markedAbsent} staff as absent.`);
      }
    } catch (err) {
      console.warn('[AutoAbsenceWorker] Error in background absence processing:', err);
    }
  }, ABSENCE_CHECK_INTERVAL_MS);
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});


