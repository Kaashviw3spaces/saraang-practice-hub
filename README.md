# 🎵 Saraang App - Practice Hub & AI Acoustic Booking System

High-concurrency music room booking platform with an **AI Acoustic Compatibility Engine**, real-time Redis telemetry, asynchronous notification workers, and PostgreSQL constraint-level overlap prevention.

Built to specifications in [`database_specification_for_ai_agent.md`](database_specification_for_ai_agent.md) and [`gemini-code-1793620553396.md`](gemini-code-1793620553396.md).

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    Client["Client / Frontend"] -->|REST HTTP / JSON| FastAPI["FastAPI Backend (:8001)"]
    FastAPI -->|Async Pool (asyncpg)| Postgres[("PostgreSQL 16 (:5432)")]
    FastAPI -->|Async I/O (redis.asyncio)| Redis[("Redis 7 (:6379)")]
    FastAPI -->|Task Dispatch| CeleryWorker["Celery Worker + Beat"]
    CeleryWorker -->|Pub/Sub & Result Backend| Redis
    CeleryWorker -->|Push Notifications| FCM["FCM / SMS Gateway"]

    subgraph "Core Business Guardrails"
        Rule1["Rule 1: Daily User Limit (1/day)"]
        Rule2["Rule 2: Capacity & Lockdown Check"]
        Rule3["Rule 3: AI Acoustic & Frequency Engine"]
        Excl["Database: EXCLUDE USING gist (Range Overlap Guard)"]
    end

    FastAPI --- Rule1
    FastAPI --- Rule2
    FastAPI --- Rule3
    Postgres --- Excl
```

---

## 🚀 Quick Start

### 1. Launch All Services via Docker Compose
```bash
docker compose up -d
```

This starts:
- `saraang_postgres`: PostgreSQL 16 on port `5432` with auto-seeded schema and acoustic catalogues.
- `saraang_redis`: Redis 7 Alpine on port `6379`.
- `saraang_backend`: FastAPI app running on host port `8001` (internal `8000`).
- `saraang_celery_worker`: Celery worker & Beat scheduler for notifications and session monitoring.

### 2. Verify Running Containers
```bash
docker compose ps
```

### 3. Check System Health
```bash
curl -s http://localhost:8001/health | jq .
```
Expected output:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-11-03T04:23:18.931775"
}
```

