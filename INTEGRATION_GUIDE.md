# OHPEA Headless Backend — Frontend Integration Guide

This guide provides everything needed to connect the **Public Website** and the **Admin Portal** to the **OHPEA Headless REST API**.

---

## 1. Architecture & Connection Overview

The OHPEA backend is a **strictly headless REST API** (no UI, no HTML rendering). It exposes standardized JSON endpoints at `/api/*` and interactive Swagger documentation at `/api-docs`.

```
                    ┌───────────────────────────────┐
                    │     OHPEA Headless Backend    │
                    │   (Port 3000 / Production URL) │
                    └───────▲───────────────▲───────┘
                            │               │
                   HTTP/CORS│               │HTTP/CORS + Bearer JWT
                            │               │
        ┌───────────────────┴───┐       ┌───┴───────────────────┐
        │     Public Website    │       │      Admin Portal     │
        │ (Next.js / Vite React)│       │ (Vite React / Next.js)│
        │      Port 5173        │       │       Port 5174       │
        └───────────────────────┘       └───────────────────────┘
```

### Base URLs & Environment Variables
In your frontend projects, define the API base URL in your `.env`:

#### Public Website (`.env` or `.env.local`):
```ini
VITE_API_URL=http://localhost:3000/api
# Or in Next.js:
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

#### Admin Portal (`.env` or `.env.local`):
```ini
VITE_API_URL=http://localhost:3000/api
# Or in Next.js:
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### CORS Configuration
The backend allows origins listed in `ALLOWED_ORIGINS` (comma-separated). In development, all `localhost` origins are permitted by default.
In `ohpea-api/.env`:
```ini
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,https://ohpea.org,https://admin.ohpea.org
```

---

## 2. Universal API Client SDK (`ohpea-api-client.ts`)

A ready-to-use TypeScript API SDK is included in this repository at `ohpea-api-client.ts`. You can copy this file directly into both your **Public Website** and **Admin Portal** projects (`src/lib/api.ts` or `src/services/api.ts`).

### Installing in your frontend:
```bash
# Copy ohpea-api-client.ts to your frontend project:
cp /path/to/ohpea-api/ohpea-api-client.ts src/lib/api.ts
```

### Quick Usage Example (React / Vue / Svelte / Plain JS):
```typescript
import { OhpeaApiClient } from './lib/api';

// Initialize with environment API URL
export const api = new OhpeaApiClient(import.meta.env.VITE_API_URL || 'http://localhost:3000/api');
```

---

## 3. Alternative: Custom Axios or Fetch Setup

If you prefer using your existing Axios or Fetch wrappers, configure them with the following interceptors:

### Standard Response Envelope
All API responses follow this consistent envelope:
```typescript
// Success Response:
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "total": 150, "totalPages": 8 } // (on paginated endpoints)
}

// Error Response:
{
  "success": false,
  "error": "Error message description",
  "fields": { "phone": "Invalid Ethiopian phone format" } // (on 400 validation failures)
}
```

### Axios Client Example:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ohpea_jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ohpea_jwt_token');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
```

---

## 4. Public Website Integration (Prompt 3)

### 4.1 Lookup Data (Regions/Zones, Sectors, Colleges)
The registration form and filters rely on database-driven lookups localized in 5 languages (`en`, `om`, `am`, `ar`, `fr`).

```typescript
// GET /api/public/lookups?lang=om
const res = await api.getLookups('en');
const {
  regions,           // 26 Oromia zones, major city administrations, and outside regions
  sectors,           // Hotel, Restaurant, Lodge/Resort, Tour Operator, etc.
  fieldsOfStudy,     // Tourism Mgmt, Hospitality Mgmt, Anthropology, etc.
  graduationLevels,  // Diploma, 1st Degree, 2nd Degree, 3rd Degree
  occupationTypes    // Private, Government, Other
} = res.data;
```

### 4.2 Member Registration Flow
Registrations can be submitted as standard JSON or as `multipart/form-data` with documents (Fayda National ID or Passport + up to 5 educational credentials).

#### JSON Mode (Quick Registration):
```typescript
const payload = {
  fullName: "Chala Tolessa",
  phone: "+251911234567",       // Auto-normalized to +251...
  email: "chala.tolessa@example.com",
  gender: "male",               // "male" | "female"
  dateOfBirth: "1994-05-12",     // Optional YYYY-MM-DD
  graduationLevelId: "grad-first_degree",
  occupationType: "private",    // "private" | "government" | "other"
  sectorId: "sec-hotel",
  fieldOfStudyId: "fos-tourism_mgmt",
  professionalCategory: "Front Office Manager", // Optional
  organizationName: "Haile Resort",             // Optional
  jobTitle: "Operations Supervisor",            // Optional
  regionId: "reg-west-arsi",    // From lookups
  town: "Shashemene",
  idType: "fayda",              // "fayda" | "passport"
  idNumber: "FAYDA-9812-4412",
  consent: true,                // Required
  preferredLanguage: "om"       // "en" | "om" | "am" | "ar" | "fr"
};

