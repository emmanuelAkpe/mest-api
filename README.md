# MEST API

Backend REST API for the MEST Admin Portal. Built with Node.js, Express, and MongoDB.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MongoDB (Mongoose 8) |
| Auth | JWT (access + refresh tokens) |
| Email | Resend |
| Logging | Winston + Morgan |
| Validation | express-validator |
| Security | Helmet, CORS, bcrypt, rate limiting |

---

## Project Structure

```
src/
├── app.js                      # Express app entry point
├── config/
│   ├── db.js                   # MongoDB connection
│   └── env.js                  # Env var validation + export
├── controllers/
│   └── auth.controller.js      # Auth business logic
├── middleware/
│   ├── authenticate.js         # JWT auth + role guard
│   ├── errorHandler.js         # Global error handler
│   ├── rateLimiter.js          # Rate limit configs
│   └── validate.js             # express-validator error formatter
├── models/
│   └── Admin.model.js          # Admin Mongoose schema
├── routes/
│   └── auth.routes.js          # Auth route definitions
├── services/
│   └── email.service.js        # Resend email templates
├── utils/
│   ├── logger.js               # Winston logger
│   ├── response.js             # Standardised response helpers
│   └── tokenUtils.js           # JWT sign/verify + bcrypt token hashing
└── validators/
    └── auth.validators.js      # express-validator rule sets
```

---

## Environment Variables

All variables are required. The app exits on startup if any are missing.

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=12

CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

---

## Admin Model

| Field | Type | Notes |
|---|---|---|
| `firstName` | String | Required |
| `lastName` | String | Required |
| `email` | String | Unique, lowercased |
| `password` | String | bcrypt hashed, excluded from queries by default |
| `role` | String | `super_admin` or `program_admin` (default) |
| `isActive` | Boolean | `false` until onboarding complete |
| `lastLogin` | Date | Updated on each login |
| `refreshTokens` | [String] | Hashed; max 5 stored per admin |
| `passwordChangedAt` | Date | Used to invalidate old JWTs |
| `inviteToken` | String | Hashed; cleared on onboard |
| `inviteTokenExpiry` | Date | 72 hours from invite |
| `passwordResetToken` | String | Hashed; cleared on reset |
| `passwordResetExpiry` | Date | 1 hour from request |

---

## Authentication Flow

### Token Strategy
- **Access token** — short-lived JWT (`15m`), sent in `Authorization: Bearer <token>` header.
- **Refresh token** — longer-lived JWT (`7d`), stored as an `HttpOnly` cookie scoped to `/api/v1/auth/refresh`.
- Refresh tokens are **hashed with bcrypt** before storage. Up to **5 concurrent sessions** per admin.
- On password change or reset, all refresh tokens are **invalidated** and the cookie is cleared.
- The `authenticate` middleware checks that the token was **not issued before a password change**.

### Invite-Only Registration
Admins cannot self-register. A `super_admin` must invite them first.

```
super_admin calls POST /invite
  → Admin record created (isActive: false)
  → Invite email sent with one-time token (72h expiry)

Invited admin calls POST /onboard with token + password
  → Account activated (isActive: true)
  → Logged in immediately (tokens issued)
```

---

## API Reference

Base path: `/api/v1`

### Health Check

```
GET /health
```
Returns server status, timestamp, and environment. No authentication required.

---

### Auth Endpoints

All auth routes are under `/api/v1/auth` and share a **rate limit of 10 requests per 15 minutes** per IP.

---

#### `POST /auth/invite`
Invite a new admin. `super_admin` only.

**Headers:** `Authorization: Bearer <accessToken>`

