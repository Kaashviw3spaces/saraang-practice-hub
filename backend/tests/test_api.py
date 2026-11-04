"""
Saraang App - Comprehensive API & Business Logic Integration Tests

Tests all endpoints and business rules:
- Rule 1: Daily Booking Limit per user
- Rule 2: Participant Capacity Enforcement (Session & Room limits)
- Rule 3: AI Acoustic Engine Compatibility
- Database Concurrency: PostgreSQL EXCLUDE constraint prevents overlapping bookings
- Slot Cancellation & Re-booking verification
- Redis 'Now Playing' live state cache
"""

import pytest
import httpx
from datetime import date, timedelta
import uuid
import random

BASE_URL = "http://localhost:8000"


def get_unique_test_date() -> str:
    """Generates a random future date to prevent collision between repeated test runs."""
    return str(date.today() + timedelta(days=random.randint(100, 100000)))


@pytest.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Verifies service health check and database/redis connectivity."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["redis"] == "connected"


@pytest.mark.asyncio
async def test_catalogues_retrieval(client):
    """Verifies that rooms, session types, and instruments are correctly seeded."""
    rooms_resp = await client.get("/api/rooms")
    assert rooms_resp.status_code == 200
    rooms = rooms_resp.json()
    assert len(rooms) >= 4
    assert any(r["name"] == "Studio A - Live Room" for r in rooms)

    st_resp = await client.get("/api/session-types")
    assert st_resp.status_code == 200
    session_types = st_resp.json()
    assert len(session_types) >= 4
    assert any(s["name"] == "Recording Session" and s["is_strict_lockdown"] for s in session_types)

    inst_resp = await client.get("/api/instruments")
    assert inst_resp.status_code == 200
    instruments = inst_resp.json()
    assert len(instruments) >= 7
    assert any(i["name"] == "Drums" for i in instruments)
    assert any(i["name"] == "Electric Bass" for i in instruments)
    assert any(i["name"] == "Electric Guitar" for i in instruments)
    assert any(i["name"] == "Vocals" for i in instruments)


@pytest.mark.asyncio
async def test_user_creation_and_validation(client):
    """Tests user registration, email validation, and duplicate rejection."""
    unique_email = f"user_{uuid.uuid4().hex[:8]}@musicclub.org"

    # Valid user creation
    resp = await client.post(
        "/api/users",
        json={"name": "Integration User", "email": unique_email, "phone_number": "+1234567890"},
    )
    assert resp.status_code == 201
    user = resp.json()
    assert user["email"] == unique_email

    # Duplicate user creation (must return 409)
    dup_resp = await client.post(
        "/api/users",
        json={"name": "Duplicate User", "email": unique_email},
    )
    assert dup_resp.status_code == 409

    # Invalid email format (must return 422)
    bad_resp = await client.post(
        "/api/users",
        json={"name": "Bad Email User", "email": "invalid-email-address"},
    )
    assert bad_resp.status_code == 422


@pytest.mark.asyncio
async def test_ai_acoustic_dry_run(client):
    """Tests AI Acoustic dry-run evaluation endpoint (automatic room evaluation)."""
    # Test safe instruments (Electric guitar)
    safe_check = await client.post(
        "/api/bookings/acoustic-check",
        json={
            "session_type_id": 1,
            "practice_mode": "Collaborative Practice",
            "instruments": [{"instrument_id": 3, "quantity": 1}],  # Electric guitar
        },
    )
    assert safe_check.status_code == 200
    assert safe_check.json()["compatible"] is True

    # Test overwhelming acoustic load exceeding all room thresholds
    unsafe_check = await client.post(
        "/api/bookings/acoustic-check",
        json={
            "session_type_id": 1,
            "practice_mode": "Collaborative Practice",
            "instruments": [
                {"instrument_id": 1, "quantity": 10},  # Drums (110 dB x 10)
            ],
        },
    )
    assert unsafe_check.status_code == 200
    data = unsafe_check.json()
    assert data["compatible"] is False
    assert len(data["rejection_reasons"]) > 0


