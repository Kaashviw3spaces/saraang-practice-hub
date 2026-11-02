# Saraang App - Database Setup

Strict PostgreSQL database setup for the **Music Club Room Booking System**, built according to [`database_specification_for_ai_agent.md`](database_specification_for_ai_agent.md).

---

## 🚀 Quick Start

### 1. Start the Database
The PostgreSQL database runs in a lightweight Docker container (`postgres:16-alpine`) on port `5432`:

```bash
docker compose up -d
```

When started for the first time, PostgreSQL automatically executes all scripts in `sql/` in alphabetical order:
1. `sql/01_schema.sql` (Creates tables, relations, constraints, and indexes)
2. `sql/02_seed.sql` (Inserts session types, acoustic rooms, and instruments)

### 2. Check Database Status
```bash
docker compose ps
```

### 3. Stop the Database
```bash
docker compose down
```
*(To stop and erase all stored volume data, run `docker compose down -v`)*

---

## 🔑 Connection Credentials

The default configuration is defined in [`.env`](.env) (and templated in [`.env.example`](.env.example)):

- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `saraang_db`
- **User:** `postgres`
- **Password:** `postgres`
- **URL Connection String:**
  ```text
  postgresql://postgres:postgres@localhost:5432/saraang_db
  ```

---

## 🗄️ Database Schema & Data Integrity Safeguards

| Table | Integrity Safeguards & Constraints |
|---|---|
| `users` | `name`, `email` (`UNIQUE`, regex validated format), `phone_number`, `created_at` |
| `rooms` | `name` (`UNIQUE`), `base_capacity` (`> 0`), `max_decibel_threshold` (`> 0`), `echo_factor` (`>= 0.0`) |
| `session_types` | `name` (`UNIQUE`), `participant_limit` (`> 0`), `is_strict_lockdown` |
| `instruments` | `name` (`UNIQUE`), `category`, `base_decibels` (`>= 0`), `frequency_band` |
| `bookings` | Mandatory foreign keys (`NOT NULL`), `end_time > start_time`, `participant_count > 0`, `status IN ('Confirmed', 'Cancelled', 'Completed')`. **Exclusion Constraint**: `no_overlapping_active_bookings` prevents any time-range overlaps for active bookings while allowing re-booking of cancelled slots. |
| `booking_instruments` | Mandatory foreign keys with `ON DELETE CASCADE`, `quantity > 0` |

---

## 🛠️ Inspecting & Querying the Database

### Open an Interactive `psql` Session
```bash
docker exec -it saraang_postgres psql -U postgres -d saraang_db
```

### Quick Table & Seed Verification
```bash
# List all tables
docker exec saraang_postgres psql -U postgres -d saraang_db -c "\dt"

# Check seeded session types
docker exec saraang_postgres psql -U postgres -d saraang_db -c "SELECT * FROM session_types;"

# Check seeded rooms
docker exec saraang_postgres psql -U postgres -d saraang_db -c "SELECT * FROM rooms;"

# Check seeded instruments
docker exec saraang_postgres psql -U postgres -d saraang_db -c "SELECT * FROM instruments;"
```

---

## 💡 Backend & AI Engine Reference Queries

As specified in the architecture document:

### 1. Enforcing Daily User Booking Limit
```sql
SELECT COUNT(*) 
FROM bookings 
WHERE user_id = $1 
  AND booking_date = CURRENT_DATE 
  AND status != 'Cancelled';
```

### 2. Acoustic Compatibility AI Data Prep
Fetches active instruments, their decibel output, and frequency bands for a room during a time slot:
```sql
SELECT 
    b.id AS booking_id,
    b.room_id,
    r.max_decibel_threshold,
    r.echo_factor,
    i.id AS instrument_id,
    i.name AS instrument_name,
    i.category,
    i.base_decibels,
    i.frequency_band,
    bi.quantity
FROM bookings b
JOIN rooms r ON b.room_id = r.id
JOIN booking_instruments bi ON b.id = bi.booking_id
JOIN instruments i ON bi.instrument_id = i.id
WHERE b.room_id = $1
  AND b.booking_date = $2
  AND b.status = 'Confirmed'
  AND (b.start_time, b.end_time) OVERLAPS ($3::TIME, $4::TIME);
```
