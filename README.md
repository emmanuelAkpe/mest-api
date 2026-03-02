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

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Start production server
npm start
```