@pytest.mark.asyncio
async def test_rule_1_daily_booking_limit(client):
    """RULE 1: A user cannot hold more than 3 active bookings on the same date."""
    # Create distinct user
    u_resp = await client.post(
        "/api/users",
        json={"name": "Daily Limit Tester", "email": f"daily_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Bookings 1, 2, and 3 on the same day in different slots: should succeed
    for i, (s_time, e_time) in enumerate([("09:00:00", "11:00:00"), ("11:00:00", "13:00:00"), ("13:00:00", "15:00:00")], 1):
        b_resp = await client.post(
            "/api/bookings",
            json={
                "user_id": user_id,
                "session_type_id": 1,
                "practice_mode": "Full Band Rehearsal",
                "booking_date": test_date,
                "start_time": s_time,
                "end_time": e_time,
                "participant_count": 2,
                "instruments": [],
            },
        )
        assert b_resp.status_code == 201, f"Booking #{i} failed: {b_resp.text}"

    # Booking 4 on the same day: MUST FAIL with HTTP 400 (Limit: 3/day)
    b4_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Full Band Rehearsal",
            "booking_date": test_date,
            "start_time": "16:00:00",
            "end_time": "18:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b4_resp.status_code == 400
    assert "Daily limit of 3 bookings reached" in b4_resp.json()["detail"]


@pytest.mark.asyncio
async def test_rule_2_capacity_enforcement(client):
    """RULE 2: Participant count must not exceed session limit or room capacity."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Capacity Tester", "email": f"cap_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Recording Session limit is 4 participants. Try booking with 5.
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 4,  # Recording Session (limit 4)
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "participant_count": 5,
            "instruments": [],
        },
    )
    assert resp.status_code == 400
    assert "exceeds limit (4)" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_rule_3_acoustic_rejection_on_booking(client):
    """RULE 3: Bookings that exceed acoustic limits are rejected with 400 Bad Request and ai_acoustics detail."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Noise Tester", "email": f"noise_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "participant_count": 8,
            "instruments": [
                {"instrument_id": 1, "quantity": 4},  # Overwhelming 4 drum kits
                {"instrument_id": 2, "quantity": 4},  # Overwhelming 4 bass rigs
            ],
        },
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "Booking rejected by Acoustic AI" in detail["message"]
    assert "ai_acoustics" in detail
    assert "reason" in detail["ai_acoustics"]
    assert detail["ai_acoustics"]["compatible"] is False


@pytest.mark.asyncio
async def test_concurrency_exclusion_and_rebooking(client):
    """
    CRITICAL: Validates room occupancy and slot conflict handling with automated room assignment.
    1. Fill all rooms for 14:00 - 16:00 (User A holds the first room).
    2. User B tries 15:00 - 17:00 -> rejected with HTTP 400 (no rooms available).
    3. User A cancels booking -> frees room.
    4. User B tries again -> successfully confirmed into the newly available room.
    """
    u1_resp = await client.post(
        "/api/users",
        json={"name": "User A", "email": f"usera_{uuid.uuid4().hex[:8]}@test.com"},
    )
    u2_resp = await client.post(
        "/api/users",
        json={"name": "User B", "email": f"userb_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_a = u1_resp.json()["id"]
    user_b = u2_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. User A books 14:00 to 16:00 (auto-assigned Room 1)
    b_a = await client.post(
        "/api/bookings",
        json={
            "user_id": user_a,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "16:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_a.status_code == 201
    booking_a_id = b_a.json()["id"]

    # Fill remaining 3 rooms during 14:00 - 16:00
    other_users = []
    for i in range(3):
        u_temp = await client.post(
            "/api/users",
            json={"name": f"Other User {i}", "email": f"other_{i}_{uuid.uuid4().hex[:8]}@test.com"},
        )
        b_temp = await client.post(
            "/api/bookings",
            json={
                "user_id": u_temp.json()["id"],
                "session_type_id": 3,
                "practice_mode": "Collaborative Jam",
                "booking_date": test_date,
                "start_time": "14:00:00",
                "end_time": "16:00:00",
                "participant_count": 2,
                "instruments": [],
            },
        )
        assert b_temp.status_code == 201

    # 2. User B attempts overlapping slot 15:00 to 17:00 (MUST FAIL WITH 400 - all rooms busy)
    b_b = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "15:00:00",
            "end_time": "17:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_b.status_code == 400
    assert "No rooms are available" in b_b.json()["detail"] or "Slot capacity reached" in b_b.json()["detail"]

    # 3. User A cancels booking
    cancel_resp = await client.post(f"/api/bookings/{booking_a_id}/cancel")
    assert cancel_resp.status_code == 200

    # 4. User B can now book the slot freed by User A
    b_b_retry = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "16:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_b_retry.status_code == 201
    assert b_b_retry.json()["status"] == "Confirmed"


@pytest.mark.asyncio
async def test_redis_dashboard(client):
    """Tests the 'Now Playing' live room telemetry dashboard."""
    resp = await client.get("/api/dashboard/now-playing")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_rooms_count" in data
    assert isinstance(data["rooms"], list)


@pytest.mark.asyncio
async def test_live_rooms_status(client):
    """Tests the polling endpoint GET /api/rooms/live for mobile home screen (clean & minimalistic)."""
    resp = await client.get("/api/rooms/live")
    assert resp.status_code == 200
    data = resp.json()
    assert "rooms" in data
    assert len(data["rooms"]) >= 4
    for r in data["rooms"]:
        assert "is_occupied" in r
        assert "status" in r
        assert "base_capacity" in r
        # Decibel telemetry removed for minimalistic design
        assert "current_decibels" not in r


@pytest.mark.asyncio
async def test_push_token_registration(client):
    """Tests POST /api/users/push-token registration."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Token User", "email": f"token_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]

    token_resp = await client.post(
        "/api/users/push-token",
        json={"user_id": user_id, "push_token": "ExponentPushToken[xxxxxxxxxxxx]"},
    )
    assert token_resp.status_code == 200
    assert token_resp.json()["status"] == "success"


@pytest.mark.asyncio
async def test_session_a_solo_policy(client):
    """
    Session A Solo Policy:
    - If mode is Solo Practice, instruments MUST contain only Acoustic Drums or Electric Guitar.
    - Rejects other instruments or empty instrument array.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Session A Solo Tester", "email": f"sessiona_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Acoustic Drum Kit (id=1) -> SUCCESS (auto-assigned compatible room)
    b_drums = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert b_drums.status_code == 201
    assert b_drums.json()["practice_mode"] == "Solo Practice"
    assert "jam pod" not in b_drums.json()["room_name"].lower()

    # 2. Electric Guitar (id=3) -> SUCCESS
    b_guitar = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 3, "quantity": 1}],
        },
    )
    assert b_guitar.status_code == 201

    # 3. Disallowed instrument (Acoustic Guitar id=4) -> REJECTED with 400
    b_acoustic = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],
        },
    )
    assert b_acoustic.status_code == 400
    detail = b_acoustic.json()["detail"]
    assert "Session A Solo Policy" in detail["message"]
    assert detail["ai_acoustics"]["compatible"] is False

    # 4. Empty instruments in Solo Practice -> REJECTED with 400
    b_empty = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 1,
            "instruments": [],
        },
    )
    assert b_empty.status_code == 400
    assert "Session A Solo Policy" in b_empty.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_session_a_full_band_policy(client):
    """Session A Full Band Policy: Bypasses individual instrument checks."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Full Band Tester", "email": f"fullband_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Full Band Rehearsal",
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "16:00:00",
            "participant_count": 5,
            "instruments": [],
        },
    )
    assert resp.status_code == 201
    assert resp.json()["practice_mode"] == "Full Band Rehearsal"


@pytest.mark.asyncio
async def test_session_b_acoustic_policy(client):
    """
    Session B:
    - Valid modes: Solo Practice, Collaborative Jam.
    - Rejects Full Band Rehearsal.
    - Session B Acoustic Policy: MUST NOT contain Acoustic Drums or Electric Guitar.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Session B Tester", "email": f"sessionb_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Full Band Rehearsal rejected
    b_fb = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,
            "practice_mode": "Full Band Rehearsal",
            "booking_date": test_date,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_fb.status_code == 400
    assert "Session B does not permit Full Band Rehearsal" in b_fb.json()["detail"]["message"]

    # 2. Acoustic Drums rejected
    b_drums = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert b_drums.status_code == 400
    assert "Session B Acoustic Policy" in b_drums.json()["detail"]["message"]

    # 3. Electric Guitar rejected
    b_eg = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "participant_count": 2,
            "instruments": [{"instrument_id": 3, "quantity": 1}],
        },
    )
    assert b_eg.status_code == 400
    assert "Session B Acoustic Policy" in b_eg.json()["detail"]["message"]

    # 4. Allowed instruments: Acoustic Guitar (id=4) & Synthesizer (id=6)
    b_allowed = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "13:00:00",
            "end_time": "14:00:00",
            "participant_count": 2,
            "instruments": [
                {"instrument_id": 4, "quantity": 1},
                {"instrument_id": 6, "quantity": 1},
            ],
        },
    )
    assert b_allowed.status_code == 201


