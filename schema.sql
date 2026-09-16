-- ============================================
-- College Club Room Booking System — Schema
-- Designed Week 1, Day 6
-- ============================================

-- USERS
-- Every person who signs up — students by default, admins after promotion
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,               -- auto-incrementing unique identifier for each user
    name           VARCHAR(100) NOT NULL,             -- user's display name, required
    email          VARCHAR(255) NOT NULL UNIQUE,       -- login identifier, must be unique, required
    password_hash  VARCHAR(255) NOT NULL,             -- bcrypt-hashed password, never store plain text
    role           VARCHAR(20) NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student', 'admin')), -- restricts role to exactly these two values; defaults every new signup to 'student'
    is_verified    BOOLEAN NOT NULL DEFAULT false,     -- true once the user confirms their email
    promoted_by    INT REFERENCES users(id),           -- id of the admin who promoted this user to admin (NULL if never promoted) — self-referencing foreign key
    promoted_at    TIMESTAMPTZ                         -- when the promotion happened (NULL if never promoted)
);

-- ROOMS
-- Club activity rooms that can be booked
CREATE TABLE rooms (
    id             SERIAL PRIMARY KEY,               -- auto-incrementing unique identifier for each room
    name           VARCHAR(100) UNIQUE NOT NULL,       -- room name, must be unique, required
    status         VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')) -- restricts status to exactly these two values; defaults new rooms to 'active'
);

-- BOOKINGS
-- A specific time slot reserved by a student (or blocked by an admin) in a room
CREATE TABLE bookings (
    id                SERIAL PRIMARY KEY,             -- auto-incrementing unique identifier for each booking
    room_id           INT REFERENCES rooms(id) NOT NULL, -- which room this booking is for; must reference a real row in rooms
    user_id           INT REFERENCES users(id) NOT NULL, -- which user this booking belongs to; must reference a real row in users
    start_time        TIMESTAMPTZ NOT NULL,            -- when the booking starts
    end_time          TIMESTAMPTZ NOT NULL,             -- when the booking ends
    CHECK (end_time > start_time),                    -- prevents nonsensical bookings where the end is before (or equal to) the start
    status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'cancelled')), -- restricts status to exactly these three values
    created_by_role   VARCHAR(20) NOT NULL DEFAULT 'student'
                      CHECK (created_by_role IN ('student', 'admin')), -- records whether a student or an admin created this booking
    performed_by      INT REFERENCES users(id)          -- id of the admin who acted on this booking on someone else's behalf (e.g. cancelled it); NULL if no admin action was taken
);