**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "role": "program_admin"
}
```
- `role` is optional; defaults to `program_admin`. Allowed: `super_admin`, `program_admin`.

**Success `201`:**
```json
{
  "success": true,
  "data": { "id": "...", "firstName": "Jane", "lastName": "Doe", "email": "jane@example.com", "role": "program_admin" },
  "message": "Invitation sent successfully.",
  "meta": {}
}
```

**Errors:** `401` (not authenticated), `403` (not super_admin), `409` (email already in use), `422` (validation)

---

#### `POST /auth/onboard`
Complete account setup using an invite token.

**Body:**
```json
{
  "email": "jane@example.com",
  "token": "<raw invite token from email link>",
  "password": "minSixChars"
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": { "accessToken": "..." },
  "message": "Account set up successfully.",
  "meta": { "adminId": "...", "role": "program_admin" }
}
```
Sets `refreshToken` HttpOnly cookie.

**Errors:** `400` (invalid/expired token, account already active), `422` (validation)

---

#### `POST /auth/login`
Login with email and password.

**Body:**
```json
{
  "email": "jane@example.com",
  "password": "yourPassword"
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": { "accessToken": "..." },
  "message": "Login successful.",
  "meta": { "adminId": "...", "role": "program_admin" }
}
```
Sets `refreshToken` HttpOnly cookie.

**Errors:** `401` (invalid credentials or inactive account), `422` (validation)

---

#### `POST /auth/refresh`
Exchange a valid refresh token cookie for a new access token. Implements **refresh token rotation** — old token is invalidated, new one is issued. If a token is reused (possible theft), all sessions are wiped.

**Cookie required:** `refreshToken`

**Success `200`:**
```json
{
  "success": true,
  "data": { "accessToken": "..." },
  "message": "Token refreshed.",
  "meta": {}
}
```

**Errors:** `401` (missing, invalid, or already-used token)

---

#### `POST /auth/logout`
Logout current session. Removes the refresh token from the server and clears the cookie.

**Headers:** `Authorization: Bearer <accessToken>`

**Success `200`:**
```json
{
  "success": true,
  "data": {},
  "message": "Logged out successfully.",
  "meta": {}
}
```

---

#### `GET /auth/me`
Get the currently authenticated admin's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "program_admin",
    "lastLogin": "2026-03-01T12:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "message": "",
  "meta": {}
}
```

---

#### `POST /auth/forgot-password`
Request a password reset email. Always returns the same response regardless of whether the email exists (prevents user enumeration).

**Body:**
```json
{ "email": "jane@example.com" }
```

**Success `200`:**
```json
{
  "success": true,
  "data": {},
  "message": "If that email is registered, a reset link has been sent.",
  "meta": {}
}
```

---

#### `POST /auth/reset-password`
Reset password using the token from the reset email. Invalidates all active sessions.

**Body:**
```json
{
  "email": "jane@example.com",
  "token": "<raw reset token from email link>",
  "password": "newPassword"
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": {},
  "message": "Password reset successfully. Please log in again.",
  "meta": {}
}
```

**Errors:** `400` (invalid/expired token), `422` (validation)

---

#### `POST /auth/change-password`
Change password while authenticated. Invalidates all active sessions.

**Headers:** `Authorization: Bearer <accessToken>`

**Body:**
```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword"
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": {},
  "message": "Password changed successfully. Please log in again.",
  "meta": {}
}
```

**Errors:** `400` (wrong current password), `401` (not authenticated), `422` (validation)

---

#### `POST /auth/resend-invite`
Resend an invitation to a pending (not yet onboarded) admin. Generates a fresh token and resets the 72-hour expiry. `super_admin` only.

**Headers:** `Authorization: Bearer <accessToken>`

**Body:**
```json
{ "email": "jane@example.com" }
```

**Success `200`:**
```json
{
  "success": true,
  "data": {},
  "message": "Invitation resent successfully.",
  "meta": {}
}
```

**Errors:** `401` (not authenticated), `403` (not super_admin), `404` (no pending invite for email), `422` (validation)

---

## Response Shape

**Success:**
```json
{
  "success": true,
  "data": {},
  "message": "Human-readable message",
  "meta": {}
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []
  }
}
```

### Error Codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request body failed validation |
| `UNAUTHORIZED` | Missing, invalid, or expired credentials |
| `FORBIDDEN` | Authenticated but insufficient role |
| `NOT_FOUND` | Resource or route not found |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unhandled server error |
| `DUPLICATE_ENTRY` | Unique constraint violation (e.g. email) |

---

## Rate Limiting

| Limiter | Window | Max Requests | Applied To |
|---|---|---|---|
| Global | 15 min | 100 | All routes |
| Auth | 15 min | 10 | All `/api/v1/auth/*` routes |
| API | 1 min | 60 | Available for future resource routes |

---

## Logging

Winston is used for structured JSON logging with log rotation. Morgan pipes HTTP access logs through Winston.

Auth events logged: `invite_sent`, `invite_resent`, `onboard_complete`, `login_success`, `login_failed`, `token_refresh`, `logout`, `password_reset_requested`, `password_reset_complete`, `password_changed`.

Each event includes `adminId`, `email`, `ip`, and `userAgent`.

---

---

## Cohort Management

Cohorts are the top-level scoping entity. Every trainee, team, event, and evaluation belongs to a cohort.

### Cohort Model

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required. Unique per year. |
| `year` | Number | Required. e.g. `2025` |
| `description` | String | Optional. Max 500 chars. |
| `isArchived` | Boolean | Default: `false`. Set via the archive endpoint. |
| `startDate` | Date | Required. ISO 8601. |
| `endDate` | Date | Required. ISO 8601. Must be after `startDate`. |
| `createdBy` | ObjectId | Ref to Admin. |