@pytest.mark.asyncio
async def test_meeting_session_policy(client):
    """Meeting Session: Bypasses instrument validation completely."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Meeting Tester", "email": f"meeting_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Booking Meeting Session with no instruments
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 9,  # Meeting Session
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "15:00:00",
            "participant_count": 6,
            "instruments": [],
        },
    )
    assert resp.status_code == 201
    assert resp.json()["session_name"] == "Meeting Session"


@pytest.mark.asyncio
async def test_auto_room_assignment_without_room_id(client):
    """
    CRITICAL FIXES1.MD:
    Manual room selection has been removed altogether.
    Backend must automatically assign an available, acoustically compatible room.
    Returns 200/201 with assigned_room_id and room_name.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Auto Room Tester", "email": f"autoroom_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Create booking WITHOUT room_id
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,  # Session A
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],  # Acoustic Drum Kit
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "assigned_room_id" in data
    assert data["assigned_room_id"] is not None
    assert data["room_id"] == data["assigned_room_id"]
    assert "room_name" in data
    assert len(data["room_name"]) > 0


@pytest.mark.asyncio
async def test_jam_pod_exclusion_for_solo_practice(client):
    """
    CRITICAL FIXES1.MD:
    Jam Pod Constraint: If requested practice mode is 'Solo Practice',
    the backend MUST filter out 'Jam Pod' rooms from the available pool.
    Jam Pods cannot be assigned to solo practitioners.
    """
    u1 = await client.post(
        "/api/users",
        json={"name": "Jam Pod Solo Tester 1", "email": f"jampod1_{uuid.uuid4().hex[:8]}@test.com"},
    )
    u2 = await client.post(
        "/api/users",
        json={"name": "Jam Pod Solo Tester 2", "email": f"jampod2_{uuid.uuid4().hex[:8]}@test.com"},
    )
    u1_id = u1.json()["id"]
    u2_id = u2.json()["id"]
    test_date = get_unique_test_date()

    # When all rooms are open, Solo Practice assigns Studio A, Studio B, or Booth - NEVER Jam Pod!
    solo_1 = await client.post(
        "/api/bookings",
        json={
            "user_id": u1_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 8,  # Only Studio A and Jam Pod can fit 8
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert solo_1.status_code == 201
    assert "jam pod" not in solo_1.json()["room_name"].lower()
    assert solo_1.json()["room_name"] == "Studio A - Live Room"

    # Now Studio A is occupied during 10:00-11:00.
    # Attempt second Solo Practice booking needing capacity 8 during same slot:
    # Studio B (cap 6) and Booth (cap 4) cannot fit 8.
    # Jam Pod 1 (cap 8) is free, but MUST be excluded because practice mode is Solo Practice!
    # Therefore, no compatible room is available!
    solo_2 = await client.post(
        "/api/bookings",
        json={
            "user_id": u2_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 8,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert solo_2.status_code == 400
    assert "Solo Practice" in solo_2.json()["detail"] or "No available rooms" in solo_2.json()["detail"]


@pytest.mark.asyncio
async def test_session_solo_multiple_instruments_rejection(client):
    """
    CRITICAL FIXES1.MD:
    - Session A (Solo): MUST contain only ONE instrument: Acoustic Drums or Electric Guitar.
      Reject if multiple instruments or quantity > 1.
    - Session B (Solo): MUST contain only ONE instrument (no drums, no electric guitar).
      Reject if multiple instruments or quantity > 1.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Solo Multi Tester", "email": f"solomulti_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Session A Solo with two different instruments
    resp_a_multi = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "participant_count": 1,
            "instruments": [
                {"instrument_id": 1, "quantity": 1},  # Drums
                {"instrument_id": 3, "quantity": 1},  # Guitar
            ],
        },
    )
    assert resp_a_multi.status_code == 400
    assert "Session A Solo Policy" in resp_a_multi.json()["detail"]["message"]

    # 2. Session A Solo with quantity > 1
    resp_a_qty = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [
                {"instrument_id": 1, "quantity": 2},
            ],
        },
    )
    assert resp_a_qty.status_code == 400
    assert "Session A Solo Policy" in resp_a_qty.json()["detail"]["message"]

    # 3. Session B Solo with two instruments
    resp_b_multi = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "participant_count": 1,
            "instruments": [
                {"instrument_id": 4, "quantity": 1},  # Acoustic Guitar
                {"instrument_id": 6, "quantity": 1},  # Synth
            ],
        },
    )
    assert resp_b_multi.status_code == 400
    assert "Session B does not permit Solo Practice" in resp_b_multi.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_auto_assignment_acoustic_load_rejection(client):
    """
    CRITICAL FIXES1.MD:
    If no available rooms can handle the acoustic load of the selected instruments,
    returns 400 Bad Request with ai_acoustics.reason:
    'No available rooms can handle the acoustic load of your selected instruments at this time.'
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Acoustic Overload Tester", "email": f"overload_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Book a Collaborative Jam with overwhelming acoustic load:
    # 4 Drum Kits (110 dB each) + 4 Bass Amps (100 dB each)
    # This produces > 116 dB, exceeding even Studio A's 115 dB threshold.
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,  # Jam Session
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "15:00:00",
            "participant_count": 8,
            "instruments": [
                {"instrument_id": 1, "quantity": 4},
                {"instrument_id": 2, "quantity": 4},
            ],
        },
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "detail" in data
    detail = data["detail"]
    assert "ai_acoustics" in detail
    assert detail["ai_acoustics"]["reason"] == "No available rooms can handle the acoustic load of your selected instruments at this time."


@pytest.mark.asyncio
async def test_jam_session_policy(client):
    """
    CRITICAL: Validates that Jam Session strictly allows Collaborative Jam only,
    prohibits Solo Practice and Full Band Rehearsal, and enforces participant limits.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Jam Policy Tester", "email": f"jam_policy_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Jam Session with Solo Practice -> must fail 400
    resp_solo = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,  # Jam Session
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],
        },
    )
    assert resp_solo.status_code == 400
    assert "Jam Session does not permit 'Solo Practice'" in resp_solo.json()["detail"]["message"]

    # 2. Jam Session with Full Band Rehearsal -> must fail 400
    resp_band = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,  # Jam Session
            "practice_mode": "Full Band Rehearsal",
            "booking_date": test_date,
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "participant_count": 5,
            "instruments": [
                {"instrument_id": 4, "quantity": 1},
                {"instrument_id": 6, "quantity": 1},
            ],
        },
    )
    assert resp_band.status_code == 400
    assert "Jam Session does not permit 'Full Band Rehearsal'" in resp_band.json()["detail"]["message"]

    # 3. Jam Session with Collaborative Jam -> must succeed 201
    resp_collab = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,  # Jam Session
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 2,
            "instruments": [
                {"instrument_id": 4, "quantity": 1},  # Acoustic Guitar
                {"instrument_id": 6, "quantity": 1},  # Synth
            ],
        },
    )
    assert resp_collab.status_code == 201
    data = resp_collab.json()
    assert data["session_type_id"] == 3
    assert data["practice_mode"] == "Collaborative Jam"
    assert data["participant_count"] == 2


@pytest.mark.asyncio
async def test_people_playing_with_vocalists_without_instruments(client):
    """
    Validates that participant_count represents the actual people playing
    (including vocalists who do not use instruments), independent of instrument quantities.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Vocalist Group Tester", "email": f"vocalist_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 5 people playing (2 instrumentalists + 3 vocalists) with only 2 instruments specified
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,  # Jam Session (limit 8)
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "15:00:00",
            "participant_count": 5,
            "instruments": [
                {"instrument_id": 4, "quantity": 1},  # Acoustic Guitar
                {"instrument_id": 6, "quantity": 1},  # Synth
            ],
        },
    )
    assert resp.status_code == 201
    booking = resp.json()
    assert booking["participant_count"] == 5
    assert len(booking["instruments"]) == 2


@pytest.mark.asyncio
async def test_operating_hours_enforcement(client):
    """
    Validates that the music room is open strictly from 6:00 AM to 11:00 PM (06:00 to 23:00).
    Bookings outside these hours must be rejected with 400 Bad Request.
    """
    u_resp = await client.post(
        "/api/users",
        json={"name": "Hours Tester", "email": f"hours_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Booking before 6:00 AM -> must fail 400
    early_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "05:00:00",
            "end_time": "06:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert early_resp.status_code == 400
    assert "open only from 6:00 AM to 11:00 PM" in early_resp.json()["detail"]

    # 2. Booking ending after 11:00 PM -> must fail 400
    late_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "23:00:00",
            "end_time": "23:59:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert late_resp.status_code == 400
    assert "open only from 6:00 AM to 11:00 PM" in late_resp.json()["detail"]


@pytest.mark.asyncio
async def test_slot_availability_endpoint_and_conflict(client):
    """
    Validates hour-wise slot availability display from 6AM to 11PM:
    - Initial slots: all 17 slots available.
    - Band A books 12:00 PM to 01:00 PM -> slot is marked Reserved.
    - Band B cannot book 12:00 PM to 01:00 PM (rejected with 400).
    """
    u1_resp = await client.post(
        "/api/users",
        json={"name": "Band A Member", "email": f"banda_{uuid.uuid4().hex[:8]}@test.com"},
    )
    u2_resp = await client.post(
        "/api/users",
        json={"name": "Band B Member", "email": f"bandb_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_a = u1_resp.json()["id"]
    user_b = u2_resp.json()["id"]
    test_date = get_unique_test_date()

    # 1. Fetch initial slots for Jam Session
    slots_resp = await client.get(f"/api/sessions/3/slots?date={test_date}")
    assert slots_resp.status_code == 200
    data = slots_resp.json()
    assert len(data["slots"]) == 17  # 6 AM to 11 PM = 17 1-hour slots
    assert data["slots"][0]["start_time"] == "06:00:00"
    assert data["slots"][-1]["end_time"] == "23:00:00"

    # Slot 12pm-1pm should initially be available
    slot_12pm = next(s for s in data["slots"] if s["start_time"] == "12:00:00")
    assert slot_12pm["is_available"] is True
    assert slot_12pm["status"] == "Available"

    # 2. Band A books 12:00 PM - 01:00 PM
    b_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_a,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 8,
            "instruments": [],
        },
    )
    assert b_resp.status_code == 201

    # 3. Check slots again: 12pm-1pm must now be marked Reserved / Full
    slots_after = await client.get(f"/api/sessions/3/slots?date={test_date}")
    assert slots_after.status_code == 200
    slot_12pm_after = next(s for s in slots_after.json()["slots"] if s["start_time"] == "12:00:00")
    assert slot_12pm_after["is_available"] is False
    assert "Full" in slot_12pm_after["status"] or "Reserved" in slot_12pm_after["status"]

    # 4. Band B selects a different available slot (01:00 PM - 02:00 PM) -> succeeds
    slot_1pm = next(s for s in slots_after.json()["slots"] if s["start_time"] == "13:00:00")
    assert slot_1pm["is_available"] is True
    assert slot_1pm["status"] == "Available"

    b2_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "session_type_id": 3,
            "practice_mode": "Collaborative Jam",
            "booking_date": test_date,
            "start_time": "13:00:00",
            "end_time": "14:00:00",
            "participant_count": 3,
            "instruments": [],
        },
    )
    assert b2_resp.status_code == 201


@pytest.mark.asyncio
async def test_session_a_collaborative_practice_and_capacity(client):
    """
    Validates Session A:
    1. Allows only Electric Guitar or Drums. Other instruments rejected.
    2. Drummer User 1 books 10:00 - 11:00.
    3. Electric Guitarist User 2 books 10:00 - 11:00 in Collaborative Practice.
    4. Slot availability endpoint reflects 2/8 playing with Drums and Electric Guitar.
    """
    u1 = await client.post("/api/users", json={"name": "Drummer A", "email": f"drum_{uuid.uuid4().hex[:8]}@test.com"})
    u2 = await client.post("/api/users", json={"name": "Guitarist A", "email": f"guit_{uuid.uuid4().hex[:8]}@test.com"})
    u1_id = u1.json()["id"]
    u2_id = u2.json()["id"]
    test_date = get_unique_test_date()

    # 1. Booking invalid instrument for Session A (e.g. Acoustic Guitar, ID 4) -> must fail 400
    b_bad = await client.post(
        "/api/bookings",
        json={
            "user_id": u1_id,
            "session_type_id": 1,  # Session A
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],
        },
    )
    assert b_bad.status_code == 400
    assert "Session A only permits Drums and Electric Guitar" in b_bad.json()["detail"]["ai_acoustics"]["reason"]

    # 2. Drummer User 1 books Session A (ID 1: Drums)
    b_drum = await client.post(
        "/api/bookings",
        json={
            "user_id": u1_id,
            "session_type_id": 1,
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert b_drum.status_code == 201

    # 3. Guitarist User 2 joins same slot in Collaborative Practice (ID 3: Electric Guitar)
    b_guit = await client.post(
        "/api/bookings",
        json={
            "user_id": u2_id,
            "session_type_id": 1,
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 3, "quantity": 1}],
        },
    )
    assert b_guit.status_code == 201

    # 4. Check slot availability: 10:00 - 11:00 shows 2/8 Playing with Drums (1) and Electric Guitar (1)
    slots_resp = await client.get(f"/api/sessions/1/slots?date={test_date}")
    assert slots_resp.status_code == 200
    slot_10am = next(s for s in slots_resp.json()["slots"] if s["start_time"] == "10:00:00")
    assert slot_10am["is_available"] is True
    assert slot_10am["current_participants"] == 2
    assert slot_10am["max_participants"] == 8
    assert any("Drums" in inst for inst in slot_10am["instruments_summary"])
    assert any("Electric Guitar" in inst for inst in slot_10am["instruments_summary"])


