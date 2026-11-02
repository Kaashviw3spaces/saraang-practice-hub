# Project Context: Music Club Room Booking System
**Objective:** Build a strict PostgreSQL database for a music club room booking app. The system handles concurrent bookings, enforces daily user limits, and feeds data to an AI engine that checks acoustic compatibility (noise levels and frequency collisions) before allowing a booking.

**Tech Stack Requirements:**
*   Database: PostgreSQL
*   Extensions: None strictly required at this stage, but ensure standard timezone support for booking times.

---

## 1. SQL Schema

Please execute or create migrations for the following schema structure. 

```sql
-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(15), 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms Table
-- Stores physical constraints and acoustic thresholds used by the AI engine.
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    base_capacity INT NOT NULL, 
    max_decibel_threshold INT NOT NULL, 
    echo_factor DECIMAL(3,2) DEFAULT 1.0 
);

-- 3. Session Types Table
-- Defines the template rules for different types of bookings.
CREATE TABLE session_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, 
    participant_limit INT NOT NULL, 
    is_strict_lockdown BOOLEAN DEFAULT FALSE 
);

-- 4. Instruments Table
-- Used heavily by the AI engine to calculate total room noise and frequency collisions.
CREATE TABLE instruments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), 
    base_decibels INT NOT NULL, 
    frequency_band VARCHAR(20) 
);

-- 5. Bookings Table (Transaction)
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    room_id INT REFERENCES rooms(id),
    session_type_id INT REFERENCES session_types(id),
    
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL, 
    
    participant_count INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'Confirmed', -- 'Confirmed', 'Cancelled', 'Completed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- CRITICAL: Prevents double-booking a room at the exact same time
    CONSTRAINT no_overlapping_bookings UNIQUE (room_id, booking_date, start_time)
);

-- 6. Booking Instruments (Junction Table)
-- Associates instruments to a specific booking for the AI noise calculations.
CREATE TABLE booking_instruments (
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    instrument_id INT REFERENCES instruments(id) ON DELETE CASCADE,
    quantity INT DEFAULT 1,
    
    PRIMARY KEY (booking_id, instrument_id)
);
```

---

## 2. Seed Data Requirement

Agent, please create a seed script to populate the `session_types` table with the following core constraints:

```sql
INSERT INTO session_types (name, participant_limit, is_strict_lockdown) VALUES 
('Session A', 4, FALSE),
('Session B', 4, FALSE),
('Jam Session', 8, FALSE),
('Recording Session', 3, TRUE);
```

---

## 3. Backend Logic Constraints to Keep in Mind (For API Layer)

When you begin writing the API wrappers for this database, adhere to these rules:

1.  **Daily Booking Limit:** There is no hardcoded column for this. You must enforce it via a query before insertion: `SELECT COUNT(*) FROM bookings WHERE user_id = {user_id} AND booking_date = CURRENT_DATE AND status != 'Cancelled'`.
2.  **Capacity Enforcement:** Before saving a booking, ensure `participant_count` does not exceed `session_types.participant_limit`.
3.  **AI Data Prep:** The API will need a query that joins `booking_instruments` with `instruments` to fetch all `base_decibels` and `frequency_band` values active in a `room_id` during a specific `time_slot` to feed the acoustic compatibility engine.