const res = await api.registerMember(payload);
// Response: { success: true, data: { memberNo: "OHPEA-2026-00151", status: "pending" } }
```

#### Multipart/Form-Data Mode (With Document Uploads):
```typescript
const formData = new FormData();
formData.append('fullName', 'Chala Tolessa');
formData.append('phone', '+251911234567');
formData.append('email', 'chala@example.com');
formData.append('gender', 'male');
formData.append('graduationLevelId', 'grad-first_degree');
formData.append('occupationType', 'private');
formData.append('sectorId', 'sec-hotel');
formData.append('fieldOfStudyId', 'fos-tourism_mgmt');
formData.append('regionId', 'reg-west-arsi');
formData.append('town', 'Shashemene');
formData.append('idType', 'fayda');
formData.append('idNumber', 'FAYDA-9812-4412');
formData.append('consent', 'true');

// Attach Fayda / Passport scan (Max 5MB: PDF, JPG, PNG)
formData.append('idDocument', idFileInput.files[0]);

// Attach Educational Credentials (1 to 5 files)
for (let i = 0; i < credentialFileInput.files.length; i++) {
  formData.append('credentials', credentialFileInput.files[i]);
}

const res = await api.registerMember(formData);
```

#### Handling 409 Duplicate Detection:
If the phone, email, or Fayda ID is already registered, the backend returns:
```json
{
  "success": false,
  "error": "A registration with these credentials already exists. Please contact OHPEA support."
}
```

### 4.3 Safe Public Statistics
Safe aggregates for homepage metric counters (total members, active members, regions, programs, activities):
```typescript
// GET /api/public/stats
const res = await api.getPublicStats();
/*
{
  "approvedTotal": 128,
  "activeTotal": 115,
  "regionsCount": 26,
  "programsCount": 7,
  "activitiesThisYear": 12
}
*/
```

### 4.4 Programs & Objectives
```typescript
// 7 Official Program Areas
const programs = await api.getPrograms();

// 8 Official + 8 Main + 13 Specific Objectives
const general = await api.getObjectives('general');
const official = await api.getObjectives('official');
const main = await api.getObjectives('main');
const specific = await api.getObjectives('specific');
```

### 4.5 Announcements & Events (with Countdown Timer)
```typescript
// Query upcoming events or vacancies
const announcements = await api.getAnnouncements({
  type: 'event',         // vacancy | call_for_proposal | call_for_research | news | event
  when: 'upcoming',      // upcoming | past
  page: 1,
  pageSize: 10
});

// Each event returns eventStartAt for driving the public countdown timer:
// announcement.eventStartAt -> "2026-11-20T09:00:00.000Z"
```

### 4.6 Contact & Newsletter
```typescript
// Submit Contact Inquiry
await api.submitContact({
  name: "Almaz Kebede",
  email: "almaz@example.com",
  phone: "+251922334455",
  subject: "Membership Verification",
  message: "I submitted my documents last week..."
});

// Subscribe to Newsletter
await api.subscribeNewsletter("subscriber@example.com", "Abebe");
```

---

## 5. Admin Portal Integration (Prompt 2)

### 5.1 Admin Authentication & Force Password Change
```typescript
// 1. Submit Credentials
const res = await api.login(usernameOrEmail, password);

