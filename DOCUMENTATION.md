# Addis Hiwot School System — Technical Buyer Handover Documentation

> **Document Type:** Technical System Specification & Buyer Handover Guide  
> **Target Audience:** Incoming Software Administrator, Lead Software Engineer, DevOps Engineer  
> **System Name:** Addis Hiwot School Attendance & Management System  
> **Current Version:** 1.4.0 (Web) / Version Code 5 (Android)  
> **Single-School Edition:** Yes (Configured for Addis Hiwot School)  
> **Audit Status:** Verified against repository codebase as of August 2026

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture](#2-system-architecture)
3. [Deployment Guide](#3-deployment-guide)
4. [Server & Database Administration](#4-server--database-administration)
5. [Domain, DNS & Networking](#5-domain-dns--networking)
6. [Third-Party Services & Integrations](#6-third-party-services--integrations)
7. [Security Review & Access Control](#7-security-review--access-control)
8. [Android Application & Native Capacitor Build](#8-android-application--native-capacitor-build)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Environment Variables Inventory](#10-environment-variables-inventory)
11. [Production vs Development Operations](#11-production-vs-development-operations)
12. [Technical Handover Checklist](#12-technical-handover-checklist)
13. [Pre-Handover Technical Audit & Issues](#13-pre-handover-technical-audit--issues)
14. [Addis Hiwot Single-School Context & SaaS Remnants](#14-addis-hiwot-single-school-context--saas-remnants)

---

## 1. Technology Stack

The Addis Hiwot platform is architected as a decoupled client-server application consisting of a Next.js frontend (which also exports static assets for the Android mobile wrapper) and an Express.js / TypeScript backend service communicating with PostgreSQL via Prisma ORM and Upstash Redis.

### Frontend Application

| Component | Technology | Version | Location / Config File | Description & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.2.6` | `package.json`, `next.config.mjs` | Primary web application runtime and static export engine for Capacitor. |
| **UI Library** | React | `19.2.7` | `package.json` | Core component rendering engine. |
| **Language** | TypeScript | `^5.0.0` | `tsconfig.json` | Type checking and compiler definitions. |
| **Styling** | Tailwind CSS (PostCSS) | `^4.1.9` | `app/globals.css`, `postcss.config.mjs` | Utility-first CSS engine with CSS variables for dark/light theming. |
| **Component Primitives** | Radix UI | Various (`^1.x`/`^2.x`) | `components/ui/`, `package.json` | Headless accessible components (Dialog, Dropdown, Tabs, Popover, Select). |
| **Animations** | Framer Motion | `^12.40.0` | `components/` | Page transitions, interactive spring animations, modal overlays. |
| **Icons** | Lucide React | `^1.28.0` | `components/` | Application-wide icon set. |
| **Notifications / Toasts** | Sonner | `2.0.7` | `components/ui/sonner.tsx` | Toast notifications for status messages, sync feedback, and error alerts. |
| **State & Context** | React Context API | React 19 Native | `lib/context/` | `AuthContext`, `SchoolContext`, `CalendarContext`, `LanguageContext`, `UnreadContext`. |
| **Localization & i18n** | Custom Bi-Lingual Engine | English & Amharic | `lib/i18n/translations.ts`, `lib/context/language-context.tsx` | Complete Amharic (`am`) and English (`en`) translations across all portals. |
| **Ethiopian Calendar** | Custom Julian Day Algorithm | GC & EC Support | `lib/utils/date-utils.ts`, `lib/utils/ethiopian-calendar.ts` | Timezone-anchored (`Africa/Addis_Ababa`) date formatting, Amharic day/month names, and period labels. |
| **Realtime Client** | Socket.io Client | `^4.8.3` | `lib/context/`, `components/messaging/` | WebSocket connection for realtime chat, presence, notifications, and WebRTC signaling. |
| **Mobile Runtime** | Capacitor Core / Android | `^8.4.1` | `capacitor.config.ts`, `android/` | Web-to-native Android container bridging native APIs. |
| **Client-Side DB** | IndexedDB / SyncQueue Store | Native API / LocalStorage | `lib/db/database.ts`, `lib/db/sync-queue.ts` | Offline caching for attendance records, chat messages (`zetimer_messages`), and sync queue. |
| **Form Validation** | React Hook Form + Zod | RHF `^7.79.0`, Zod `^4.4.3` | `components/`, `lib/` | Schema-driven form validation and error handling. |

### Backend Service

| Component | Technology | Version | Location / Config File | Description & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (LTS 20+) | `^20.11.0` | `server/package.json`, `render.yaml` | JavaScript server runtime. |
| **Framework** | Express.js | `^4.18.3` | `server/src/app.ts`, `server/src/server.ts` | REST API routing, middleware chaining, and HTTP request dispatching. |
| **Language** | TypeScript | `^5.3.3` | `server/tsconfig.json` | Backend type definitions and compilation (`tsc` output to `server/dist`). |
| **ORM** | Prisma ORM | `^5.10.2` / `^5.22.0` | `server/prisma/schema.prisma` | Type-safe database queries, schema migrations, and connection management. |
| **Database Engine** | PostgreSQL | PostgreSQL 14+ | Supabase / Neon Cloud | Relational database storage. |
| **Realtime Gateway** | Socket.IO Server | `^4.8.3` | `server/src/socket.ts` | Bi-directional WebSocket events (chat, presence, WebRTC audio/video call signaling). |
| **Socket Adapter** | Redis Adapter (`@socket.io/redis-adapter`) | `^8.3.0` | `server/src/redis.ts`, `server/src/socket.ts` | Upstash Redis pub/sub adapter allowing horizontal scaling across backend instances. |
| **Fault Tolerance** | In-Memory Map Fallback | Native Node.js | `server/src/redis.ts` | Automatic fallback to local cache/maps if Redis is offline (no crashes). |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` | JWT `^9.0.3`, Bcrypt `^3.0.3` | `server/src/utils/jwt.ts`, `server/src/routes/auth.routes.ts` | Password hashing (salt rounds 10) and stateless token verification. |
| **Push Notifications** | Firebase Admin SDK | `^14.0.0` | `server/src/services/notification.service.ts` | High-priority FCM messages and background data payloads to Android devices. |
| **Email Transports** | Resend SDK + Nodemailer | Resend `^4.8.0`, Nodemailer `^9.0.3` | `server/src/utils/email.ts` | Transactional emails (password reset, email verification, emergency alerts). |
| **Rate Limiting** | `express-rate-limit` | `^8.6.1` | `server/src/routes/auth.routes.ts` | IP-based request throttler for authentication and OTP verification. |
| **Performance** | `compression` | `^1.8.1` | `server/src/app.ts` | Gzip HTTP response compression. |

### Android & Native Build Environment

| Requirement | Supported Version / Range | Configuration File | Notes |
| :--- | :--- | :--- | :--- |
| **JDK (Java Development Kit)** | JDK 17 or JDK 21 (Temurin / Android Studio JBR) | `android/build.gradle` | Required to execute Gradle builds and compile native Java classes. |
| **Gradle Distribution** | Gradle `8.14.3` | `android/gradle/wrapper/gradle-wrapper.properties` | `distributionUrl=.../gradle-8.14.3-all.zip` |
| **Android SDK Compile Version** | API Level 36 (Android 15) | `android/variables.gradle` | `compileSdkVersion = 36` |
| **Android SDK Minimum Version** | API Level 24 (Android 7.0 Nougat) | `android/variables.gradle` | `minSdkVersion = 24` |
| **Android SDK Target Version** | API Level 36 | `android/variables.gradle` | `targetSdkVersion = 36` |
| **Android Gradle Plugin (AGP)** | `8.13.0` | `android/build.gradle` | Requires Gradle 8.x+ wrapper. |
| **Google Services Plugin** | `4.4.4` | `android/build.gradle` | Reads `android/app/google-services.json` for Firebase configuration. |
| **Firebase Messaging (Native)** | `24.1.0` | `android/app/build.gradle` | Native FCM client for incoming call banners and background push events. |

---

## 2. System Architecture

### Architectural Overview

```mermaid
graph TD
    subgraph Clients
        WebClient["Web Browser (PWA/Desktop)"]
        AndroidApp["Android Native App (Capacitor 8 + WebRTC/VoIP)"]
    end

    subgraph FrontendLayer["Frontend Layer (Next.js 16 - Vercel / Static APK WebDir)"]
        NextRouter["App Router (/school, /parent, /login)"]
        AuthCtx["Auth & School Context"]
        OfflineSync["IndexedDB & SyncQueue Store"]
        WebRTCClient["WebRTC / Call Audio Manager"]
    end

    subgraph BackendLayer["Backend Layer (Express.js 4 + TypeScript - Render)"]
        HttpServer["HTTP / Express Server (:5000)"]
        AuthMiddleware["Auth & Role Middleware (Single-School Mode)"]
        RateLimiter["Express Rate Limiter"]
        SocketServer["Socket.IO Server (:5000)"]
        Controllers["Controllers & Services (Attendance, Discipline, Messages, Calls)"]
    end

    subgraph CacheAndRealtime["Realtime & Distributed Cache"]
        RedisPubSub["Upstash Redis (Socket.IO Adapter + Role Cache)"]
    end

    subgraph DatabaseLayer["Data Persistence Layer"]
        PrismaORM["Prisma Client 5.x"]
        PgBouncer["PgBouncer Pooler (:6543)"]
        PostgresDB["Supabase / PostgreSQL Database (:5432)"]
    end

    subgraph ExternalServices["External Cloud Integrations"]
        FCM["Firebase Cloud Messaging (FCM Admin SDK)"]
        ResendMail["Resend Email API / SMTP Fallback"]
    end

    WebClient --> NextRouter
    AndroidApp --> NextRouter
    NextRouter --> AuthCtx
    AuthCtx --> OfflineSync
    NextRouter --> WebRTCClient

    NextRouter -- "HTTPS REST API" --> RateLimiter --> AuthMiddleware --> Controllers
    WebRTCClient -- "WSS WebSockets" --> SocketServer

    SocketServer <--> RedisPubSub
    Controllers --> PrismaORM
    PrismaORM --> PgBouncer --> PostgresDB
    PrismaORM -. "Direct Migrations" .-> PostgresDB

    Controllers --> FCM
    Controllers --> ResendMail
    SocketServer --> FCM
```

### Core Application Data Flows

#### 1. Authentication & Single-School Resolution
1. User enters email/phone and password on `/login`.
2. Frontend sends request to `POST /api/auth/login`.
3. Backend validates credentials against `User` table using `bcryptjs.compare`.
4. `auth_resolution.service.ts` and `school.service.ts` query `getSingleSchool()`, ensuring all actions bind to the single Addis Hiwot school record (`SCH-0001` or internal UUID).
5. A signed JWT containing `{ id, email, role, schoolId, customSchoolId }` is returned, setting an HTTP-only `attendance_token` cookie and returning user payload.
6. The frontend stores user state in `localStorage` and native Android `SharedPreferences` via `CallPlugin.saveAuthToken()`.

#### 2. Attendance Recording & Offline Sync
1. A teacher records attendance per grade/section/stream.
2. If online: Payload is sent directly to `POST /api/attendance`. The backend validates school isolation, persists to `Attendance` table, and logs audit entries.
3. If offline: The frontend captures the submission in `IndexedDB` (`zetimer_messages` / `sync_queue`).
4. When `useOnline` hook or `@capacitor/network` detects connection recovery, `SyncQueue.processQueue()` flushes queued records sequentially with exponential backoff.
5. Parents of marked absent/late students receive automatic FCM push alerts and dashboard notification items.

#### 3. Real-Time Chat & VoIP Voice/Video Calls
1. **Chat**: Messages sent via `socket.emit('send_message')` are written to PostgreSQL via Prisma and broadcast to the room `conversationId`. Muted members are respected, and absent members receive rich push notifications.
2. **VoIP Calls**:
   - Caller emits `socket.emit('call_user', { to, offer, type: 'VOICE'|'VIDEO' })`.
   - Backend checks `isUserBusy` via Redis/Memory.
   - If callee is backgrounded/killed on Android: Backend issues a **data-only high-priority FCM notification** to callee's device.
   - `MyFirebaseMessagingService.java` wakes the device, starts `CallService.java` (foreground service with `FOREGROUND_SERVICE_PHONE_CALL` and `USE_FULL_SCREEN_INTENT`), and launches `IncomingCallActivity.java` with native Answer/Decline buttons.
   - Upon answer, WebSockets exchange SDP answers and ICE candidates (`ice_candidate`), establishing peer-to-peer WebRTC audio/video.

---

## 3. Deployment Guide

The production architecture separates the static/Next.js frontend from the Express.js backend.

### Frontend Deployment (Vercel / Node Web Server)

#### Build Command & Output
- **Production Build Command:** `npm run build` (`next build --webpack`)
- **Production Output:** `.next/` directory (or static `out/` when `CAPACITOR_BUILD=1`)
- **Hosting Target:** Vercel, Netlify, or any Node.js container host.

#### Frontend Required Environment Variables
Configure these in the Vercel Dashboard (Project Settings > Environment Variables):
```env
NEXT_PUBLIC_APP_URL=https://your-addishiwot-web.vercel.app
NEXT_PUBLIC_API_URL=https://your-addishiwot-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://your-addishiwot-backend.onrender.com

NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

DATABASE_URL=postgresql://postgres:<password>@<host>:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:<password>@<host>:5432/postgres

RESEND_API_KEY=re_<your-resend-api-key>

NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-project-id>.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=1:<your-sender-id>:web:<your-app-id>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<your-vapid-key>
```

#### Frontend Deployment Verification Steps
1. Navigate to `https://<your-frontend-domain>/login`.
2. Inspect network tab to verify no 404/500 errors on CSS/JS bundles.
3. Verify PWA manifest loads at `https://<your-frontend-domain>/manifest.json`.
4. Verify Service Worker registers at `https://<your-frontend-domain>/sw.js`.

---

### Backend Deployment (Render / Docker / VPS)

The Express backend lives inside the `server/` directory.

#### Installation & Build Commands
- **Root Directory for Backend:** `server`
- **Install Dependencies:** `npm install`
- **Prisma Client Generation:** `npx prisma generate`
- **Production Migration:** `npx prisma migrate deploy`
- **Compile TypeScript:** `npm run build` (`tsc`)
- **Start Command:** `npm start` (`node dist/server.js`)

#### Backend Required Environment Variables (Render Dashboard)
```env
NODE_ENV=production
PORT=5000
NODE_VERSION=20

FRONTEND_URL=https://your-addishiwot-web.vercel.app
APP_URL=https://your-addishiwot-backend.onrender.com
ALLOWED_ORIGINS=https://your-addishiwot-web.vercel.app,capacitor://localhost,http://localhost

DATABASE_URL=postgresql://postgres:<password>@<host>:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:<password>@<host>:5432/postgres

JWT_SECRET=<generate-random-64-character-secret>
REDIS_URL=rediss://default:<password>@<host>:6379

RESEND_API_KEY=re_<your-resend-api-key>
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

#### Backend Health Check & Restart
- **Health Check Endpoint:** `GET /health` → Returns `{"status":"ok","message":"Server is running"}` with HTTP status `200`.
- **Restart Procedure:** Trigger manual deploy / restart in Render dashboard or run `pm2 restart addis-hiwot-server` on a VPS.

---

### Database Deployment (Supabase / PostgreSQL)

The database schema is defined in [`server/prisma/schema.prisma`](file:///c:/Users/PHOTO%20NATIONAL/zetimer/server/prisma/schema.prisma).

#### Connection Modes
1. **Pooled Connection (`DATABASE_URL`):** Connects through PgBouncer on port `6543` with `?pgbouncer=true`. Used by Prisma Client for all application CRUD operations.
2. **Direct Connection (`DIRECT_URL`):** Connects directly to PostgreSQL on port `5432`. Required by Prisma for running schema migrations, table alters, and connection handshakes.

---

## 4. Server & Database Administration

### Backend Entry Points & Router Directory
- **Server Entry:** `server/src/server.ts` (Configures HTTP timeouts, attaches Redis, initiates Socket.IO, applies initial schema fixups).
- **Express App Configuration:** `server/src/app.ts` (Registers CORS, compression, cookie parsers, maintenance middleware, and route modules).
- **Database Client Singleton:** `server/src/config/db.ts` (Initializes `PrismaClient`).

### Route Structure Summary

| Route Path | File | Description | Roles Allowed |
| :--- | :--- | :--- | :--- |
| `/health` | `server/src/app.ts` | Health probe | Public |
| `/api/auth` | `server/src/routes/auth.routes.ts` | Login, signup, password reset, token validation | Public / Authenticated |
| `/api/parent/schools`, `/login` | `server/src/controllers/parent.controller.ts` | Parent discovery and PIN login | Public |
| `/api/parent/*` | `server/src/routes/parent.routes.ts` | Parent student records, notifications, attendance | `parent` |
| `/api/students` | `server/src/routes/student.routes.ts` | Student CRUD, enrollment, class rosters | `admin`, `school_admin`, `teacher` |
| `/api/attendance` | `server/src/routes/attendance.routes.ts` | Take attendance, edit requests, session history | `admin`, `school_admin`, `teacher` |
| `/api/attendance-analytics`| `server/src/routes/attendance-analytics.routes.ts` | Aggregated attendance statistics & charts | `admin`, `school_admin` |
| `/api/schools` | `server/src/routes/school.routes.ts` | School profiles, grades, sections, streams | `admin`, `school_admin` |
| `/api/users` | `server/src/routes/user.routes.ts` | Staff and user management | `admin`, `school_admin` |
| `/api/assignments` | `server/src/routes/assignment.routes.ts` | Teacher grade/section/subject mappings | `admin`, `school_admin` |
| `/api/messages`, `/groups` | `server/src/routes/message.routes.ts` | Chat channels, DMs, group conversations | All authenticated |
| `/api/discipline` | `server/src/routes/discipline.routes.ts` | Incident logging, severity, follow-ups | `admin`, `discipline_officer`, `teacher`, `parent` (view) |
| `/api/academic-years` | `server/src/routes/academic-year.routes.ts` | Terms, semesters, current academic cycle | `admin`, `school_admin` |
| `/api/calls` | `server/src/routes/call.routes.ts` | WebRTC call session logs and history | All authenticated |
| `/api/roles` | `server/src/routes/roles.routes.ts` | Dynamic system role permissions | `admin`, `school_admin` |

### Core Database Models

```mermaid
erDiagram
    School ||--o{ User : "has staff/users"
    School ||--o{ Grade : "contains"
    School ||--o{ Section : "contains"
    School ||--o{ Stream : "contains"
    School ||--o{ Student : "enrolls"
    School ||--o{ Teacher : "employs"
    School ||--o{ Conversation : "owns"
    School ||--o{ StudentDiscipline : "records"
    School ||--o| SchoolSettings : "configures"

    Grade ||--o{ Student : "groups"
    Section ||--o{ Student : "groups"
    Stream ||--o{ Student : "groups"

    Teacher ||--o{ TeacherAssignment : "assigned to"
    Grade ||--o{ TeacherAssignment : "mapped"
    Section ||--o{ TeacherAssignment : "mapped"

    Student ||--o{ Attendance : "records"
    Teacher ||--o{ Attendance : "submits"

    User ||--o{ ParentStudentLink : "links guardian"
    Student ||--o{ ParentStudentLink : "linked to"

    Conversation ||--o{ ConversationMember : "members"
    User ||--o{ ConversationMember : "participates"
    Conversation ||--o{ Message : "contains"
    User ||--o{ Message : "sends"

    Student ||--o{ StudentDiscipline : "subject of"
    User ||--o{ StudentDiscipline : "reported by"
```

### Key Database Models Description

1. **`School`**: Root entity for school configuration. Contains school name, contact email, timestamps, and relations to all entities.
2. **`SchoolSettings`**: Operational settings (attendance threshold, session vs daily mode, location coordinates, radius geofence, calendar type `ETHIOPIAN`).
3. **`User`**: Account records for school admins, teachers, discipline officers, registrars, and parents. Stores `password_hash`, `role`, `phone`, `email`, and `pushToken`.
4. **`Student`**: Enrolled student entity linked to `Grade`, `Section`, and optional `Stream`.
5. **`Attendance`**: Attendance entry for a student on a specific date/session (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), geolocation coordinates, and distance from school.
6. **`StudentDiscipline`**: Full incident tracking with severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), category, evidence attachments, witness statements, and parent notification status.
7. **`Conversation` & `Message`**: Group channels and direct messages supporting text, file attachments, replies, pins, and read receipts.
8. **`CallSession` & `CallHistory`**: VoIP call tracking (timestamps, call duration, disconnect reasons).

---

### Step-by-Step Database Administration Tasks

#### 1. How to Connect Backend to Database
Set `DATABASE_URL` and `DIRECT_URL` in `server/.env`:
```bash
# Verify connection using Prisma CLI
cd server
npx prisma db pull --print
```

#### 2. How to Apply Schema Changes
- **In Development:**
  ```bash
  cd server
  npx prisma migrate dev --name <describe_change>
  ```
- **In Production (Zero-Loss Safe Deployment):**
  ```bash
  cd server
  npx prisma migrate deploy
  ```
  > [!CAUTION]
  > Never run `prisma db push --accept-data-loss` in production. Always use `prisma migrate deploy`.

#### 3. How to Regenerate Prisma Client
```bash
cd server
npx prisma generate
```

#### 4. How to Back Up the PostgreSQL Database
- **Using `pg_dump` CLI:**
  ```bash
  pg_dump "postgresql://postgres:<password>@<host>:5432/postgres" -F c -b -v -f addishiwot_backup_$(date +%Y%m%d).dump
  ```
- **Using Supabase Dashboard:** Navigate to **Database > Backups** and trigger a manual backup snapshot.

#### 5. How to Restore the Database
```bash
pg_restore -d "postgresql://postgres:<password>@<host>:5432/postgres" -v -c addishiwot_backup_<timestamp>.dump
```

---

## 5. Domain, DNS & Networking

### Domain Configuration Map

| Domain Role | Configured Example / Current Target | Setting Location | Production Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | `https://zetime.vercel.app` / `https://zetime.pro.et` | `.env.example`, `lib/api-config.ts` | **REQUIRES OWNER INPUT** (Assign custom school domain, e.g. `portal.addishiwot.edu.et`) |
| **Backend REST & Socket API** | `https://zetime-backend-dmlv.onrender.com` | `server/.env.example`, `render.yaml`, `lib/api-config.ts` | **REQUIRES OWNER INPUT** (Assign custom backend domain, e.g. `api.addishiwot.edu.et`) |
| **Database Host** | `*.supabase.co` | `DATABASE_URL`, `DIRECT_URL` | **VERIFY BEFORE HANDOVER** |
| **Redis Cache Host** | `*.upstash.io` | `REDIS_URL` | **VERIFY BEFORE HANDOVER** |

### Required DNS Records (When deploying to custom domain)

Assuming custom domain `addishiwot.edu.et`:

| Type | Name / Host | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| `CNAME` | `portal` | `cname.vercel-dns.com.` | Frontend Web Application |
| `CNAME` | `api` | `your-render-subdomain.onrender.com.` | Backend Express & WebSocket API |
| `TXT` | `@` | `resend._domainkey...` | Resend SPF / DKIM Email Verification |
| `TXT` | `_dmarc` | `v=DMARC1; p=none;` | DMARC Email Security Policy |

### CORS & Allowed Origins Configuration
In `server/src/app.ts`, allowed origins are computed dynamically:
```typescript
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'capacitor://localhost',
  'https://localhost',
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
];
```
> [!IMPORTANT]
> When switching domains, add your new frontend domain to `FRONTEND_URL` and `ALLOWED_ORIGINS` in the backend environment variables.

---

## 6. Third-Party Services & Integrations

```mermaid
graph LR
    System[Addis Hiwot System]
    System -->|Push Notifications| Firebase[Firebase Cloud Messaging]
    System -->|Transactional Email| Resend[Resend API]
    System -->|SMTP Backup Email| GmailSMTP[SMTP Host / Gmail]
    System -->|Multi-Instance Sockets| Upstash[Upstash Redis]
    System -->|Cloud Database| Supabase[Supabase PostgreSQL]
```

### Detailed Integration Breakdown

#### 1. Firebase Cloud Messaging (FCM)
- **Purpose:** Background push notifications, student absence alerts, lock-screen notifications, and waking Android devices for WebRTC calls.
- **Client Configuration:** `public/firebase-messaging-sw.js`, `lib/firebase-client.ts`, `android/app/google-services.json`.
- **Backend Configuration:** `FIREBASE_SERVICE_ACCOUNT` (Server environment variable containing service account JSON).
- **Verification:** Trigger a test call or message from admin to a registered parent device. Check log `[NotificationService] Firebase Admin initialized`.
- **Failure Impact:** App UI functions normally, but background devices will not ring or receive notification banners when minimized.
- **Replacement:** Standard FCM credentials generated from Google Firebase Console.

#### 2. Resend (Primary Email Delivery)
- **Purpose:** Password reset links and 6-digit email verification OTPs.
- **Relevant Files:** `server/src/utils/email.ts`, `app/api/forgot-password/route.ts`.
- **Configuration Variable:** `RESEND_API_KEY`.
- **Verification:** Request a password reset at `/forgot-password` and check delivery logs in the Resend dashboard.
- **Failure Impact:** System automatically falls back to SMTP if configured; otherwise email delivery fails.

#### 3. Nodemailer / SMTP (Fallback Email Delivery)
- **Purpose:** Backup email delivery if Resend encounters quota limits or errors.
- **Configuration Variables:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `FROM_EMAIL`.
- **Relevant Files:** `server/src/utils/email.ts`.

#### 4. Upstash Redis
- **Purpose:** Socket.IO multi-instance pub/sub message adapter and user presence/role caching.
- **Configuration Variable:** `REDIS_URL` (`rediss://...`).
- **Relevant Files:** `server/src/redis.ts`, `server/src/socket.ts`.
- **Verification:** Check backend startup logs for `[Redis] Connected successfully`.
- **Failure Impact:** System automatically falls back to in-memory Maps (`memUserSockets`, `memActiveCalls`). Websockets continue to work normally on single-server deployments.

#### 5. Supabase / PostgreSQL Database
- **Purpose:** Central relational datastore.
- **Configuration Variables:** `DATABASE_URL` (pooled), `DIRECT_URL` (direct).
- **Relevant Files:** `server/prisma/schema.prisma`, `server/src/config/db.ts`.

---

## 7. Security Review & Access Control

### Implemented Security Measures
1. **Password Hashing:** Passwords hashed with `bcryptjs` (salt rounds 10) before database persistence. Plaintext passwords are never stored.
2. **Authentication Tokens:** Signed JWT tokens (`HS256`) stored in HTTP-only, `SameSite=Lax` cookies with secure flags enabled in production.
3. **Role-Based Access Control (RBAC):** Middleware checks `authMiddleware` and `authorize(['admin', 'school_admin', 'teacher', 'discipline_officer', 'parent'])` protect backend endpoints.
4. **Brute Force Protection:** Strict `express-rate-limit` policies:
   - Login: 10 attempts/min per IP.
   - Password reset: 3 attempts/min per IP.
   - OTP verification: 5 attempts per 15 min per IP.
5. **Security HTTP Headers:** Custom middleware in `proxy.ts`, `vercel.json`, and Express sets:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
6. **Input Sanitization & Validation:** Zod validation schemas across critical auth and registration payloads.
7. **Single-School Data Scoping:** Every query in services is scoped by `schoolId` to guarantee clean data isolation.

### Recommended Improvements
1. **JWT Revocation / Blacklist:** Implement Redis-backed token blacklisting for immediate token invalidation upon user logout or password reset.
2. **Two-Factor Authentication (2FA):** Expand TOTP support for administrative accounts.
3. **Database RLS Policies:** Verify Row Level Security policies in Supabase if accessing PostgreSQL directly from frontend client keys.

### Critical Before Handover (Pre-Handover Fixes)
1. **Plaintext Keystore Passwords in Repository:** `android/keystore.properties` is present on disk with raw passwords. Remove this file from version control, add it to `.gitignore`, and supply credentials securely.
2. **Hardcoded Fallback JWT Secret:** `server/src/utils/jwt.ts` contains a fallback string `zetime-secret-key-2024-secure-and-long-enough`. If `JWT_SECRET` is omitted in `.env`, the server falls back to this predictable secret. The server must crash on startup if `JWT_SECRET` is missing.
3. **Destructive Build Command in `render.yaml`:** `render.yaml` specifies `npx prisma db push --accept-data-loss`. In production, this can drop columns or data. Change to `npx prisma migrate deploy`.

---

## 8. Android Application & Native Capacitor Build

### Android Project Configuration

- **Package ID / Application ID:** `com.zetime.app` (Defined in `capacitor.config.ts` and `android/app/build.gradle`)
- **Application Name:** Addis Hiwot (`android/app/src/main/res/values/strings.xml`)
- **Capacitor Version:** `8.4.1`
- **Gradle Version:** `8.13.0`
- **Compile SDK:** `36` | **Min SDK:** `24` | **Target SDK:** `36`

### Android Permissions Declared in `AndroidManifest.xml`
- `INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
- `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (for geofenced attendance)
- `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_PHONE_CALL`, `FOREGROUND_SERVICE_MICROPHONE`
- `SYSTEM_ALERT_WINDOW`, `DISABLE_KEYGUARD`, `MANAGE_OWN_CALLS`

### Native Java VoIP Architecture
The Android application includes native Java code to deliver full VoIP incoming call behavior:
- `CallService.java`: Foreground service keeping the audio thread alive.
- `IncomingCallActivity.java`: Native high-priority full-screen call UI that displays when the device is locked.
- `CallPlugin.java`: Custom Capacitor plugin bridging native hardware (speakerphone toggle, audio routing, background notification hooks).
- `MyFirebaseMessagingService.java`: Handles data-only FCM packets to ring without webview latency.

---

### Step-by-Step Android Build Commands

#### 1. Install Dependencies
```bash
npm ci
cd server && npm ci && cd ..
```

#### 2. Build Web Assets & Sync to Android
This script executes `next build --webpack` with `CAPACITOR_BUILD=1`, temporarily isolating server API routes, and copies the static export into `android/app/src/main/assets/public`:
```bash
npm run build:android
```

#### 3. Build Debug APK
```bash
cd android
.\gradlew.bat assembleDebug
```
- **Debug APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`

#### 4. Build Signed Release APK
```bash
cd android
.\gradlew.bat assembleRelease
```
- **Release APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

#### 5. Release Keystore Configuration
The release build uses `android/keystore.properties` which references `AddisHiwot-release.jks`:
```properties
storePassword=<SECURE_STORE_PASSWORD>
keyPassword=<SECURE_KEY_PASSWORD>
keyAlias=addishiwot
storeFile=AddisHiwot-release.jks
```

> [!WARNING]
> **Keystore Backup Criticality:** The release keystore (`AddisHiwot-release.jks`) is required to sign updates. If this keystore or its passwords are lost, you will NOT be able to push updates to installed Android devices without uninstalling the app.

---

## 9. Troubleshooting Guide

### 1. Application & Frontend

| Symptom | Probable Cause | Diagnostic Steps | Solution | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend blank screen / white page** | Mismatched environment variables or failed static hydration. | Open browser console (F12) and inspect JavaScript errors. | Ensure `NEXT_PUBLIC_API_URL` is set to valid backend URL. | Page renders login components cleanly. |
| **Login fails with "Invalid credentials"** | Incorrect password or unseeded database. | Check backend logs for `/api/auth/login` status code. | Verify user exists in `User` table; reset password via `/reset-password`. | Successful login redirects to dashboard. |
| **"School Account Suspended" toast** | School is flagged inactive. | Query `School` record in database. | Check `School` table and ensure record is active. | School portal unlocks. |

---

### 2. Database & Prisma

| Symptom | Probable Cause | Diagnostic Steps | Solution | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Prisma connection timeout** | PgBouncer port misconfigured or connection pool exhausted. | Run `npx prisma db pull` in `server/`. | Ensure `DATABASE_URL` uses port `6543` and `DIRECT_URL` uses port `5432`. | Backend startup outputs `[migration] School name uniqueness...`. |
| **Prisma client mismatch error** | Schema changed without running generator. | Check error message for model property missing in `@prisma/client`. | Run `cd server && npx prisma generate`. | Server starts without TypeScript/Prisma errors. |
| **Migration fails on existing constraint** | Schema drift between migrations and database. | Run `npx prisma migrate status`. | Resolve conflicting migration file or run `npx prisma migrate resolve`. | `prisma migrate status` reports database is up to date. |

---

### 3. Deployment & Networking

| Symptom | Probable Cause | Diagnostic Steps | Solution | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **CORS error on API requests** | Origin not present in allowed origins list. | Check browser console for `blocked by CORS policy`. | Add frontend URL to `ALLOWED_ORIGINS` in backend environment variables. | API requests return HTTP 200 without CORS header warnings. |
| **Render backend restarts constantly** | Missing required environment variable. | Check Render deploy logs for `[EnvError] Missing required env vars`. | Add missing `DATABASE_URL`, `APP_URL`, or `RESEND_API_KEY`. | Render service status displays "Live". |

---

### 4. Android & Mobile

| Symptom | Probable Cause | Diagnostic Steps | Solution | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Gradle build fails with "Java Home not found"** | `JAVA_HOME` not pointing to valid JDK 17/21. | Run `java -version` in terminal. | Set `JAVA_HOME` to Android Studio JBR: `C:\Program Files\Android\Android Studio\jbr`. | Gradle assemble completes with `BUILD SUCCESSFUL`. |
| **Push notifications / Calls not ringing on Android** | Missing `google-services.json` or uninitialized Firebase Admin. | Check logcat for `[NotificationService]` and `MyFirebaseMessagingService`. | Verify `google-services.json` is in `android/app/` and `FIREBASE_SERVICE_ACCOUNT` is set in server `.env`. | Lock screen displays incoming call activity. |
| **Capacitor sync fails during Next.js build** | Dynamic API routes present during static export. | Check `npm run build:android` output. | Use `scripts/capacitor-build.js` which hides `app/api` during static export. | Web directory `out/` compiles and syncs to `android/`. |

---

## 10. Environment Variables Inventory

### Frontend Environment Variables (`.env.local`)

| Variable Name | Component | Purpose | Required in Prod | Example Placeholder |
| :--- | :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_APP_URL` | Frontend | Base URL of web application | Yes | `https://portal.addishiwot.edu.et` |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API endpoint | Yes | `https://api.addishiwot.edu.et` |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend | WebSocket endpoint | Yes | `https://api.addishiwot.edu.et` |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend/DB | Supabase project endpoint | Yes | `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Frontend/Auth | Supabase public anonymous API key | Yes | `<supabase-anon-key>` |
| `DATABASE_URL` | Next API | Pooled connection string | Yes | `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | Next API | Direct PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `RESEND_API_KEY` | Next API | Resend email API key | Yes | `re_<resend-key>` |
| `NEXT_PUBLIC_FIREBASE_API_KEY`| Firebase Web | Web push API key | Optional | `<firebase-api-key>` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`| Firebase Web| Firebase project ID | Optional | `addishiwot-app` |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY`| Web Push | FCM VAPID public key | Optional | `<vapid-public-key>` |

---

### Backend Environment Variables (`server/.env`)

| Variable Name | Component | Purpose | Required in Prod | Example Placeholder |
| :--- | :--- | :--- | :---: | :--- |
| `PORT` | Backend | HTTP port | Yes | `5000` |
| `NODE_ENV` | Backend | Runtime environment | Yes | `production` |
| `FRONTEND_URL` | Backend | Allowed web origin & email link base | Yes | `https://portal.addishiwot.edu.et` |
| `APP_URL` | Backend | Public backend URL for callbacks | Yes | `https://api.addishiwot.edu.et` |
| `ALLOWED_ORIGINS` | Backend | Comma-separated list of CORS origins | Yes | `https://portal.addishiwot.edu.et,capacitor://localhost` |
| `DATABASE_URL` | Backend/ORM | Pooled database connection (runtime) | Yes | `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | Backend/ORM | Direct database connection (migrations)| Yes | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Backend/Auth| Secret key for signing auth tokens | Yes | `<secure-64-character-random-key>` |
| `REDIS_URL` | Backend/Realtime| Upstash Redis connection string | Optional (Single server) | `rediss://default:pass@host:6379` |
| `RESEND_API_KEY` | Backend/Email | Resend transactional email API key | Yes | `re_<resend-key>` |
| `FIREBASE_SERVICE_ACCOUNT` | Backend/Push | Full JSON string of Firebase Service Account | Yes | `{"type":"service_account",...}` |
| `SMTP_HOST` | Backend/Email | Fallback SMTP mail server | Optional | `smtp.gmail.com` |
| `EMAIL_USER` | Backend/Email | Fallback SMTP email address | Optional | `notifications@addishiwot.edu.et` |
| `EMAIL_PASS` | Backend/Email | Fallback SMTP app password | Optional | `<app-password>` |

---

## 11. Production vs Development Operations

### Development Commands
```bash
# Start frontend with Turbopack
npm run dev

# Start backend with ts-node
cd server
npm run dev

# Run unit tests
npm test

# Run mobile ADB reverse port-forwarding over USB
npm run mobile:forward
```

### Production Commands
```bash
# Build frontend web bundle
npm run build

# Build Android static export and sync Capacitor
npm run build:android

# Compile backend TypeScript to /dist
cd server
npm run build

# Run production database migrations
cd server
npx prisma migrate deploy

# Start production backend process
cd server
npm start
```

### Operational Warnings
> [!CAUTION]
> - **NEVER** run `prisma migrate reset` in production — it will drop all database tables and purge all school records.
> - **NEVER** run `prisma db push --accept-data-loss` in production — use `prisma migrate deploy`.
> - **ALWAYS** run database backups prior to executing schema migrations.

---

## 12. Technical Handover Checklist

The incoming software administrator and developer must verify receipt and operational control of the following assets:

### Repositories & Source Code
- [ ] Complete Git repository with full commit history.
- [ ] Frontend Next.js source code (`app/`, `components/`, `lib/`, `hooks/`).
- [ ] Backend Express source code (`server/src/`, `server/prisma/`).
- [ ] Android native project (`android/`) with custom Java services and activities.

### Hosting & Infrastructure Access
- [ ] Frontend hosting account (Vercel / Netlify / VPS).
- [ ] Backend hosting account (Render / Railway / AWS / VPS).
- [ ] Database administration access (Supabase / PostgreSQL master user credentials).
- [ ] Redis administration access (Upstash console).
- [ ] Domain Registrar & DNS management console for custom domains.

### Third-Party Service Credentials
- [ ] Google Firebase project ownership (`google-services.json` and Firebase Admin Service Account JSON).
- [ ] Resend API dashboard access (verified sending domains).
- [ ] SMTP service provider credentials (if maintaining fallback email).

### Android Signing & Release Assets
- [ ] Release Keystore file (`AddisHiwot-release.jks`).
- [ ] Keystore password, Key Alias (`addishiwot`), and Key password.
- [ ] Google Play Console account access (if distributing via Play Store).
- [ ] Verified build verification of both `app-debug.apk` and signed `app-release.apk`.

### Database & Environment Configurations
- [ ] Recent PostgreSQL full database dump (`.dump` or `.sql`).
- [ ] Production `.env` for backend and `.env.local` for frontend.
- [ ] Verification of single-school record (`Addis Hiwot School`) in database.

---

## 13. Pre-Handover Technical Audit & Issues

This audit classifies verified technical issues, configuration items, and code patterns discovered during the repository inspection.

### Critical Priority Issues (Must Resolve Before Handover)

| Issue | Location | Finding & Impact | Recommended Action |
| :--- | :--- | :--- | :--- |
| **1. Plaintext Keystore Credentials** | `android/keystore.properties` | Raw signing passwords (`storePassword`, `keyPassword`) are stored on disk. | Remove from version control, add to `.gitignore`, and supply passwords via environment variables during CI/CD. |
| **2. Unsafe Production Build Command in Render** | `render.yaml` (Line 14) | Command executes `prisma db push --accept-data-loss` on deployment. | Change build command to `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`. |
| **3. Hardcoded Fallback JWT Secret** | `server/src/utils/jwt.ts` (Line 9) | Contains hardcoded default secret `'zetime-secret-key-2024-secure-and-long-enough'`. | Update `getJwtSecret()` to throw a fatal error on startup if `process.env.JWT_SECRET` is missing. |
| **4. Hardcoded Test Seed Account** | `scripts/10-seed-super-admin.sql` | Seed script contains a hardcoded super admin account (`abinet24x@gmail.com`) with a known bcrypt hash (`password: 123456`). | Ensure this script is NOT run in production, and drop or update the password for any existing test users prior to public deployment. |

### High Priority Issues

| Issue | Location | Finding & Impact | Recommended Action |
| :--- | :--- | :--- | :--- |
| **1. Android Package ID Remains `com.zetime.app`** | `capacitor.config.ts`, `android/app/build.gradle` | Android package ID is configured as `com.zetime.app` rather than an Addis Hiwot namespace. | If publishing as a fresh app on Play Store, refactor to `et.edu.addishiwot.app`. (Note: Changing package ID will prevent automated in-place updates for existing installs). |
| **2. Android Deep Links Target Legacy Domains** | `android/app/src/main/AndroidManifest.xml` (Lines 61–62) | Intent filters point to `zetime-backend-dmlv.onrender.com` and `zetime.vercel.app`. | Update deep link hosts to your production Addis Hiwot domains. |

### Medium Priority Issues

| Issue | Location | Finding & Impact | Recommended Action |
| :--- | :--- | :--- | :--- |
| **1. Hardcoded Supabase Anon Keys in `render.yaml`** | `render.yaml` (Lines 44–46) | Public Supabase URL and anon key are embedded in blueprint. | Set keys to `sync: false` and populate them strictly via Render Dashboard secrets. |
| **2. Hardcoded Email Fallback** | `server/src/utils/email.ts` (Line 13) | Fallback sender email is `'Addis Hiwot School <zetime12@gmail.com>'`. | Update fallback email to official school address (e.g., `noreply@addishiwot.edu.et`). |
| **3. Web Push Service Worker Hardcoded Project** | `public/firebase-messaging-sw.js` (Lines 9–11) | Hardcoded Firebase project `zetime-16774`. | Replace with buyer's Firebase project configuration. |

### Low Priority & Informational Findings

| Issue | Location | Finding & Impact | Recommended Action |
| :--- | :--- | :--- | :--- |
| **1. Custom Event Namespaces** | `lib/utils/native-bridge.ts`, `lib/context/unread-context.tsx` | Internal browser event names use `zetime:*` prefix (e.g. `zetime:navigate`, `zetime:new_message`). | Informational: Code functions properly; optional refactor for pure aesthetic consistency. |
| **2. Local IndexedDB Store Name** | `lib/utils/message-cache.ts` | IndexedDB name is `zetimer_messages`. | Informational: Internal database identifier, invisible to end-users. |

---

## 14. Addis Hiwot Single-School Context & SaaS Remnants

The codebase has been transitioned into a dedicated Single-School deployment for Addis Hiwot. Below is an audit of remaining multi-tenant structures and SaaS artifacts:

### 1. Database Architecture & School Isolation
- In `server/prisma/schema.prisma`, tables (`Student`, `Teacher`, `Attendance`, `Conversation`, `StudentDiscipline`) retain the `schoolId` foreign key.
- `server/src/services/school.service.ts` provides `getSingleSchool()`, which automatically resolves or creates the single "Addis Hiwot School" record.
- `server/src/middleware/auth.middleware.ts` automatically attaches the Addis Hiwot `schoolId` to all decoded JWT tokens and requests.
- **Handover Decision:** Retaining `schoolId` in the schema is beneficial as it maintains relational integrity and avoids destructive migrations, while all application logic operates in single-school mode.

### 2. SaaS Billing & Super-Admin Artifacts
- `render.yaml` contains an unused environment variable placeholder `CHAPA_SECRET_KEY` (Chapa payment gateway remnant).
- `server/prisma/schema.prisma` contains the `PlatformConfig` model with unused SaaS fields (`trialEnabled`, `trialDuration`, `trialCapacity`).
- `scripts/` contains legacy multi-tenant setup scripts (`09-add-super-admin-role.sql`, `10-seed-super-admin.sql`).
- **Handover Decision:** These legacy artifacts do not interfere with Addis Hiwot single-school runtime operations and can be safely archived or ignored.

---

## 15. Buyer Readiness Confirmation

> **"If the original developer disappears tomorrow, can another competent developer understand, deploy, maintain, troubleshoot, rebuild, and update Addis Hiwot using this document?"**
>
> **YES.** This document provides complete architectural specifications, verified build commands for web and Android, environment variable inventories, database administration procedures, and troubleshooting tables based directly on the actual codebase.
