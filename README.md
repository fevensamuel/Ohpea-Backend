# OHPEA REST API Backend & Member Management System

Backend REST API for the **Oromia Hospitality & Tourism Professionals Association (OHPEA)**.
The system replaces manual, unorganized records with a secure database serving two client fronts:
1. Public association website (information, programs, announcements, member registration)
2. Admin management portal (member verification, approvals/rejections, contribution tracking, statistics, SMS campaigns, content management)

---

## 1. Tech Stack & Architecture
- **Runtime:** Node.js >= 18, TypeScript (ESM, `"type": "module"`)
- **Web Framework:** Express 4
- **Database:** PostgreSQL via `pg` (Raw parameterized SQL, connection pool with SSL auto-detect, zero ORM overhead). Includes high-performance embedded PG engine for offline development and testing.
- **Authentication:** JWT (`jsonwebtoken`) + `bcryptjs` password hashing. Refuses boot if `JWT_SECRET` is missing or < 32 characters.
- **Security:** `helmet`, strict `cors` allow-list, `customRateLimiter` sliding window, role-based access control (RBAC), and regional jurisdiction scoping.
- **Validation:** `zod` schemas for body and query validation with field-level 400 errors.
- **Documentation:** Interactive OpenAPI 3 Swagger UI at `/api-docs` and `/api-docs/openapi.json`.
- **Integrations:**
  - SMS: AfroMessage (`afromessage` package wrapper)
  - Email: `nodemailer` (SMTP for OTP and payment receipts)
  - Exports: `exceljs` (XLSX) and `pdfkit` (PDF member directories and official contribution receipts)

---

## 2. Folder Structure
```
ohpea-api/
  server.ts                      # Server bootstrap, CORS, Helmet, static uploads, health & error handling
  package.json                   # Dependencies, dev/build/start/smoke scripts
  tsconfig.json                  # TypeScript configuration
  .env.example                   # Environment variable documentation
  src/
    types.ts                     # Shared TypeScript interfaces and union types
    translations.ts              # Multilingual message strings (en, om, am, ar, fr)
    backend/
      database.ts                # Pool, testConnection(), initDatabase(), migrations, seed, dbOperations
      middleware.ts              # authenticateJWT, loadAdminContext, requireSuperAdmin, requirePermission, requireRegionScope, customRateLimiter
      routes.ts                  # Complete API routes (auth, public, admin, payments, cms, sms)
      swagger.ts                 # OpenAPI 3 specification covering every endpoint
    config/
      multer.ts                  # Public vs Private file upload storage (5MB limit, MIME checks)
    services/
      afroSmsService.ts          # AfroMessage wrapper
      smsCampaignService.ts      # Bulk send, scheduling, templating ({{fullName}}, {{memberNo}}), logging
      emailService.ts            # nodemailer: OTP, receipts, notifications
      otpService.ts              # Cryptographic code generation, hashing, verification, throttling
      exportService.ts           # XLSX and PDF exports, official payment receipts
      statsService.ts            # SQL dynamic aggregations for KPI dashboards and safe public stats
  scripts/
    smokeTest.ts                 # Automated API test suite (npm run smoke)
    seedDemo.ts                  # Manual seed script (~150 members, ~600 payments)
    clearDemo.ts                 # Remove demo data (npm run seed:clear-demo)
```

---

## 3. Environment Variables (`.env.example`)

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/ohpea
DATABASE_SSL=false
JWT_SECRET=super_secure_jwt_secret_key_ohpea_2026_at_least_32_chars
JWT_EXPIRES_IN=8h
SERVER_PEPPER=ohpea_pepper_duplicate_detection_key_2026
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
UPLOAD_PATH=./uploads
PRIVATE_UPLOAD_PATH=./private_uploads
SEED_ADMIN_EMAIL=admin@ohpea.org
SEED_ADMIN_PASSWORD=Admin12345!ChangeMe
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=no-reply@ohpea.org
SMTP_PASS=
SMTP_FROM="OHPEA <no-reply@ohpea.org>"
AFROMESSAGE_TOKEN=
AFROMESSAGE_IDENTIFIER_ID=
AFROMESSAGE_SENDER_NAME=OHPEA
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
FEATURE_EMAIL_OTP=false
FEATURE_SMS=false
FEATURE_MEMBER_PORTAL=false
SEED_DEMO_DATA=true
```

---

## 4. Scripts & Commands

| Script | Command | Description |
|---|---|---|
| Development | `npm run dev` | Runs server via `tsx server.ts` with auto-migration and live Swagger |
| Lint Check | `npm run lint` | Runs `tsc --noEmit` to verify type safety |
| Smoke Tests | `npm run smoke` | Runs automated smoke tests hitting health, login, stats, and registration |
| Seed Demo Data | `npm run seed:demo` | Seeds ~150 realistic members and ~600 payments |
| Clear Demo Data | `npm run seed:clear-demo`| Clears all rows flagged with `is_demo=true` |
| Production Build | `npm run build` | Bundles via `esbuild server.ts --bundle --platform=node` |
| Production Start | `npm run start` | Runs `node dist/server.cjs` |

---

## 5. Deployment Guide

### Option A: Railway / Render
1. Create a new Node.js Web Service from repository.
2. Provision a PostgreSQL Database and link `DATABASE_URL`.
3. Set `DATABASE_SSL=true`.
4. Configure `JWT_SECRET` (>= 32 chars) and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
5. Set Build Command: `npm run build`
6. Set Start Command: `npm run start`

### Option B: VPS (Ubuntu / Debian + Systemd / Docker)
1. Clone repository to `/var/www/ohpea-api`.
2. Copy `.env.example` to `.env` and fill production secrets.
3. Install dependencies: `npm install --omit=dev`.
4. Build bundle: `npm run build`.
5. Setup PM2: `pm2 start dist/server.cjs --name ohpea-api`.

---

## 6. Curl / API Testing Collection

### 1. Health Check
```bash
curl -X GET http://localhost:3000/health
```

### 2. Admin Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin@ohpea.org","password":"Admin12345!ChangeMe"}'
```

### 3. Public Lookups
```bash
curl -X GET "http://localhost:3000/api/public/lookups?lang=om"
```

### 4. Public Registration
```bash
curl -X POST http://localhost:3000/api/public/registrations \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Tolasa Benti",
    "phone": "+251911334455",
    "email": "tolasa.benti@example.com",
    "gender": "male",
    "graduationLevelId": "grad-first_degree",
    "occupationType": "private",
    "sectorId": "sec-hotel",
    "fieldOfStudyId": "fos-tourism_mgmt",
    "regionId": "reg-adama-city",
    "town": "Adama",
    "idType": "fayda",
    "idNumber": "FAYDA-11223344",
    "consent": true
  }'
```

### 5. Admin Dashboard Summary
```bash
curl -X GET http://localhost:3000/api/admin/dashboard/summary \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### 6. Record Contribution Payment
```bash
curl -X POST http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "<MEMBER_UUID>",
    "amountEtb": 100,
    "period": "monthly",
    "paidForDate": "2026-11-01",
    "method": "mobile_money",
    "bank": "Sinke Bank",
    "reference": "TXN-998811"
  }'
```