if (res.success) {
  const { token, user } = res.data;
  api.setToken(token);

  // 2. Check First-Login Password Change Flag:
  if (user.mustChangePassword) {
    // Redirect to mandatory password change screen
    router.push('/admin/change-password');
  } else {
    // Redirect to dashboard
    router.push('/admin/dashboard');
  }
}
```

### 5.2 User Roles & Jurisdictions
The returned `user` object determines UI permissions and regional scoping:
```typescript
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@ohpea.org",
  "fullName": "Super Administrator",
  "role": "SuperAdmin",       // "SuperAdmin" | "RegionalAdmin" | "Finance" | "Editor"
  "permissions": ["*"],       // String array of granular permissions
  "regionId": null,           // Populated for RegionalAdmin (e.g., "reg-jimma-zone")
  "mustChangePassword": false
}
```
- **SuperAdmin:** Full access across all 26 regions.
- **RegionalAdmin:** Server queries are automatically filtered to `user.regionId`. Regional admins cannot see or modify members outside their region.
- **Finance:** Access to payments, contribution plans, voiding, and financial exports.
- **Editor:** Access to CMS (Announcements, Programs, Partners, Activities).

### 5.3 Member Management
```typescript
// 1. Filtered, Searchable, Paginated Member List
const members = await api.getMembers({
  q: 'Tolessa',                      // Searches name, phone, email, memberNo
  registrationStatus: 'pending',    // 'pending' | 'approved' | 'rejected'
  membershipStatus: 'active',        // 'active' | 'inactive' | 'pending'
  regionId: 'reg-west-shewa',
  sectorId: 'sec-hotel',
  page: 1,
  pageSize: 25,
  sort: 'createdAt:desc'
});

// 2. Member Profile Details with Documents & Contribution Summary
const member = await api.getMemberById(memberId);

// 3. Approve Member (Sets status to 'approved', sends SMS/Email if enabled)
await api.approveMember(memberId);

// 4. Reject Member (Reason required)
await api.rejectMember(memberId, "Credential scans were unreadable. Please re-upload.");

// 5. Toggle Active/Inactive Status
await api.setMemberStatus(memberId, 'inactive');

// 6. Secure Document Download (ID & Credentials)
// In Admin UI, link to the authenticated streaming endpoint:
const docUrl = api.getDocumentDownloadUrl(memberId, docId);
// <a href={docUrl} target="_blank">View Fayda ID</a>
```

### 5.4 Dashboard Analytics & Charts
```typescript
// 1. KPI Cards Summary
const summary = await api.getDashboardSummary();
/*
{
  "totalMembers": 150,
  "active": 128,
  "inactive": 12,
  "pending": 10,
  "pendingRegistrations": 5,
  "female": 65,
  "male": 85,
  "governmentCount": 42,
  "privateCount": 98,
  "otherCount": 10,
  "newThisMonth": 14,
  "totalCollectedThisYear": 185000
}
*/

// 2. Demographic & Sector Breakdowns for Pie / Bar Charts
const genderChart = await api.getMembersByDimension('gender', 'en');
const sectorChart = await api.getMembersByDimension('sector', 'en');
const regionChart = await api.getMembersByDimension('region', 'en');
const collegeChart = await api.getMembersByDimension('field', 'en');
// Returns: [{ key: 'sec-hotel', label: 'Hotel', count: 45, percent: 30.0 }, ...]

// 3. Financial Contribution Time Series for Line / Area Charts
const contributionChart = await api.getContributionsDashboard('12m', 'month');
/*
{
  "totalCollected": 185000,
  "paidMembers": 128,
  "unpaidMembers": 22,
  "timeSeries": [
    { "bucket": "2026-01", "totalEtb": 15000, "paymentsCount": 35 },
    { "bucket": "2026-02", "totalEtb": 18200, "paymentsCount": 42 }, ...
  ],
  "byPeriod": { "monthly": 145000, "yearly": 40000 },
  "byMethod": { "bank_transfer": 120000, "mobile_money": 55000, "cash": 10000 }
}
*/
```

### 5.5 Recording Payments & Printing Official Receipts
```typescript
// Record a Member Contribution
const payment = await api.recordPayment({
  memberId: "uuid",
  amountEtb: 100,
  period: "monthly",            // "weekly" | "monthly" | "yearly"
  paidForDate: "2026-11-01",    // The period date covered
  method: "bank_transfer",      // "cash" | "bank_transfer" | "mobile_money" | "other"
  bank: "Sinke Bank",           // Optional
  reference: "TXN-88291039",    // Transaction reference
  note: "Direct transfer via CBE Birr"
});

// Download Official PDF Receipt
const receiptUrl = api.getReceiptPdfUrl(payment.data.id);
window.open(receiptUrl, '_blank');

