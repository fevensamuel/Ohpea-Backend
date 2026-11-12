# OHPEA Public API Reference (`/api/public/*`)

This document details the public, unauthenticated API surface designed for the **OHPEA Public Website** (Prompt 3).
All endpoints are mounted at `/api/public` without authentication barriers.

---

## Contract discovery

- `GET /api/health` — liveness check. Returns `{ success, data: { status, db, uptimeSeconds, latencyMs } }`.
- `GET /api/contract.json` — machine-readable contract. Frontends and CI fetch this to detect drift.
- Every `GET /api/public/stats` response includes `X-Contract-Version: 1`.

---

## 1. Response Envelope Standards

All responses follow the unified OHPEA API contract:

### Single Entity Response
```json
{
  "success": true,
  "data": {
    "id": "item-id",
    "name": "Sample Item"
  }
}
```

### Paginated List Response
```json
{
  "success": true,
  "data": [
    { "id": "1", "title": "First Item" },
    { "id": "2", "title": "Second Item" }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### Validation Error Response (HTTP 400)
```json
{
  "success": false,
  "error": "Validation failed",
  "fields": {
    "phone": "must be a valid Ethiopian number (+2519... or +2517...)",
    "idDocument": "ID document file is required (PDF, JPG, or PNG under 5MB)"
  }
}
```

---

## 2. Public Read Endpoints

### 2.1 `GET /api/public/site-settings`
Aggregates branding, contact, headquarters address, geographic coordinates, social channels, and emergency hotlines. Missing keys are omitted or set to `null`.

#### Request
```bash
curl -s http://localhost:3000/api/public/site-settings
```

#### Response
```json
{
  "success": true,
  "data": {
    "name": "Oromia Hospitality & Tourism Professionals Association",
    "tagline": "Advancing Professionalism & Sustainable Tourism in Oromia",
    "email": "info@ohpea.org",
    "phone": "+251911223344",
    "address": "Addis Ababa / Finfinne, Bole Sub-City, Oromia, Ethiopia",
    "coordinates": {
      "lat": 8.54,
      "lng": 39.27
    },
    "social": {
      "facebook": "https://facebook.com/ohpea.official",
      "twitter": "https://x.com/ohpea_official",
      "linkedin": "https://linkedin.com/company/ohpea",
      "youtube": "https://youtube.com/@ohpea_oromia"
    },
    "hotlines": [
      "+251911223344",
      "+251711223344"
    ]
  }
}
```

---

### 2.2 `GET /api/public/stats`
Returns safe homepage metric counter numbers. Stale or invalid `Authorization` headers are ignored and never return 401.

#### Request
```bash
curl -s http://localhost:3000/api/public/stats
```

#### Response
```json
{
  "success": true,
  "data": {
    "totalMembers": 512,
    "accreditedHotels": 87,
    "certifiedGuides": 143,
    "trainingGraduates": 320
  }
}
```

---

### 2.3 `GET /api/public/programs` & `GET /api/public/programs/:slug`
Lists published core program areas ordered by index. Internal audit fields are stripped.

#### List Request
```bash
curl -s http://localhost:3000/api/public/programs
```

#### List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "prog-research",
      "slug": "research-and-study",
      "title": { "en": "Research and Study", "om": "Qorannoo fi Qo'annoo" },
      "summary": { "en": "Conducting baseline industry studies..." },
      "body": { "en": "Full program overview..." },
      "iconUrl": "microscope",
      "orderIndex": 1
    }
  ]
}
```

#### Slug Request
```bash
curl -s http://localhost:3000/api/public/programs/research-and-study
```
*Note: Returns 404 `{ "success": false, "error": "Not found" }` if unpublished or missing.*

---

### 2.4 `GET /api/public/announcements` & `GET /api/public/announcements/:slug`
Published announcements, event countdowns, research calls, and vacancies. Excludes drafts and archived records.

#### Query Parameters
- `type`: Optional filter (`news`, `event`, `vacancy`, `call_for_proposal`, `call_for_research`)
- `limit`: Page size (1 to 50, default `10`)
- `page`: Page number (1-based, default `1`)

#### List Request
```bash
curl -s "http://localhost:3000/api/public/announcements?type=news&limit=5&page=1"
```

#### Paginated Response
```json
{
  "success": true,
  "data": [
    {
      "id": "ann-01",
      "slug": "oromia-ecotourism-symposium-2026",
      "type": "event",
      "title": { "en": "Oromia Ecotourism & Hospitality Symposium 2026" },
      "summary": { "en": "Bringing together over 500 professionals in Adama." },
      "body": { "en": "Detailed agenda and speaker line-up..." },
      "coverImage": "https://example.com/uploads/symposium.jpg",
      "eventStartAt": "2026-11-20T09:00:00.000Z",
      "deadline": "2026-11-15",
      "publishedAt": "2026-11-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 5,
    "total": 14,
    "totalPages": 3
  }
}
```

---

### 2.5 `GET /api/public/partners`
Returns active partner organizations and sponsor logos.

#### Request
```bash
curl -s http://localhost:3000/api/public/partners
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "partner-1",
      "name": "Ministry of Culture and Tourism",
      "website": "https://mct.gov.et",
      "logoUrl": null
    },
    {
      "id": "partner-4",
      "name": "Sinke Bank",
      "website": "https://sinkebank.com",
      "logoUrl": null
    }
  ]
}
```