### Status (Computed)

`status` is not stored — it is derived at read time from `startDate`, `endDate`, and `isArchived`:

| Status | Condition |
|---|---|
| `upcoming` | Today is before `startDate` |
| `active` | Today is between `startDate` and `endDate` |
| `completed` | Today is after `endDate` |
| `archived` | `isArchived` is `true` (overrides date logic) |

### Cohort Endpoints

All cohort routes require a valid `Authorization: Bearer <accessToken>` header.
Rate limit: **60 requests per minute** per IP.

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create cohort |
| GET | `/` | List cohorts (filter + paginate) |
| GET | `/:id` | Get single cohort |
| PUT | `/:id` | Update cohort (blocked if archived) |
| POST | `/:id/archive` | Archive a cohort (irreversible) |

---

#### `POST /api/v1/cohorts`
Create a new cohort.

**Body:**
```json
{
  "name": "MEST Ghana 2025",
  "year": 2025,
  "startDate": "2025-01-06",
  "endDate": "2025-12-15",
  "description": "12th cohort of the MEST Ghana program."
}
```
- `description` is optional.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "MEST Ghana 2025",
    "year": 2025,
    "description": "12th cohort of the MEST Ghana program.",
    "status": "upcoming",
    "startDate": "2025-01-06T00:00:00.000Z",
    "endDate": "2025-12-15T00:00:00.000Z",
    "createdBy": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Cohort created successfully.",
  "meta": {}
}
```

**Errors:** `400` (endDate ≤ startDate), `401`, `409` (name+year duplicate), `422` (validation)

---

#### `GET /api/v1/cohorts`
List all cohorts with optional filtering and pagination.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page, max 100 (default `20`) |
| `status` | string | Filter by computed status: `upcoming`, `active`, `completed`, `archived` |
| `year` | integer | Filter by year |

**Success `200`:**
```json
{
  "success": true,
  "data": [ { ... }, { ... } ],
  "message": "",
  "meta": { "total": 5, "page": 1, "pages": 1 }
}
```

---

#### `GET /api/v1/cohorts/:id`
Get a single cohort. `createdBy` is populated with `firstName`, `lastName`, `email`.

**Errors:** `401`, `404`

---

#### `PUT /api/v1/cohorts/:id`
Update cohort details. Blocked if the cohort is archived.

**Body** (all fields optional):
```json
{
  "name": "MEST Ghana 2025 Updated",
  "year": 2025,
  "startDate": "2025-01-13",
  "endDate": "2025-12-20",
  "description": "Updated description."
}
```

**Errors:** `400` (archived, or endDate ≤ startDate), `401`, `404`, `409` (name+year duplicate), `422`

---

#### `POST /api/v1/cohorts/:id/archive`
Archive a cohort. Irreversible. No body required.

**Success `200`:**
```json
{
  "success": true,
  "data": { "id": "...", "status": "archived", ... },
  "message": "Cohort archived successfully.",
  "meta": {}
}
```

**Errors:** `400` (already archived), `401`, `404`

---

---

## Trainee Management

Trainees are the individuals enrolled in a cohort. They are always cohort-scoped but have their own persistent profile that accumulates data (scores, teams, attendance, flags) across the program.

### Trainee Model

| Field | Type | Notes |
|---|---|---|
| `cohort` | ObjectId | Ref to Cohort. Required. |
| `firstName` | String | Required. |
| `lastName` | String | Required. |
| `email` | String | Required. Globally unique. |
| `country` | String | Required. |
| `photo` | String | Optional. URL. |
| `bio` | String | Optional. Max 1000 chars. |
| `technicalBackground` | String | `none` \| `basic` \| `intermediate` \| `advanced`. Default: `none`. |
| `aiSkillLevel` | String | `none` \| `basic` \| `intermediate` \| `advanced`. Default: `none`. |
| `linkedIn` | String | Optional. URL. |
| `github` | String | Optional. URL. |
| `portfolio` | String | Optional. URL. |
| `entryScore` | Number | Optional. 0–100. |
| `notes` | String | Optional. Internal only. Max 2000 chars. Not returned on list. |
| `isActive` | Boolean | Default: `true`. |

### Trainee Endpoints

All routes require `Authorization: Bearer <accessToken>`. Rate limit: **60 req/min**.

#### Cohort-scoped routes — `/api/v1/cohorts/:cohortId/trainees`

---

#### `POST /api/v1/cohorts/:cohortId/trainees`
Add a trainee to a cohort. Blocked if the cohort is archived.

**Body:**
```json
{
  "firstName": "Kwame",
  "lastName": "Mensah",
  "email": "kwame@example.com",
  "country": "Ghana",
  "technicalBackground": "intermediate",
  "aiSkillLevel": "basic",
  "entryScore": 78,
  "bio": "Passionate about fintech solutions for West Africa.",
  "linkedIn": "https://linkedin.com/in/kwamemensah",
  "github": "https://github.com/kwame",
  "notes": "Strong communicator. Watch for team lead potential."
}
```
Required: `firstName`, `lastName`, `email`, `country`. All others optional.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "cohort": "...",
    "firstName": "Kwame",
    "lastName": "Mensah",
    "email": "kwame@example.com",
    "country": "Ghana",
    "technicalBackground": "intermediate",
    "aiSkillLevel": "basic",
    "entryScore": 78,
    "notes": "Strong communicator. Watch for team lead potential.",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Trainee added successfully.",
  "meta": {}
}
```

