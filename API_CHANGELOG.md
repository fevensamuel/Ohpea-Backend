# OHPEA REST API Changelog & Endpoint Matrix by Phase

This document indexes all backend endpoints, data contracts, and feature-gate switches for front-end integration.

---

## Phase 1: Showcase (Live by default)
Powers the initial association showcase, public information, member registration, and admin member review.

### Public Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, database connection status, and active feature flags |
| `GET` | `/api/health` | Alias health endpoint |
| `GET` | `/api/public/site-settings` | Association profile, contacts, social media, and membership policies |
| `GET` | `/api/public/stats` | Safe aggregates: approved total, active total, regions, programs, activities |
| `GET` | `/api/public/lookups` | Localized regions, sectors, fields of study, graduation levels, occupation types |
| `GET` | `/api/public/programs` | 7 core program areas (Research, Advocacy, Training, B2B, Investment, Networking, International) |
| `GET` | `/api/public/programs/:slug` | Detailed program view |
| `GET` | `/api/public/objectives` | General, official (8), main (8), and specific (13) objectives (`?kind=`) |
| `GET` | `/api/public/partners` | Partner organizations (Ministry, Oromia Bureau, Ija Developer, Sinke Bank) |
| `GET` | `/api/public/activities` | Recent organizational activities with photos |
| `GET` | `/api/public/announcements` | Published announcements, vacancies, and events (`?type=`, `?when=`, `?q=`) |
| `GET` | `/api/public/announcements/:slug` | Single announcement view |
| `POST` | `/api/public/registrations` | Public registration with multipart ID and credentials, duplicate checking |
| `POST` | `/api/public/contact` | Public contact message inbox submission |
| `POST` | `/api/public/newsletter` | Newsletter subscription |

### Admin & Auth Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Administrator login (accepts username OR email, rate-limited, lockout on 5 failures) |
| `POST` | `/api/admin/login` | Alias for `/api/auth/login` |
| `GET` | `/api/auth/me` | Current authenticated admin context and permissions |
| `POST` | `/api/auth/change-password` | Force or voluntary admin password update |
| `POST` | `/api/auth/logout` | Audit-logged logout |
| `GET` | `/api/admin/members` | Filtered & paginated member register (`q`, `registrationStatus`, `regionId`, `sectorId`) |
| `GET` | `/api/admin/members/:id` | Member record with private documents and payment history |
| `POST` | `/api/admin/members/:id/approve` | Approve registration (sets membership to pending until first payment) |
| `POST` | `/api/admin/members/:id/reject` | Reject registration with required reason |
| `GET` | `/api/admin/registrations/pending-count` | Number of unreviewed registrations |
| `GET` | `/api/admin/dashboard/summary` | Top-level KPI counts (total, active, inactive, pending, male, female, sectors) |
| `GET` | `/api/admin/dashboard/members-by` | Dimensional breakdowns (`?dimension=gender\|sector\|field\|occupation\|region`) |

---

## Phase 2: Core System (Live by default)
Provides real financial operations, contribution plans, regional scoping, and exports.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/payments` | Record member payment, auto-calculates period boundaries, generates `RCT-2026-XXXXXX` |
| `GET` | `/api/admin/payments` | Paginated contribution payments list |
| `GET` | `/api/admin/payments/:id` | Single payment detail |
| `POST` | `/api/admin/payments/:id/void` | Mark payment void with audit note |
| `GET` | `/api/admin/payments/:id/receipt?format=pdf` | Stream official branded PDF receipt |
| `GET` | `/api/admin/payments/unpaid` | Identify members with unpaid dues for specific periods |
| `GET` | `/api/admin/contribution-plans` | Active contribution plans (Monthly 100 ETB, Annual 1000 ETB) |
| `GET` | `/api/admin/dashboard/contributions` | Dynamic SQL time-series (`?range=3m\|6m\|12m`), collection totals, paid vs unpaid |
| `GET` | `/api/admin/members/export` | Download Excel (`.xlsx`) or PDF (`.pdf`) member lists |
| `GET` | `/api/admin/payments/export` | Download Excel (`.xlsx`) contribution ledger |
| `GET` | `/api/admin/members/:id/documents/:docId` | Secure streaming of private Fayda ID or credentials |
| `PATCH` | `/api/admin/members/:id/status` | Deactivate/reactivate member |
| `GET` | `/api/admin/users` | List administrative users (SuperAdmin only) |
| `POST` | `/api/admin/users` | Create administrative user with roles and permissions |
| `GET` | `/api/admin/meta/permissions` | Single source of truth for admin permission checkboxes |
| `GET` | `/api/admin/audit-logs` | Filterable immutable audit log |

---

## Phase 3: Communication & Multilingual (Gated)
- Gate switches: `FEATURE_EMAIL_OTP=true`, `FEATURE_SMS=true`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/public/registrations/otp/request` | Dispatch 6-digit OTP to email and phone (max 3/hr) |
| `POST` | `/api/public/registrations/otp/verify` | Verify OTP and issue 15-minute `otpToken` |
| `GET` | `/api/public/translations/:lang` | Server-side localized UI dictionaries (`en`, `om`, `am`, `ar`, `fr`) |
| `POST` | `/api/admin/sms/send` | Single SMS dispatch via AfroMessage |
| `POST` | `/api/admin/sms/campaigns` | Create targeted bulk SMS campaigns with `{{fullName}}` and `{{memberNo}}` placeholders |
| `GET` | `/api/admin/sms/campaigns` | List SMS campaigns with dispatch progress |
| `GET` | `/api/admin/sms/balance` | Query AfroMessage credit balance |

---

## Phase 4: Growth & Member Self-Service (Gated)
- Gate switch: `FEATURE_MEMBER_PORTAL=true`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/member/auth/login` | Member login via memberNo/phone and password |
| `GET` | `/api/member/me` | Member self-service profile and contribution status |
| `GET` | `/api/member/directory` | Verified member professional directory |
| `CRUD` | `/api/jobs` | Job board for hospitality vacancies |
| `CRUD` | `/api/b2b` | Business-to-business directory listings |
| `CRUD` | `/api/investments` | Tourism investment opportunities |
| `CRUD` | `/api/resources` | Applied tourism research repository & publications |
| `CRUD` | `/api/international` | MoUs and bilateral partner pacts |
| `CRUD` | `/api/admin/region-resources` | Equipment and resources issued per region |