---

### 2.6 `GET /api/public/activities`
Recent organization events and photo galleries.

#### Request
```bash
curl -s "http://localhost:3000/api/public/activities"
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "act-1",
      "title": { "en": "Hospitality Service Standards Workshop in Bishoftu" },
      "summary": { "en": "Trained 120 resort supervisors on international hygiene and guest service." },
      "date": "2026-10-15",
      "photos": [
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800"
      ]
    }
  ]
}
```

---

### 2.7 `GET /api/public/lookups/regions`
Nested regions and woredas for registration dropdowns.

#### Request
```bash
curl -s http://localhost:3000/api/public/lookups/regions
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "reg-east-shewa",
      "name": "East Shewa",
      "woredas": [
        { "id": "wor-adama", "name": "Adama" },
        { "id": "wor-bishoftu", "name": "Bishoftu" }
      ]
    },
    {
      "id": "reg-west-arsi",
      "name": "West Arsi",
      "woredas": [
        { "id": "wor-arssi-negele", "name": "Arsi Negele" },
        { "id": "wor-shashemene", "name": "Shashemene" }
      ]
    }
  ]
}
```

---

## 3. Public Write Endpoints

### 3.1 `POST /api/public/registrations`
Public membership application submission. Accepts `multipart/form-data` with:
- `fullName`: string (required)
- `phone`: string (required, valid Ethiopian mobile e.g. +2519... or +2517...)
- `email`: string (optional, valid email; a member address is generated if omitted)
- `gender`: `'male' | 'female' | 'unspecified'` (optional; defaults to `unspecified`)
- `membershipCategory`: `'Professional' | 'Entrepreneur' | 'Corporate' | 'Associate'` (optional)
- `dateOfBirth`: date string in `YYYY-MM-DD` format (optional)
- `nationality`, `emergencyContactName`, `emergencyContactPhone`, `businessTin`, `skills`: strings (optional)
- `expertiseAreas`, `interests`: arrays of strings (optional; JSON-encoded arrays or comma-separated multipart values)
- `qualification`, `fieldOfStudy`, `organization`, `zone`: strings (optional)
- `idType`: `'fayda' | 'passport' | 'kebele' | 'driver'` (required)
- `idNumber`: string (required)
- `idDocument`: File (required, PDF/JPG/PNG, max 5MB)
- `credentialDocs`: File[] (optional, max 10 files)

Persists directly in `members` with `registration_status = 'pending'` and `membership_status = 'pending'`. Uploaded files are associated with the new member in `member_documents`. Returns `201 Created` with the member ID and member number.

*Enum Constraint:* `idType` MUST be one of `'fayda'`, `'passport'`, `'kebele'`, `'driver'`. Any other value returns HTTP 400 with `fields.idType`.

---

### Registration flow (required order)

The public website may request and verify a phone OTP independently of the
registration. A submitted registration is immediately visible to admins with
pending statuses; OTP verification does not write to the legacy `registrations`
table or change member status.

1. `POST /api/public/registrations/otp/send` `{ phone }`
2. `POST /api/public/registrations` multipart (fields listed above)
   → returns `{ data: { memberId, memberNo, registrationStatus, membershipStatus } }`
3. `POST /api/public/registrations/otp/verify` `{ phone, code }`

---

### 3.2 `POST /api/public/registrations/otp/send`
Dispatches a 6-digit verification code to an Ethiopian phone number via AfroMessage.
- Rate limits: Max 3 requests per phone per 10 minutes; 5 requests per minute per IP.

#### Request
```bash
curl -X POST http://localhost:3000/api/public/registrations/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+251911445566"}'
```

#### Response
```json
{
  "success": true,
  "data": {
    "message": "OTP sent"
  }
}
```

---

### 3.3 `POST /api/public/registrations/otp/verify`
Verifies the submitted 6-digit code and records the phone verification timestamp.
- Maximum 5 attempts allowed before lock out.

#### Request
```bash
curl -X POST http://localhost:3000/api/public/registrations/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+251911445566", "code": "654321"}'
```

#### Response
```json
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

---

### 3.4 `POST /api/public/contact`
Submits an inquiry directly to the administrative inbox (`contact_messages` table). Sets `status = 'new'` and `source = 'public_website'`.

#### Request
```bash
curl -X POST http://localhost:3000/api/public/contact \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Hawine Bekele",
    "email": "hawine@example.com",
    "phone": "+251922334455",
    "subject": "Membership Application Inquiry",
    "message": "Hello OHPEA, I submitted my educational credentials yesterday and wanted to follow up on the verification timeline."
  }'
```

#### Response
```json
{
  "success": true,
  "data": {
    "message": "Message received"
  }
}
```

---

### 3.5 `POST /api/public/newsletter`
Subscribes an email to the newsletter. Idempotent (`ON CONFLICT DO NOTHING`) — returns 200 without creating duplicates on repeated submissions.

Optional `language` field: `'en' | 'om' | 'am'`. Defaults to `'om'`. Invalid values return HTTP 400 with `fields.language`.

#### Request
```bash
curl -X POST http://localhost:3000/api/public/newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tourism.enthusiast@example.com",
    "name": "Tolera",
    "language": "om"
  }'
```

#### Response
```json
{
  "success": true,
  "data": {
    "message": "Subscribed"
  }
}
```
