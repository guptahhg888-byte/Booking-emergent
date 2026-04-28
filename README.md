# MediConsult

**Medical Doctor Consultation Platform** with CRM, appointment booking, and real PhonePe v2 payments.

Built with **FastAPI** (Python) + **React** + **MongoDB**, secured by **JWT** for email/password and **Emergent OAuth** for Google Social Login.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Tailwind CSS, shadcn/ui, Recharts, React Router v6 |
| Backend | FastAPI, Motor (async MongoDB), Pydantic v2 |
| Database | MongoDB |
| Auth | JWT (bcrypt) + Emergent Google OAuth |
| Payments | PhonePe v2 OAuth (UAT + Production) |

---

## Directory Layout

```
/app
├── backend/
│   ├── server.py                 # FastAPI entrypoint (~50 lines)
│   ├── seed.py                   # DB seeding + index creation
│   ├── .env                      # Environment variables
│   ├── core/
│   │   ├── config.py             # Env-loaded settings
│   │   ├── database.py           # Motor client singleton
│   │   ├── security.py           # Password hashing + JWT
│   │   ├── deps.py               # FastAPI dependencies (auth)
│   │   └── models.py             # Pydantic request models
│   ├── services/
│   │   ├── phonepe.py            # PhonePe v2 OAuth + webhook validation
│   │   └── activity.py           # Activity log writer
│   ├── routes/
│   │   ├── auth.py               # /api/auth/*
│   │   ├── doctors.py            # /api/doctors/*
│   │   ├── appointments.py       # /api/appointments/*
│   │   ├── payments.py           # /api/payments/*
│   │   └── admin.py              # /api/admin/*
│   └── tests/                    # pytest suite
└── frontend/
    └── src/
        ├── App.js                # Router with lazy-loaded pages
        ├── contexts/AuthContext.js
        ├── components/           # Navbar, ProtectedRoute, shadcn/ui
        ├── pages/                # Landing, Auth, Doctors, Booking, Dashboards…
        └── utils/api.js          # Axios with auth interceptor
```

---

## Local Setup

> Services are managed by **supervisor** in this environment. Do **not** run `uvicorn` or `yarn start` manually — they are already running with hot reload.

### Environment Variables

Create `/app/backend/.env`:

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
JWT_SECRET="<generate-a-strong-secret>"
ADMIN_EMAIL="admin@platform.com"
ADMIN_PASSWORD="Admin@123"

# PhonePe v2 (OAuth)
PHONEPE_ENV="SANDBOX"              # or "PRODUCTION"
PHONEPE_MERCHANT_ID="M23360Z1R0F5T"
PHONEPE_CLIENT_ID="M23360Z1R0F5T_2512211806"
PHONEPE_CLIENT_VERSION="1"
PHONEPE_CLIENT_SECRET="<from-phonepe-dashboard>"
PHONEPE_WEBHOOK_USERNAME=""        # set to enable webhook signature validation
PHONEPE_WEBHOOK_PASSWORD=""

FRONTEND_URL="https://<your-domain>"
BACKEND_URL="https://<your-domain>"
EMERGENT_AUTH_SESSION_URL="https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
```

Create `/app/frontend/.env`:

```
REACT_APP_BACKEND_URL=https://<your-domain>
```

### Restart

```
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

---

## API Reference

All routes are prefixed with `/api`.

### Auth — `/api/auth`

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| POST | `/register` | — | `{email, password, name, phone?}` → `{token, user}` |
| POST | `/login` | — | `{email, password}` → `{token, user}` |
| GET | `/me` | Bearer | → current user |
| POST | `/google` | — | `{session_id}` (from Emergent OAuth callback) → `{token, user}` |

### Doctors — `/api/doctors`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/` | — (public) |
| GET | `/{id}` | — |
| GET | `/{id}/available-slots?date=YYYY-MM-DD` | — |
| POST | `/` | Admin |
| PUT | `/{id}` | Admin |
| DELETE | `/{id}` | Admin |

### Appointments — `/api/appointments`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/` | User |
| GET | `/` | User (own) / Admin (all) |
| GET | `/{id}` | User (own) / Admin |
| PUT | `/{id}` | Admin |
| DELETE | `/{id}` | User (own) / Admin |

### Payments — `/api/payments`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/initiate` | User — body `{appointment_id}` → checkout URL |
| GET | `/status/{txn_id}` | — (auto-reconciles with PhonePe) |
| POST | `/webhook` | PhonePe signature-validated |
| POST | `/simulate/{txn_id}/{success\|failure}` | — (dev/UAT only) |

### Admin — `/api/admin`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/stats` | Totals + 6-month revenue chart |
| GET | `/activity` | Recent activity logs |
| GET | `/users` | All registered users |
| GET | `/transactions` | All payment transactions |

---

## PhonePe v2 — Go-Live Checklist

1. ✅ **OAuth credentials** configured in `.env` (`PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`)
2. ✅ **UAT tested** — `PHONEPE_ENV=SANDBOX` returns `mercury-uat.phonepe.com` checkout URLs
3. 🔲 **Webhook signature** — set `PHONEPE_WEBHOOK_USERNAME` + `PHONEPE_WEBHOOK_PASSWORD` to the pair configured in PhonePe Business Dashboard
4. 🔲 **Production flip** — change `PHONEPE_ENV=PRODUCTION` and obtain production credentials from PhonePe
5. 🔲 **HTTPS webhook URL** registered in PhonePe dashboard → `https://<domain>/api/payments/webhook`

---

## Testing

### Backend (pytest)

```
cd /app/backend && pytest tests/ -v
```

### End-to-end smoke test (curl)

```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d'=' -f2)

# 1. Admin login
TOKEN=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.com","password":"Admin@123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Admin stats
curl -s "$API/api/admin/stats" -H "Authorization: Bearer $TOKEN"
```

### Test Credentials

See `/app/memory/test_credentials.md`.

---

## Design

- **Palette:** Deep Green `#2C5545`, Bone White `#F9F9F6`, Terracotta accent `#D9734E`
- **Fonts:** Outfit (headings) + Manrope (body)
- **Components:** shadcn/ui primitives under `/app/frontend/src/components/ui/`

Full design tokens in `/app/design_guidelines.json`.

---

## License

Proprietary — MediConsult Platform, 2026.