@pytest.mark.asyncio
async def test_session_a_session_b_collision_isolation(client):
    """
    CRITICAL: Validates that Session A and Session B instrumentalists NEVER collide in the same slot.
    - If Session A is booked at 10:00 - 11:00, Session B booking at 10:00 - 11:00 is rejected (400).
    - If Session B is booked at 14:00 - 15:00, Session A booking at 14:00 - 15:00 is rejected (400).
    """
    u_a = await client.post("/api/users", json={"name": "A Band", "email": f"a_{uuid.uuid4().hex[:8]}@test.com"})
    u_b = await client.post("/api/users", json={"name": "B Band", "email": f"b_{uuid.uuid4().hex[:8]}@test.com"})
    user_a = u_a.json()["id"]
    user_b = u_b.json()["id"]
    test_date = get_unique_test_date()

    # 1. Session A books 10:00 - 11:00
    b_a = await client.post(
        "/api/bookings",
        json={
            "user_id": user_a,
            "session_type_id": 1,  # Session A
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert b_a.status_code == 201

    # 2. Session B tries to book 10:00 - 11:00 -> MUST BE REJECTED 400
    b_b_fail = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "session_type_id": 2,  # Session B
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],
        },
    )
    assert b_b_fail.status_code == 400
    assert "Collision Violation" in b_b_fail.json()["detail"]

    # 3. Session B slots endpoint at 10:00 - 11:00 must show is_available: false, status: Reserved (Session A)
    b_slots = await client.get(f"/api/sessions/2/slots?date={test_date}")
    slot_10am_b = next(s for s in b_slots.json()["slots"] if s["start_time"] == "10:00:00")
    assert slot_10am_b["is_available"] is False
    assert "Reserved (Session A)" in slot_10am_b["status"]