**Errors:** `400` (archived cohort), `401`, `404` (cohort not found), `409` (email duplicate), `422` (validation)

---

#### `GET /api/v1/cohorts/:cohortId/trainees`
List all trainees in a cohort.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page, max 100 (default `20`) |
| `search` | string | Searches `firstName`, `lastName`, and `email` (case-insensitive) |
| `country` | string | Filter by country (case-insensitive) |

**Success `200`:**
```json
{
  "success": true,
  "data": [ { ... }, { ... } ],
  "message": "",
  "meta": { "total": 12, "page": 1, "pages": 1 }
}
```
Note: `notes` field is excluded from list responses.

---

#### Individual routes — `/api/v1/trainees`

---

#### `GET /api/v1/trainees/:id`
Get a single trainee's full profile. Includes `notes` and populated `cohort` (name, year, status).

**Errors:** `401`, `404`

---

#### `PUT /api/v1/trainees/:id`
Update a trainee's profile. All fields optional.

**Body** (any subset):
```json
{
  "country": "Nigeria",
  "entryScore": 85,
  "technicalBackground": "advanced",
  "isActive": false
}
```

**Errors:** `401`, `404`, `409` (email duplicate), `422` (validation)

---

## Event Management

Events are the activities that generate scores, teams, feedback, and attendance records. Everything downstream (KPIs, evaluations, teams) is event-scoped.

### Event Model

| Field | Type | Notes |
|---|---|---|
| `cohort` | ObjectId | Ref to Cohort. Required. |
| `name` | String | Required. |
| `type` | String | Required. See types below. |
| `description` | String | Optional. Max 2000 chars. |
| `startDate` | Date | Required. ISO 8601. |
| `endDate` | Date | Required. Must be after `startDate`. |
| `createdBy` | ObjectId | Ref to Admin. |

**Event types:** `startup_build` · `newco` · `class_workshop` · `internal_review` · `demo_pitch_day` · `other`

### Status (Computed)

`status` is not stored — it is derived at read time from `startDate` and `endDate`:

| Status | Condition |
|---|---|
| `not_started` | Today is before `startDate` |
| `in_progress` | Today is between `startDate` and `endDate` |
| `completed` | Today is after `endDate` |

### Event Endpoints

All routes require `Authorization: Bearer <accessToken>`. Rate limit: **60 req/min**.

#### Cohort-scoped routes — `/api/v1/cohorts/:cohortId/events`

---

#### `POST /api/v1/cohorts/:cohortId/events`
Create an event in a cohort. Blocked if the cohort is archived.

