# Room Booking System — Concurrency-Safe Booking API

A REST API for booking college club rooms, built with **Node.js, Express and PostgreSQL**.

The core problem it solves: when many students try to book the same room at the same moment, **exactly one booking must succeed**. The API guarantees this with PostgreSQL transactions and row-level locks, and a test script proves it by firing parallel requests at the running server.

## Highlights

- **No double-booking under concurrency.** Check-and-insert runs inside one transaction with `SELECT ... FOR UPDATE` locks, acquired in a fixed order so transactions cannot deadlock.
- **Race-condition test suite.** 8 scenarios send simultaneous requests and assert on the outcome (e.g. 5 parallel requests for one slot → exactly one `201`, four `409`).
- **Auth.** bcrypt password hashing, OTP email verification, JWT access tokens (1-hour expiry), role-based access (`student` / `admin`).
- **Security.** Ownership checks against IDOR, generic login errors against user enumeration, parameterized queries throughout.
- **Audit trail.** Every booking records who created it (`created_by_role`) and who cancelled it (`performed_by`).
- **Versioned schema.** All schema changes go through `node-pg-migrate` migrations, each with a working `down`.

## Tech stack

Node.js · Express 5 · PostgreSQL · `pg` · `node-pg-migrate` · `express-validator` · `jsonwebtoken` · `bcrypt` · Nodemailer

## How a booking request works

```
POST /booking
 ├─ verifyToken          → who is calling, and their role
 ├─ bookingValidators    → time rules (see below), no DB access
 └─ transaction
     ├─ BEGIN
     ├─ [students only] SELECT ... FROM users WHERE id = $1 FOR UPDATE
     │                  → serializes requests from the same student
     ├─ [students only] reject if the student already has an active booking
     ├─ SELECT ... FROM rooms WHERE id = $1 FOR UPDATE
     │                  → serializes requests for the same room
     ├─ reject if the room is missing / inactive / overlapping a confirmed booking
     ├─ INSERT booking
     └─ COMMIT   (ROLLBACK on every early return and on error)
```

**Why no deadlock is possible:** only the student create path holds two locks, and it always takes them in the same order (user → room). Every other transaction holds a single lock. With one fixed order, no cycle of waiting transactions can form.

## Booking rules

| Rule | Student | Admin |
|---|---|---|
| 8:00–18:00 IST window, start and end on the same day | ✅ | ✅ |
| Start in the future, at most 7 days ahead | ✅ | ✅ |
| Minimum 10 minutes | ✅ | ✅ |
| Maximum 2 hours | ✅ | — |
| One active booking at a time | ✅ | — (admins block rooms for maintenance) |
| No overlap with a confirmed booking | ✅ | ✅ |
| Cancel only own bookings | ✅ | in progress: admins can cancel any booking |

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | — | Register; sends an OTP by email |
| POST | `/verify-otp` | — | Verify email with the OTP |
| POST | `/resend-otp` | — | Send a new OTP |
| POST | `/login` | — | Returns a JWT (1-hour expiry) |
| POST | `/firstadmin` | user | Promote yourself to admin; disabled once any admin exists |
| POST | `/change-role` | admin | Promote/demote a user; the last admin cannot be demoted |
| GET | `/rooms` | user | List rooms |
| POST | `/rooms` | admin | Create a room |
| PATCH | `/rooms/:id` | admin | Update a room (e.g. mark inactive) |
| POST | `/booking` | user | Book a room (`room_id`, `start_time`, `end_time` in ISO 8601 with offset) |
| PATCH | `/booking/:id/cancel` | user | Cancel a booking |

Errors return `{ "error": "<message>" }` with the matching status code (`400` validation, `401/403` auth, `404` not found, `409` conflict).

## Data model

- **users** — `email` (unique), `password_hash`, `role` (`student` / `admin`), `is_verified`, `promoted_by`, `promoted_at`
- **rooms** — `name` (unique), `status` (`active` / `inactive`)
- **bookings** — `room_id` → rooms, `user_id` → users, `start_time`, `end_time`, `status` (`confirmed` / `cancelled`), `created_by_role`, `performed_by` → users

