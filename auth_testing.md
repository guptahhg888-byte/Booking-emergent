# Auth-Gated App Testing Playbook (Emergent Google OAuth)

This app uses a **hybrid auth** model:
- Email/password registration & login → returns a custom JWT (stored in `localStorage` as `mediconsult_token`).
- Google Social Login via Emergent OAuth → after the callback, the backend creates/finds the user in `users` collection and returns the same JWT. The frontend stores it in `mediconsult_token`.

Both flows end up with a Bearer token sent as `Authorization: Bearer <jwt>` to the FastAPI backend.

## Google OAuth Flow
1. User clicks "Continue with Google" on `/login`.
2. Frontend redirects to `https://auth.emergentagent.com/?redirect=<origin>/auth/callback`.
3. User returns to `/auth/callback#session_id=<id>`.
4. Frontend extracts `session_id`, POSTs it to `/api/auth/google`.
5. Backend calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with `X-Session-ID`.
6. Backend upserts user by email (role=`user`) and returns `{token, user}`.
7. Frontend stores JWT and navigates to `/dashboard`.

## Step 1 - Create Test User via JWT (No Google required)
```
mongosh --eval "use('test_database'); db.users.insertOne({email: 'testuser@example.com', name: 'Test User', role: 'user', password_hash: '\$2b\$12\$fake', created_at: new Date()})"
```
For automated testing, register a user using `/api/auth/register` and use the returned JWT.

## Step 2 - Test Backend API
```
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" -H "Authorization: Bearer <jwt>"
```

## Step 3 - Browser testing Google flow
Since Emergent Google OAuth requires a real Google account, test UI only:
- Visit `/login`, verify "Continue with Google" button exists and redirects to `auth.emergentagent.com`.
- The `/auth/callback` route handles `#session_id=...` fragment.

## Checklist
- Bearer JWT returned from both `/api/auth/login` and `/api/auth/google`
- Same user record if same email used in both flows
- `/api/auth/me` returns user for JWT
- Google button visible on `/login` and `/register`
- `/auth/callback` route responds