**Body:**
```json
{
  "name": "Startup Build 1",
  "type": "startup_build",
  "startDate": "2025-02-01",
  "endDate": "2025-04-30",
  "description": "First startup build cycle. Teams form and build an MVP over 3 months."
}
```
Required: `name`, `type`, `startDate`, `endDate`. `description` is optional.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "cohort": "...",
    "name": "Startup Build 1",
    "type": "startup_build",
    "description": "First startup build cycle...",
    "startDate": "2025-02-01T00:00:00.000Z",
    "endDate": "2025-04-30T00:00:00.000Z",
    "status": "not_started",
    "createdBy": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Event created successfully.",
  "meta": {}
}
```

**Errors:** `400` (archived cohort, or endDate ≤ startDate), `401`, `404` (cohort not found), `422` (validation)

---

#### `GET /api/v1/cohorts/:cohortId/events`
List all events in a cohort, sorted by `startDate` ascending.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page, max 100 (default `20`) |
| `type` | string | Filter by type: `startup_build`, `newco`, `class_workshop`, `internal_review`, `demo_pitch_day`, `other` |
| `status` | string | Filter by computed status: `not_started`, `in_progress`, `completed` |

**Success `200`:**
```json
{
  "success": true,
  "data": [ { ... }, { ... } ],
  "message": "",
  "meta": { "total": 4, "page": 1, "pages": 1 }
}
```

---

#### Individual routes — `/api/v1/events`

---

#### `GET /api/v1/events/:id`
Get a single event. `cohort` is populated with `name`, `year`, `isArchived`. `createdBy` populated with `firstName`, `lastName`, `email`.

**Errors:** `401`, `404`

---

#### `PUT /api/v1/events/:id`
Update event details. Blocked if the event status is `completed`.

**Body** (all fields optional):
```json
{
  "name": "Startup Build 1 — Revised",
  "endDate": "2025-05-15",
  "description": "Extended by two weeks."
}
```

**Errors:** `400` (completed event, or endDate ≤ startDate), `401`, `404`, `422`

---

## Team Management

Teams are event-scoped groups of trainees that build products and get evaluated. They hold the pivot history and member composition across an event's lifecycle.

### Team Model

| Field | Type | Notes |
|---|---|---|
| `cohort` | ObjectId | Ref to Cohort. Stored for flat cohort-level queries. |
| `event` | ObjectId | Ref to Event. Required. |
| `parentTeam` | ObjectId | Optional ref to a previous Team (lineage tracking). |
| `name` | String | Required. |
| `productIdea` | String | Optional. Max 500 chars. |
| `marketFocus` | String | Optional. Max 500 chars. |
| `members` | Array | See member structure below. |
| `pivots` | Array | Append-only pivot log. See pivot structure below. |
| `isDissolved` | Boolean | Default: `false`. Set via dissolve endpoint. |
| `createdBy` | ObjectId | Ref to Admin. |

**Member structure:**
```json
{ "trainee": "<ObjectId>", "roles": ["team_lead", "presenter"] }
```
Roles are an array — one member can hold multiple roles simultaneously.

**Available roles:** `team_lead` · `cto` · `product` · `business` · `design` · `marketing` · `finance` · `data_ai` · `presenter`

**Pivot structure:**
```json
{
  "type": "product_idea",
  "description": "Shifted from B2C to B2B SaaS model.",
  "reason": "Customer discovery revealed enterprises have more budget.",
  "wasProactive": true,
  "loggedBy": "<AdminId>",
  "createdAt": "..."
}
```
**Pivot types:** `product_idea` · `target_market` · `business_model` · `technical_approach` · `multiple`

### Status (Computed)

| Status | Condition |
|---|---|
| `not_started` | Event hasn't started yet |
| `active` | Event is currently in progress |
| `completed` | Event has ended |
| `dissolved` | `isDissolved` is `true` (overrides date logic) |

### Team Endpoints

All routes require `Authorization: Bearer <accessToken>`. Rate limit: **60 req/min**.

#### Event-scoped routes — `/api/v1/events/:eventId/teams`

---

#### `POST /api/v1/events/:eventId/teams`
Create a team in an event. Blocked if the event is completed or the cohort is archived.

**Body:**
```json
{
  "name": "Team Alpha",
  "productIdea": "AI-powered livestock management for smallholder farmers.",
  "marketFocus": "West Africa rural agri-sector",
  "parentTeam": "<optional — previous team ID for lineage>",
  "members": [
    { "trainee": "<id>", "roles": ["team_lead", "presenter"] },
    { "trainee": "<id>", "roles": ["cto"] },
    { "trainee": "<id>", "roles": ["product", "business"] }
  ]
}
```
Required: `name`. All others optional.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "cohort": "...",
    "event": "...",
    "parentTeam": null,
    "name": "Team Alpha",
    "productIdea": "AI-powered livestock management...",
    "marketFocus": "West Africa rural agri-sector",
    "members": [ { "trainee": "...", "roles": ["team_lead", "presenter"] }, ... ],
    "pivots": [],
    "isDissolved": false,
    "status": "not_started",
    "createdBy": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Team created successfully.",
  "meta": {}
}
```

**Errors:** `400` (completed event, archived cohort, duplicate trainee in request, invalid trainee ID), `404` (event not found), `409` (trainee already on another team in this event)

---

#### `GET /api/v1/events/:eventId/teams`
List all teams in an event. Member names populated.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page, max 100 (default `20`) |

---

#### Individual routes — `/api/v1/teams`

---

