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
- [x] PhonePe UAT API integration with X-VERIFY hash
- [x] Automatic fallback to simulation mode when UAT unavailable
- [x] Payment simulation page with UPI/Card options
- [x] Payment status tracking
- [x] Transaction history in admin
- [x] Webhook endpoint for real PhonePe callbacks

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
- GET /doctors, GET /doctors/:id, GET /doctors/:id/available-slots
- POST /doctors (admin), PUT /doctors/:id (admin), DELETE /doctors/:id (admin)
- POST /appointments, GET /appointments, GET /appointments/:id
- PUT /appointments/:id (admin), DELETE /appointments/:id
- POST /payments/initiate, GET /payments/status/:txnId
- POST /payments/simulate/:txnId/success, POST /payments/simulate/:txnId/failure
- POST /payments/webhook
- GET /admin/stats, /admin/activity, /admin/users, /admin/transactions

---

## Prioritized Backlog

### P0 (Critical - Must Do Next)
- Google Social Login (Emergent-managed OAuth) - user requested
- Real PhonePe production credentials setup

### P1 (High Priority)
- Doctor availability scheduling (set custom hours per doctor)
- Email notifications (Resend) - appointment confirmation, payment receipt
- Patient profile management (update name, phone, address)
- Appointment rescheduling

### P2 (Nice to Have)
- Video consultation integration (Zoom/WebRTC)
- Doctor rating/review system
- Prescription notes from doctor to patient
- Automated appointment reminders (SMS via Twilio)
- Mobile-responsive PWA
- Advanced CRM analytics (patient retention, doctor performance)
- Multi-language support (Hindi, Tamil, etc.)

---

## Next Tasks List
1. Integrate Google OAuth (Emergent-managed) for social login
2. Connect real PhonePe production credentials when available
3. Add Resend email notifications for appointment confirmation
4. Implement doctor profile editing (for doctors themselves)
5. Add pagination to admin tables for scale