@pytest.mark.asyncio
async def test_session_b_solo_practice_forbidden(client):
    """
    CRITICAL: Validates that Solo Practice is completely removed/forbidden for Session B
    (can be done in hostel rooms). Only Collaborative Practice is allowed.
    """
    u = await client.post("/api/users", json={"name": "Solo B Tester", "email": f"solob_{uuid.uuid4().hex[:8]}@test.com"})
    user_id = u.json()["id"]
    test_date = get_unique_test_date()

    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "session_type_id": 2,  # Session B
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],
        },
    )
    assert resp.status_code == 400
    assert "Session B does not permit Solo Practice" in resp.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_solo_practice_room_exclusivity(client):
    """
    CRITICAL: Validates that if a user books Solo Practice, they have the room alone:
    1. User 1 books Solo Practice in Session A (12:00 - 13:00).
    2. User 2 tries to join Collaborative Practice at 12:00 - 13:00 -> Rejected (400).
    3. User 3 tries to book another Solo Practice at 12:00 - 13:00 -> Rejected (400).
    4. Slot availability endpoint marks slot as is_available: false, status: 'Reserved (Solo)'.
    """
    u1 = await client.post("/api/users", json={"name": "Solo A", "email": f"soloa_{uuid.uuid4().hex[:8]}@test.com"})
    u2 = await client.post("/api/users", json={"name": "Collab Joiner", "email": f"join_{uuid.uuid4().hex[:8]}@test.com"})
    u1_id = u1.json()["id"]
    u2_id = u2.json()["id"]
    test_date = get_unique_test_date()

    # 1. User 1 books Solo Practice with Drums
    b_solo = await client.post(
        "/api/bookings",
        json={
            "user_id": u1_id,
            "session_type_id": 1,
            "practice_mode": "Solo Practice",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 1, "quantity": 1}],
        },
    )
    assert b_solo.status_code == 201

    # 2. User 2 tries to join Collaborative Practice in that slot -> must fail 400
    b_join_fail = await client.post(
        "/api/bookings",
        json={
            "user_id": u2_id,
            "session_type_id": 1,
            "practice_mode": "Collaborative Practice",
            "booking_date": test_date,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "participant_count": 1,
            "instruments": [{"instrument_id": 3, "quantity": 1}],
        },
    )
    assert b_join_fail.status_code == 400
    assert "Solo Practice with no other musicians permitted" in b_join_fail.json()["detail"]

    # 3. Check slots: must show Reserved (Solo)
    slots_resp = await client.get(f"/api/sessions/1/slots?date={test_date}")
    slot_12pm = next(s for s in slots_resp.json()["slots"] if s["start_time"] == "12:00:00")
    assert slot_12pm["is_available"] is False
    assert slot_12pm["status"] == "Reserved (Solo)"
    assert slot_12pm["has_solo"] is True