#### `GET /api/v1/teams/:id`
Get full team profile. Populates: `event`, `cohort`, `members.trainee` (full profile), `parentTeam`, `createdBy`, `pivots.loggedBy`.

**Errors:** `401`, `404`

---

#### `PUT /api/v1/teams/:id`
Update team. Blocked if dissolved. Member validations re-run if members are updated.

**Body** (all fields optional):
```json
{
  "name": "Team Alpha Revised",
  "productIdea": "Updated product idea.",
  "members": [
    { "trainee": "<id>", "roles": ["cto", "data_ai"] }
  ]
}
```

**Errors:** `400` (dissolved, duplicate trainee, invalid ID), `404`, `409` (trainee conflict), `422`

---

#### `POST /api/v1/teams/:id/dissolve`
Dissolve a team. Irreversible. No body required.

**Success `200`:**
```json
{
  "success": true,
  "data": { "id": "...", "isDissolved": true, "status": "dissolved", ... },
  "message": "Team dissolved.",
  "meta": {}
}
```

**Errors:** `400` (already dissolved), `401`, `404`

---

#### `POST /api/v1/teams/:id/pivots`
Log a pivot for a team. Appended to the pivot history — entries are immutable. Blocked if team is dissolved.

**Body:**
```json
{
  "type": "target_market",
  "description": "Shifted focus from retail consumers to enterprise clients.",
  "reason": "SME segment showed stronger willingness to pay.",
  "wasProactive": true
}
```
Required: `type`, `description`. `reason` and `wasProactive` are optional.

**Success `201`:**
```json
{
  "success": true,
  "data": { "id": "...", "pivots": [ { ... } ], ... },
  "message": "Pivot logged.",
  "meta": {}
}
```

**Errors:** `400` (dissolved team), `401`, `404`, `422`

---

## KPI Management

KPIs define the scoring dimensions for an event. Facilitators build them freely per event — name, weight, scale, and scope are all configurable. Weights are stored as raw numbers and normalized to percentages at read time, so the distribution updates automatically as KPIs are added or removed.

### KPI Model

| Field | Type | Notes |
|---|---|---|
| `event` | ObjectId | Ref to Event. Required. |
| `name` | String | Required. |
| `description` | String | Optional. Max 500 chars. Shown to evaluators during scoring. |
| `weight` | Number | Required. Raw number — normalized at read time. |
| `scaleType` | String | Required. See scale types below. |
| `scaleMin` | Number | Required when `scaleType` is `custom`. |
| `scaleMax` | Number | Required when `scaleType` is `custom`. Must be > `scaleMin`. |
| `appliesTo` | String | `team` \| `individual` \| `both`. Default: `team`. |
| `requireComment` | Boolean | Default: `false`. |
| `showRecommendation` | Boolean | Default: `false`. Shows improvement recommendation field to evaluators. |
| `order` | Number | Display order (ascending). Auto-set to count+1 if not provided. |
| `createdBy` | ObjectId | Ref to Admin. |

**Scale types:**

| Type | Score Range |
|---|---|
| `1_to_5` | 1 – 5 |
| `1_to_10` | 1 – 10 |
| `percentage` | 0 – 100 |
| `custom` | `scaleMin` – `scaleMax` (defined per KPI) |

**Weight normalization:** Every list/create/update/delete response includes `weightNormalized` on each KPI (percentage of total weight) and `meta.totalWeight` (sum of raw weights). This powers the weight distribution visualizer without any stored computation.

### KPI Endpoints

All routes require `Authorization: Bearer <accessToken>`. Rate limit: **60 req/min**.

#### Event-scoped routes — `/api/v1/events/:eventId/kpis`

---

#### `GET /api/v1/events/:eventId/kpis`
List all KPIs for an event, sorted by `order` then `createdAt`.

**Success `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Problem-Solution Fit",
      "description": "Does the solution effectively address the stated problem?",
      "weight": 30,
      "weightNormalized": 37.5,
      "scaleType": "1_to_10",
      "scaleMin": null,
      "scaleMax": null,
      "appliesTo": "team",
      "requireComment": true,
      "showRecommendation": false,
      "order": 1
    }
  ],
  "message": "",
  "meta": { "total": 4, "totalWeight": 80 }
}
```

---

#### `POST /api/v1/events/:eventId/kpis`
Add a KPI to the event. Returns the full updated KPI list with recalculated `weightNormalized` for all KPIs.

**Body:**
```json
{
  "name": "Technical Execution",
  "description": "Has the team built something real and functional?",
  "weight": 25,
  "scaleType": "1_to_10",
  "appliesTo": "team",
  "requireComment": false,
  "order": 2
}
```
Required: `name`, `weight`, `scaleType`. For `scaleType: "custom"`, `scaleMin` and `scaleMax` are also required.

