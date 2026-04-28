# MediConsult - Medical Consultation Platform PRD

## Project Overview
Medical Doctor Consultation Platform with CRM, appointment booking, and PhonePe payment integration.

**Platform Name:** MediConsult  
**Type:** Full-stack web app (React + FastAPI + MongoDB)  
**Created:** April 2026

---

## User Personas
- **Patients:** Book appointments with specialists, make secure payments
- **Doctors:** Listed professionals (managed by admin)
- **Admin:** Platform operator managing doctors, appointments, users, and payments via CRM

---

## Core Requirements (Static)
- JWT-based authentication (email/password)
- Doctor listing with search/filter
- Appointment booking with date/time slot selection
- PhonePe payment integration (UAT/simulation mode)
- Admin CRM with full control panel
- User dashboard for appointment management

---

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - All routes in single file
- Auth: JWT Bearer tokens (localStorage)
- CORS: Open with credentials=False (Bearer token approach)
- Seed: Admin user + 5 sample doctors on startup

### Frontend (React + Tailwind)
- Design: Organic & Earthy palette (Deep Green #2C5545, Bone White #F9F9F6)
- Fonts: Outfit (headings) + Manrope (body)
- `src/pages/` - All page components
- `src/components/` - Shared components
- `src/contexts/AuthContext.js` - Global auth state
- `src/utils/api.js` - Axios instance with auth interceptor

---

## What's Been Implemented (April 2026)

### Authentication
- [x] JWT login/register with bcrypt password hashing
- [x] Admin seeding on startup (admin@platform.com / Admin@123)
- [x] Protected routes (user + admin)
- [x] Admin redirects to /admin on login

### Doctor Management
- [x] 5 sample doctors seeded (Cardiologist, Neurologist, Dermatologist, Orthopedic, Pediatrician)
- [x] Doctor listing with search
- [x] Doctor detail page with profile info
- [x] Admin CRUD (add/edit/delete) with modal form
- [x] Available time slots per doctor per date

### Appointment System
- [x] Calendar-based date selection (shadcn Calendar)
- [x] Real-time slot availability check
- [x] Appointment creation with status tracking
- [x] User dashboard with appointment history
- [x] Admin appointment management with status updates
- [x] Cancel appointments (user/admin)

### Payment Integration (PhonePe)
- [x] **PhonePe v2 OAuth API integration (Feb 2026)** - uses client_id/client_secret from PhonePe Business Dashboard
- [x] Auto-cached OAuth access_token (refreshes 2 min before expiry)
- [x] UAT sandbox live: returns real `mercury-uat.phonepe.com` checkout URLs (flip to PRODUCTION via env `PHONEPE_ENV`)
- [x] v2 status API (`/checkout/v2/order/{merchantOrderId}/status`) auto-reconciles PENDING txns
- [x] v2 webhook handles `{event, payload:{merchantOrderId, state}}` + legacy base64 format; always returns 200
- [x] Fallback simulation mode when UAT API unavailable (dev-friendly)
- [x] Payment simulation page with UPI/Card options (legacy, still usable for dev)
- [x] Transaction history in admin

### Google Social Login (Feb 2026)
- [x] Emergent-managed Google OAuth integrated via `emergentintegrations` pattern
- [x] `POST /api/auth/google` endpoint exchanges session_id -> user data via `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
- [x] Upserts user in `users` collection by email; new Google users get role=`user`
- [x] Returns app JWT (same shape as email/password login) - unified auth context
- [x] Frontend "Continue with Google" button on /login & /register
- [x] `/auth/callback` route handles `#session_id=` fragment with race-safe `useRef`
- [x] AuthContext skips `/auth/me` during OAuth callback to avoid race with cookie setting

### Admin CRM Dashboard
- [x] Stats: Total Doctors, Appointments, Patients, Revenue
- [x] Monthly Revenue Bar Chart (Recharts)
- [x] Appointment Status Pie Chart
- [x] Recent Activity Logs
- [x] Doctors tab (CRUD)
- [x] Appointments tab (view + status update)
- [x] Users tab (view all registered users)
- [x] Payments tab (transaction history)

---

## Test Credentials
- Admin: admin@platform.com / Admin@123
- Test User: testuser_api@test.com / Test@1234

## API Endpoints
All prefixed with /api:
- POST /auth/register, /auth/login, GET /auth/me
- **POST /auth/google** (NEW - Emergent OAuth session exchange)
- GET /doctors, GET /doctors/:id, GET /doctors/:id/available-slots
- POST /doctors (admin), PUT /doctors/:id (admin), DELETE /doctors/:id (admin)
- POST /appointments, GET /appointments, GET /appointments/:id
- PUT /appointments/:id (admin), DELETE /appointments/:id
- POST /payments/initiate (PhonePe v2), GET /payments/status/:txnId
- POST /payments/simulate/:txnId/success, POST /payments/simulate/:txnId/failure
- POST /payments/webhook (v2 event-based + legacy base64)
- GET /admin/stats, /admin/activity, /admin/users, /admin/transactions

---

## Prioritized Backlog

### P0 (Critical - Must Do Next)
- [x] ~~Google Social Login (Emergent-managed OAuth)~~ ✅ Done Feb 2026
- [x] ~~Real PhonePe production credentials setup~~ ✅ UAT live Feb 2026; flip PHONEPE_ENV=PRODUCTION when ready to go live

### P1 (High Priority)
- PhonePe webhook signature validation (Authorization header from PhonePe Business Dashboard) - required before PRODUCTION
- data-testid coverage for any newly added UI elements (ongoing)
- Doctor availability scheduling (set custom hours per doctor)
- Email notifications (Resend) - appointment confirmation, payment receipt [SKIPPED BY USER]
- Patient profile management (update name, phone, address)
- Appointment rescheduling
- Performance: code splitting, lazy loading, DB indexing
- Deployment configuration & README/API docs

### P2 (Nice to Have)
- Video consultation integration (Zoom/WebRTC)
- Doctor rating/review system
- Prescription notes from doctor to patient
- Automated appointment reminders (SMS via Twilio) [SKIPPED BY USER]
- Mobile-responsive PWA
- Advanced CRM analytics (patient retention, doctor performance)
- Refactor: split server.py (833 lines) into routers/auth.py, routers/payments.py, routers/admin.py
- Multi-language support (Hindi, Tamil, etc.)

---

## Next Tasks List
1. Add PhonePe webhook signature validation before PRODUCTION go-live
2. Add data-testid to any remaining UI elements
3. Performance optimization (code splitting, lazy loading, DB indexing)
4. Deployment config + README/API docs
5. Refactor server.py into modular routers