// List Members with Unpaid Contributions for Period
const unpaidList = await api.getUnpaidMembers('monthly', '2026-11-01');
```

### 5.6 Bulk SMS Campaigns (AfroMessage Integration)
```typescript
// 1. Send Single SMS
await api.sendSms({
  memberId: "uuid",
  message: "Dear Member, your OHPEA membership renewal receipt RCT-2026-00042 is ready."
});

// 2. Launch Broadcast Campaign with Audience Filter & Dynamic Variables
await api.createSmsCampaign({
  name: "General Assembly Notification",
  message: "Baga gammadde {{fullName}}, OHPEA General Assembly will take place on Dec 5 in Adama.",
  audienceFilter: {
    regionId: "reg-adama-city",
    membershipStatus: "active"
  }
});

// 3. Check Account Balance
const balance = await api.getSmsBalance();
```

---

## 6. Complete API Reference

| Method | Endpoint | Description | Auth Level |
|---|---|---|---|
| `GET` | `/` | API Information `{ success, name, version }` | Public |
| `GET` | `/health` | Health Check | Public |
| `GET` | `/api-docs` | Interactive Swagger UI Explorer | Public |
| `GET` | `/api-docs/openapi.json` | Raw OpenAPI 3.0.3 Specification | Public |
| **AUTH** | | | |
| `POST` | `/api/auth/login` | Admin Login (`usernameOrEmail`, `password`) | Public (Rate-limited) |
| `GET` | `/api/auth/me` | Current Authenticated Admin Profile | Bearer JWT |
| `POST` | `/api/auth/change-password` | Change Admin Password | Bearer JWT |
| `POST` | `/api/auth/logout` | Client Token Drop & Audit Log | Bearer JWT |
| **PUBLIC** | | | |
| `GET` | `/api/public/site-settings` | Organization Contacts, Mission, Socials | Public |
| `GET` | `/api/public/stats` | Safe Aggregate Numbers for Counters | Public |
| `GET` | `/api/public/lookups` | Regions, Sectors, Fields, Levels | Public |
| `GET` | `/api/public/programs` | 7 Core Program Areas | Public |
| `GET` | `/api/public/programs/:slug` | Program Detail | Public |
| `GET` | `/api/public/objectives` | Association Objectives (general/official/main) | Public |
| `GET` | `/api/public/partners` | Partner Organizations & Logos | Public |
| `GET` | `/api/public/activities` | Recent Public Activities | Public |
| `GET` | `/api/public/announcements` | Filtered Announcements & Events | Public |
| `GET` | `/api/public/announcements/:slug` | Announcement Detail | Public |
| `POST` | `/api/public/registrations` | Member Registration (JSON or Multipart) | Public (Rate-limited) |
| `POST` | `/api/public/registrations/otp/request` | Request Email Verification OTP | Public (Rate-limited) |
| `POST` | `/api/public/registrations/otp/verify` | Verify OTP Code & Receive OTP Token | Public (Rate-limited) |
| `POST` | `/api/public/contact` | Submit Public Inquiry | Public (Rate-limited) |
| `POST` | `/api/public/newsletter` | Subscribe to Newsletter | Public (Rate-limited) |
| `GET` | `/api/public/translations/:lang` | UI Translation Strings (en/om/am/ar/fr) | Public |
| **ADMIN: MEMBERS** | | | |
| `GET` | `/api/admin/members` | Search, Filter & Paginate Members | Bearer JWT (`members`) |
| `GET` | `/api/admin/members/:id` | Member Profile & Attached Documents | Bearer JWT (`members`) |
| `POST` | `/api/admin/members` | Manually Create Member | Bearer JWT (`members.edit`) |
| `PUT` | `/api/admin/members/:id` | Update Member Details | Bearer JWT (`members.edit`) |
| `PATCH` | `/api/admin/members/:id/status` | Set Status (`active` / `inactive`) | Bearer JWT (`members.edit`) |
| `POST` | `/api/admin/members/:id/approve` | Approve Registration | Bearer JWT (`members.approve`) |
| `POST` | `/api/admin/members/:id/reject` | Reject Registration (`reason`) | Bearer JWT (`members.approve`) |
| `DELETE` | `/api/admin/members/:id` | Soft Delete Member | SuperAdmin Only |
| `GET` | `/api/admin/members/export` | Download Member Directory (`xlsx` / `pdf`) | Bearer JWT (`members.export`) |
| `GET` | `/api/admin/members/:id/documents/:docId` | Stream Private ID / Credential File | Bearer JWT (`members`) |
| `GET` | `/api/admin/registrations/pending-count` | Badge Counter for Pending Registrations | Bearer JWT (`members`) |
| **ADMIN: DASHBOARD** | | | |
| `GET` | `/api/admin/dashboard/summary` | Top-level KPIs & Gender/Sector Counts | Bearer JWT (`dashboard`) |
| `GET` | `/api/admin/dashboard/members-by` | Dynamic Demographic Chart Aggregations | Bearer JWT (`dashboard`) |
| `GET` | `/api/admin/dashboard/contributions` | Financial Time Series (3m/6m/12m) | Bearer JWT (`contributions.dashboard`) |
| `GET` | `/api/admin/dashboard/recent-activity` | Audit Trail Stream for Dashboard | Bearer JWT (`dashboard`) |
| **ADMIN: PAYMENTS** | | | |
| `GET` | `/api/admin/payments` | Payment History & Filters | Bearer JWT (`payments`) |
| `POST` | `/api/admin/payments` | Record Member Contribution | Bearer JWT (`payments.record`) |
| `GET` | `/api/admin/payments/:id` | Payment Record Detail | Bearer JWT (`payments`) |
| `POST` | `/api/admin/payments/:id/void` | Void Payment Record (`note`) | Bearer JWT (`payments.void`) |
| `GET` | `/api/admin/payments/:id/receipt` | Download Official PDF Receipt | Bearer JWT (`payments`) |
| `GET` | `/api/admin/payments/unpaid` | Members Unpaid for Given Period | Bearer JWT (`payments`) |
| `GET` | `/api/admin/payments/export` | Export Payments Spreadsheet (`xlsx`) | Bearer JWT (`payments`) |
| `GET` | `/api/admin/contribution-plans` | Contribution Plans (Monthly/Yearly) | Bearer JWT (`payments`) |
| **ADMIN: CMS** | | | |
| `GET/POST`| `/api/admin/announcements` | Announcements Management | Bearer JWT (`announcements`) |
| `PATCH` | `/api/admin/announcements/:id/publish` | Publish Announcement | Bearer JWT (`announcements`) |
| `PATCH` | `/api/admin/announcements/:id/archive` | Archive Announcement | Bearer JWT (`announcements`) |
| `GET/POST`| `/api/admin/programs` | Programs Management | Bearer JWT (`programs`) |
| `GET/POST`| `/api/admin/objectives` | Objectives Management | Bearer JWT (`programs`) |
| `GET/POST`| `/api/admin/partners` | Partners & Logos Management | Bearer JWT (`partners`) |
| `GET/POST`| `/api/admin/activities` | Activities & Photos Management | Bearer JWT (`activities`) |
| `GET/PUT` | `/api/admin/settings/:key` | Site Settings Management | SuperAdmin Only |
| `GET` | `/api/admin/messages` | View Public Contact Inquiries | Bearer JWT (`messages`) |
| `PATCH` | `/api/admin/messages/:id` | Update Message Status | Bearer JWT (`messages`) |
| `GET` | `/api/admin/subscribers` | View Newsletter Subscribers | Bearer JWT (`subscribers`) |
| **ADMIN: SMS & USERS** | | | |
| `POST` | `/api/admin/sms/send` | Send Single SMS | Bearer JWT (`sms`) |
| `POST` | `/api/admin/sms/campaigns` | Create & Schedule Bulk Campaign | Bearer JWT (`sms`) |
| `GET` | `/api/admin/sms/campaigns` | List Campaigns & Delivery Status | Bearer JWT (`sms`) |
| `GET` | `/api/admin/sms/balance` | Query AfroMessage Balance | Bearer JWT (`sms`) |
| `GET` | `/api/admin/meta/permissions` | Available Permissions Matrix | SuperAdmin Only |
| `GET/POST`| `/api/admin/users` | Admin User Accounts | SuperAdmin Only |
| `PATCH` | `/api/admin/users/:id/active` | Activate / Deactivate Admin User | SuperAdmin Only |
| `GET` | `/api/admin/audit-logs` | Immutable Audit Trail Logs | SuperAdmin Only |