**Success `201`:** Returns the full event KPI list (same shape as GET).

**Errors:** `400` (missing custom scale bounds, or scaleMax ≤ scaleMin), `401`, `404` (event not found), `422`

---

#### Individual routes — `/api/v1/kpis`

---

#### `PUT /api/v1/kpis/:id`
Update a KPI. Returns the full updated KPI list for the event with recalculated weights.

**Body** (all fields optional):
```json
{
  "weight": 20,
  "requireComment": true,
  "order": 3
}
```

**Errors:** `400` (custom scale validation), `401`, `404`, `422`

---

#### `DELETE /api/v1/kpis/:id`
Delete a KPI. Returns the remaining KPI list with recalculated weights.

**Success `200`:** Returns remaining event KPI list.

**Errors:** `401`, `404`

---

## Evaluations (Scoring Engine)

Evaluations are the mechanism by which judges score teams against KPIs. The flow:

```
Admin creates evaluation link for a judge
  → Link contains assigned teams + an expiry date/time
  → Raw token returned once — admin copies URL: {FRONTEND_URL}/evaluate/{token}

Judge opens the link (no login required)
  → Gets event info, assigned teams, KPIs, and any existing scores
  → Link status updated to 'opened'

Judge fills scores per team per KPI and submits
  → Link status updated to 'submitted'
  → Scores are updateable until the link expires

Admin views aggregated results
  → Per-team, per-KPI averages across all submitted evaluations
  → Divergence flagged when evaluators disagree significantly
```

### Models

#### EvaluationLink

| Field | Type | Notes |
|---|---|---|
| `event` | ObjectId | Ref to Event. Required. |
| `evaluatorName` | String | Required. |
| `evaluatorEmail` | String | Optional. |
| `teams` | [ObjectId] | Ref to Team. At least 1 required. |
| `tokenHash` | String | SHA-256 hash of raw token. Never returned. |
| `status` | String | `not_opened` → `opened` → `submitted`. Auto-updated. |
| `expiresAt` | Date | Required. Must be in the future. |
| `isRevoked` | Boolean | Default: `false`. Set via revoke endpoint. |
| `createdBy` | ObjectId | Ref to Admin. |

#### EvaluationSubmission

One document per link (unique on `link`). Updated in place on re-submission.

| Field | Type | Notes |
|---|---|---|
| `link` | ObjectId | Ref to EvaluationLink. Unique. |
| `event` | ObjectId | Ref to Event. Stored for efficient querying. |
| `evaluatorName` | String | Denormalized from link at submit time. |
| `evaluatorEmail` | String | Denormalized from link at submit time. |
| `teamScores` | Array | See structure below. |
| `submittedAt` | Date | Set on each submission. |

**teamScores structure:**
```json
{
  "team": "<ObjectId>",
  "overallComment": "Strong pitch, clear market understanding.",
  "scores": [
    {
      "kpi": "<ObjectId>",
      "score": 8.5,
      "comment": "Solid validation approach.",
      "recommendation": "Consider expanding to East Africa."
    }
  ]
}
```

### Token Security

Evaluation tokens use **SHA-256 hashing** (not bcrypt). Many judges may hit the same endpoint simultaneously at a pitch day — bcrypt's intentional slowness (~100ms) would stack poorly. SHA-256 is instant and still secure given the 32-byte random token (64-char hex).

Invite/reset tokens keep bcrypt because they are low-volume, high-security operations.

### Admin Endpoints

All routes require `Authorization: Bearer <accessToken>`. Rate limit: **60 req/min**.

#### Event-scoped routes — `/api/v1/events/:eventId/evaluation-links`

---

#### `POST /api/v1/events/:eventId/evaluation-links`
Generate a new evaluation link for a judge.