### 4. Interactive Swagger / OpenAPI Docs
Visit [`http://localhost:8001/docs`](http://localhost:8001/docs) in your browser for the interactive OpenAPI documentation and live request playground.

---

## 🧪 Automated Testing Suite

All tests run asynchronously inside the containerized environment:

```bash
docker exec saraang_backend pytest -v
```

### Verified Test Cases (15/15 Passing):
- **`test_acoustic_math_rule_60db_plus_60db`**: Asserts $60\text{ dB} + 60\text{ dB} = 63.0\text{ dB}$ (never linear $120\text{ dB}$).
- **`test_acoustic_math_via_instrument_profiles`**: Logarithmic summation across multi-instrument profiles.
- **`test_never_add_linearly`**: Ensures linear addition failure modes are impossible.
- **`test_empty_instruments_baseline`**: Returns ambient baseline room silence ($35.0\text{ dB}$).
- **`test_acoustic_evaluation_threshold_rejection`**: Rejects sessions exceeding room decibel ceilings.
- **`test_frequency_collision_and_lockdown`**: Enforces strict recording lockdown and catches low-end frequency mud.
- **`test_health_endpoint`**: Verifies DB and Redis connectivity.
- **`test_catalogues_retrieval`**: Verifies seeded rooms, instruments, and session types.
- **`test_user_creation_and_validation`**: Validates email regex and prevents duplicate registrations.
- **`test_ai_acoustic_dry_run`**: Tests `/api/bookings/acoustic-check`.
- **`test_rule_1_daily_booking_limit`**: Enforces max 1 active booking per user per date.
- **`test_rule_2_capacity_enforcement`**: Enforces session type participant limit and room capacity.
- **`test_rule_3_acoustic_rejection_on_booking`**: Blocks noisy reservations from being written to DB.
- **`test_concurrency_exclusion_and_rebooking`**: Tests PostgreSQL `EXCLUDE USING gist` rejection on overlapping time intervals, followed by re-booking upon cancellation.
- **`test_redis_dashboard`**: Validates the live 'Now Playing' room telemetry cache.

---

## 🔬 AI Acoustic Engine Mathematics

Sound pressure level ($L_p$) does not add linearly ($60\text{ dB} + 60\text{ dB} \neq 120\text{ dB}$). The engine strictly implements logarithmic summation:

$$L_{\text{sum}} = 10 \cdot \log_{10} \left( \sum_{i=1}^n \text{qty}_i \cdot 10^{\frac{L_i}{10}} \right)$$

### Room Reverberation & Echo Factor
Room reflection and damping alter effective sound power according to room acoustics:

$$L_{\text{effective}} = L_{\text{sum}} + 10 \cdot \log_{10}(\text{echo\_factor})$$

* **Echo Factor = 1.0**: Standard acoustic treatment ($0\text{ dB}$ gain).
* **Echo Factor = 1.2**: Live room reflection ($+0.79\text{ dB}$ boost).
* **Echo Factor = 0.2**: Heavily treated acoustic isolation booth ($-6.99\text{ dB}$ damping).

### Frequency Band Conflict Detection
High-energy instruments in low bands (`Low`, `Sub-Bass`) cause standing waves and phase muddiness. If $\ge 2$ low-end sources operate concurrently, or if a strict lockdown recording session detects frequency clashes, the engine issues warnings or triggers automatic rejection.

---

## 🔒 Concurrency & Overlap Prevention

Unlike naive `UNIQUE (room_id, booking_date, start_time)` constraints which:
1. Block re-booking when a session is cancelled.
2. Miss partial time interval overlaps (e.g., `10:00-12:00` vs `11:00-13:00`).

Saraang App uses PostgreSQL's **`btree_gist`** extension with an exclusion constraint on half-open timestamp ranges:

```sql
CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    room_id WITH =,
    booking_tsrange(booking_date, start_time, end_time) WITH &&
) WHERE (status != 'Cancelled');
```

When an overlap occurs, FastAPI catches the database `ExclusionViolationError` and returns a clean `HTTP 400 Bad Request`.

---

## 📡 REST API Reference

### 1. Catalogues
- `GET /api/rooms`: List music practice rooms and acoustic parameters (`max_decibel_threshold`, `echo_factor`).
- `GET /api/session-types`: List templates (`Session A`, `Session B`, `Jam Session`, `Recording Session`).
- `GET /api/instruments`: List instrument catalogue with `base_decibels` and `frequency_band`.
- `GET /api/rooms/{room_id}/schedule?query_date=YYYY-MM-DD`: Confirmed bookings for a given room.

### 2. Users
- `POST /api/users`: Register a new club user (`name`, `email`, `phone_number`).
- `GET /api/users`: List registered members.

### 3. AI Acoustic Dry-Run
- `POST /api/bookings/acoustic-check`:
```bash
curl -s -X POST http://localhost:8001/api/bookings/acoustic-check \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "session_type_id": 1,
    "instruments": [
      {"instrument_id": 4, "quantity": 1},
      {"instrument_id": 5, "quantity": 1}
    ]
  }' | jq .
```

### 4. Bookings
- `POST /api/bookings`: Create a reservation.
  - Automatically runs Daily Limit Check (Rule 1).
  - Automatically runs Capacity Check (Rule 2).
  - Automatically runs Acoustic Compatibility Check (Rule 3).
  - Inserts booking and instruments in an atomic transaction.
  - Updates Redis 'Now Playing' live state.
  - Enqueues Celery push notification task.
- `GET /api/bookings`: List bookings (filterable by `booking_date`, `user_id`, `room_id`).
- `POST /api/bookings/{id}/cancel`: Cancels booking, releases the slot, clears Redis, and dispatches cancellation alert.

### 5. Live Redis Telemetry
- `GET /api/dashboard/now-playing`: Retrieves real-time room occupancy, active decibel levels, and instrument telemetry.

---

## 🛠️ Management & Teardown

```bash
# View Celery worker task execution logs
docker compose logs -f celery_worker

# Stop all containers (preserve volume data)
docker compose down

# Stop and reset volume data (fresh wipe)
docker compose down -v
```