`CHECK` constraints enforce valid statuses, roles and `end_time > start_time`. `status` and `created_by_role` have **no defaults** on purpose: an insert that forgets them fails loudly instead of silently writing a wrong value.

## Getting started

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
git clone https://github.com/harshchitti/node-backend-journey.git
cd node-backend-journey
npm install
cp .env.example .env      # then fill in your values
npm run migrate up        # creates all tables
node app.js               # server on http://localhost:3000
```

`.env` values:

```
PORT=3000
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cdu_room_booking
DATABASE_URL=postgres://postgres:your_password@localhost:5432/cdu_room_booking
JWT_SECRET=a_long_random_string
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
TOKEN_A=   # JWTs of three verified student accounts, used by race-test.js
TOKEN_B=
TOKEN_C=
```

First run: sign up and verify a user, log in, call `POST /firstadmin` to make that user the admin, then create rooms with `POST /rooms`.

## Running the concurrency tests

1. Start the server: `node app.js`
2. Make sure at least 2 rooms are `active`.
3. Log in as three verified students and put their tokens in `TOKEN_A`, `TOKEN_B`, `TOKEN_C` (tokens expire after 1 hour).
4. In a second terminal: `node race-test.js`

```
PASS - 1. same room, same slot, 3 different users | got 409,201,409 | expected {"201":1,"409":2}
PASS - 2. same user, two different rooms, same time | got 201,409 | expected {"201":1,"409":1}
PASS - 3. same room, partially overlapping slots | got 201,409 | expected {"201":1,"409":1}
PASS - 4. same room, back-to-back slots (both must succeed) | got 201,201 | expected {"201":2,"409":0}
PASS - 5. different rooms, different users (both must succeed) | got 201,201 | expected {"201":2,"409":0}
PASS - 6. same user, 5 identical requests | got 201,409,409,409,409 | expected {"201":1,"409":4}
PASS - 7. two cancels of the same booking | got 200,200 | row is cancelled
PASS - 8. cancel vs rebook x10 | rebooked 4, blocked 6, bad 0
```

The suite is safe to run repeatedly against the same server; a connection leak would show up as a hang on the second run.

## Design decisions and trade-offs

- **Row locks instead of a unique constraint or retries.** Overlap is a range condition, which a plain unique index can't express. Locking the room row makes concurrent requests for that room wait in line, so the overlap check always sees committed data.
- **`pool.connect()` sits outside `try`.** If acquiring a connection fails there is nothing to release; `client.release()` in `finally` then always has a valid client. A bug here once leaked a connection on every request: the responses were correct, so the tests passed until the 10-connection pool ran dry.
- **Admin blocks don't override student bookings.** An admin cancels conflicting bookings first, then blocks the slot. This keeps every transaction to a single lock, at the cost of a small window where a student could grab the freed slot (the admin then gets a `409` and retries).
- **Role is read from the JWT.** A demoted admin keeps admin access until their token expires (at most 1 hour). Accepted because role changes are rare; the fix would be re-reading the role from the database on admin-only routes.
- **`performed_by` means "cancelled by".** It is `NULL` until a booking is cancelled, then holds the canceller's id. It is written only on the confirmed → cancelled transition, so a second cancel can't overwrite who did it.

## Roadmap

- [ ] Admins cancel any booking (audit via `performed_by`)
- [ ] Availability endpoint for a room and date
- [ ] Index on `bookings (room_id, start_time)` for the overlap query
- [ ] Deployment
- [ ] Rate limiting on auth routes

## Project structure

```
app.js                  Express app, routers, central error handler
db.js                   PostgreSQL connection pool
mailer.js               Nodemailer transport for OTP emails
routes/                 auth.js, rooms.js, booking.js
middleware/             verifyToken.js, requireAdmin.js, bookingValidators.js
migrations/             versioned schema changes (node-pg-migrate)
race-test.js            concurrency test suite
```