**Body:**
```json
{
  "evaluatorName": "Dr. Abena Owusu",
  "evaluatorEmail": "abena@mentor.org",
  "teams": ["<teamId>", "<teamId>"],
  "expiresAt": "2026-03-15T18:00:00.000Z"
}
```
Required: `evaluatorName`, `teams`, `expiresAt`. `evaluatorEmail` is optional.

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "evaluatorName": "Dr. Abena Owusu",
    "evaluatorEmail": "abena@mentor.org",
    "teams": ["...", "..."],
    "status": "not_opened",
    "expiresAt": "2026-03-15T18:00:00.000Z",
    "isRevoked": false,
    "token": "<64-char hex — only shown once>",
    "createdAt": "..."
  },
  "message": "Evaluation link created. Save the token — it will not be shown again."
}
```

**Errors:** `400` (team not in this event, expiresAt in the past), `401`, `404` (event not found), `422` (validation)

---

#### `GET /api/v1/events/:eventId/evaluation-links`
List all evaluation links for an event, sorted newest first. Teams populated with `name`. Token is never returned.

**Success `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "evaluatorName": "Dr. Abena Owusu",
      "teams": [{ "id": "...", "name": "Team Alpha" }],
      "status": "submitted",
      "expiresAt": "...",
      "isRevoked": false
    }
  ],
  "meta": { "total": 5 }
}
```

---

#### `GET /api/v1/events/:eventId/evaluation-links/results`
Aggregated scoring results for the event. Only non-revoked, submitted evaluations are included.

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "event": { "id": "...", "name": "Demo Day", "type": "demo_pitch_day" },
    "evaluatorCount": 4,
    "meta": { "linksIssued": 6, "submitted": 4 },
    "teamResults": [
      {
        "teamId": "...",
        "teamName": "Team Alpha",
        "overallAvg": 7.8,
        "kpis": [
          {
            "kpiId": "...",
            "kpiName": "Problem-Solution Fit",
            "weight": 30,
            "scaleType": "1_to_10",
            "avgScore": 8.25,
            "scoreCount": 4,
            "divergent": false,
            "entries": [
              { "evaluatorName": "Dr. Abena Owusu", "score": 8, "comment": "Strong fit.", "recommendation": null }
            ]
          }
        ]
      }
    ]
  }
}
```

**Divergence flag:** A KPI score set is flagged `divergent: true` when the standard deviation across evaluator scores exceeds 20% of the KPI's scale range (e.g. > 2 on a 1–10 scale). Requires at least 2 evaluators.

---

#### Individual routes — `/api/v1/evaluation-links`

---

#### `DELETE /api/v1/evaluation-links/:id`
Revoke an evaluation link. The judge can no longer access or submit via this link. Irreversible.

**Success `200`:**
```json
{
  "success": true,
  "data": { "id": "...", "isRevoked": true, ... },
  "message": "Evaluation link revoked."
}
```

**Errors:** `400` (already revoked), `401`, `404`

---

### Public Endpoints (No Authentication)

Mounted at `/api/v1/evaluate`. Global rate limit (100/15min) applies.

---

#### `GET /api/v1/evaluate/:token`
Fetch the evaluation form for a judge. Validates the token and returns everything needed to render the scoring UI.

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "evaluatorName": "Dr. Abena Owusu",
    "canUpdate": true,
    "event": { "id": "...", "name": "Demo Day", "type": "demo_pitch_day", "startDate": "...", "endDate": "..." },
    "teams": [
      {
        "_id": "...",
        "name": "Team Alpha",
        "members": [...]
      }
    ],
    "kpis": [
      {
        "id": "...",
        "name": "Problem-Solution Fit",
        "description": "Does the solution address a real problem?",
        "weight": 30,
        "scaleType": "1_to_10",
        "scaleMin": null,
        "scaleMax": null,
        "requireComment": true,
        "showRecommendation": false,
        "order": 1
      }
    ],
    "existingSubmission": null
  }
}
```

On subsequent visits after submission, `existingSubmission` contains the previously submitted scores so the judge sees pre-filled values.

**Errors:** `404` (token not found), `403` (revoked or expired)

---

#### `POST /api/v1/evaluate/:token`
Submit or update scores. All teams assigned to the link and all event KPIs must be covered.

**Body:**
```json
{
  "teamScores": [
    {
      "team": "<teamId>",
      "overallComment": "Impressive execution and market understanding.",
      "scores": [
        {
          "kpi": "<kpiId>",
          "score": 8,
          "comment": "Clear validation with real customers.",
          "recommendation": "Expand to B2B segment."
        }
      ]
    }
  ]
}
```

**Validation rules:**
- All teams from the link must be present in `teamScores`
- No extra teams allowed
- All KPIs for the event must have a score for each team
- Score must be within the KPI's valid range
- `comment` required if `KPI.requireComment === true`
- `overallComment` required for each team

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "submissionId": "...",
    "submittedAt": "2026-03-10T14:32:00.000Z",
    "evaluatorName": "Dr. Abena Owusu",
    "teamCount": 3
  },
  "message": "Evaluation submitted successfully."
}
```

**Errors:** `400` (missing team, missing KPI score, score out of range, missing required comment), `403` (revoked or expired), `404` (token not found), `422` (validation)

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Start production server
npm start
```
