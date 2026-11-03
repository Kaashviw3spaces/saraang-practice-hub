-- Saraang App - Database Schema (Music Club Room Booking System)

-- 1. Timezone Configuration
ALTER DATABASE saraang_db SET timezone TO 'UTC';
SET timezone = 'UTC';

-- 2. Extensions
-- btree_gist enables multi-column and range-based exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(20), 
    push_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_user_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 4. Rooms Table
-- Stores physical constraints and acoustic thresholds used by the AI engine.
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    base_capacity INT NOT NULL CHECK (base_capacity > 0), 
    max_decibel_threshold INT NOT NULL CHECK (max_decibel_threshold > 0), 
    echo_factor DECIMAL(3,2) NOT NULL DEFAULT 1.0 CHECK (echo_factor >= 0.0)
);

-- 5. Session Types Table
-- Defines the template rules for different types of bookings.
CREATE TABLE IF NOT EXISTS session_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, 
    participant_limit INT NOT NULL CHECK (participant_limit > 0), 
    is_strict_lockdown BOOLEAN NOT NULL DEFAULT FALSE 
);

-- 6. Instruments Table
-- Used heavily by the AI engine to calculate total room noise and frequency collisions.
CREATE TABLE IF NOT EXISTS instruments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50), 
    base_decibels INT NOT NULL CHECK (base_decibels >= 0), 
    frequency_band VARCHAR(20) 
);

-- 7. Helper Function for Booking Time Ranges
-- IMMUTABLE function to construct a half-open timestamp range [start, end)
CREATE OR REPLACE FUNCTION booking_tsrange(b_date DATE, s_time TIME, e_time TIME)
RETURNS tsrange AS $$
    SELECT tsrange((b_date + s_time), (b_date + e_time), '[)');
$$ LANGUAGE sql IMMUTABLE;

-- 8. Bookings Table (Transaction)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    session_type_id INT NOT NULL REFERENCES session_types(id) ON DELETE RESTRICT,
    
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL, 
    
    participant_count INT NOT NULL DEFAULT 1 CHECK (participant_count > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Cancelled', 'Completed')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: End time must strictly follow start time
    CONSTRAINT check_booking_times CHECK (end_time > start_time),
    
    -- CRITICAL: Prevents overlapping active bookings for the same room.
    -- Solves:
    -- 1. Exact start_time clashes
    -- 2. Partial/interval overlaps (e.g., 10:00-12:00 vs 11:00-13:00)
    -- 3. Allows re-booking slots that were 'Cancelled'
    CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
        room_id WITH =,
        booking_tsrange(booking_date, start_time, end_time) WITH &&
    ) WHERE (status != 'Cancelled')
);

-- 9. Booking Instruments (Junction Table)
-- Associates instruments to a specific booking for AI noise calculations.
CREATE TABLE IF NOT EXISTS booking_instruments (
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    instrument_id INT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    
    PRIMARY KEY (booking_id, instrument_id)
);

-- 10. Performance Indexes
-- Optimized for Rule 1 (Daily user booking limit check: SELECT COUNT(*) WHERE user_id = $1 AND booking_date = CURRENT_DATE AND status != 'Cancelled')
CREATE INDEX IF NOT EXISTS idx_bookings_user_daily_limit 
ON bookings(user_id, booking_date) 
WHERE status != 'Cancelled';

-- Optimized for room schedule lookups
CREATE INDEX IF NOT EXISTS idx_bookings_room_schedule 
ON bookings(room_id, booking_date, start_time, end_time);

-- Optimized for Rule 3 (AI acoustic query joins)
CREATE INDEX IF NOT EXISTS idx_booking_instruments_booking_id ON booking_instruments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_instruments_instrument_id ON booking_instruments(instrument_id);
