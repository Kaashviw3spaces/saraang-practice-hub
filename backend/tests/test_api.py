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
    assert any(i["name"] == "Acoustic Drum Kit" for i in instruments)


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
    """Tests AI Acoustic dry-run evaluation endpoint."""
    # Test safe instruments
    safe_check = await client.post(
        "/api/bookings/acoustic-check",
        json={
            "room_id": 1,  # Studio A (115 dB threshold)
            "session_type_id": 1,
            "instruments": [{"instrument_id": 4, "quantity": 1}],  # Acoustic guitar (75 dB)
        },
    )
    assert safe_check.status_code == 200
    assert safe_check.json()["compatible"] is True

    # Test loud instruments in quiet isolation booth (75 dB threshold)
    unsafe_check = await client.post(
        "/api/bookings/acoustic-check",
        json={
            "room_id": 4,  # Acoustic Booth
            "session_type_id": 1,
            "instruments": [
                {"instrument_id": 1, "quantity": 1},  # Drums (110 dB)
                {"instrument_id": 2, "quantity": 1},  # Bass (100 dB)
            ],
        },
    )
    assert unsafe_check.status_code == 200
    data = unsafe_check.json()
    assert data["compatible"] is False
    assert len(data["rejection_reasons"]) > 0


@pytest.mark.asyncio
async def test_rule_1_daily_booking_limit(client):
    """RULE 1: A user cannot hold more than 1 active booking on the same date."""
    # Create distinct user
    u_resp = await client.post(
        "/api/users",
        json={"name": "Daily Limit Tester", "email": f"daily_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Booking 1: should succeed
    b1_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "room_id": 1,
            "session_type_id": 1,
            "booking_date": test_date,
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b1_resp.status_code == 201

    # Booking 2 on the same day: MUST FAIL with HTTP 400
    b2_resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "room_id": 2,
            "session_type_id": 1,
            "booking_date": test_date,
            "start_time": "13:00:00",
            "end_time": "15:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b2_resp.status_code == 400
    assert "Daily limit is 1 booking" in b2_resp.json()["detail"]


@pytest.mark.asyncio
async def test_rule_2_capacity_enforcement(client):
    """RULE 2: Participant count must not exceed session limit or room capacity."""
    u_resp = await client.post(
        "/api/users",
        json={"name": "Capacity Tester", "email": f"cap_{uuid.uuid4().hex[:8]}@test.com"},
    )
    user_id = u_resp.json()["id"]
    test_date = get_unique_test_date()

    # Recording Session limit is 3 participants. Try booking with 5.
    resp = await client.post(
        "/api/bookings",
        json={
            "user_id": user_id,
            "room_id": 1,
            "session_type_id": 4,  # Recording Session (limit 3)
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "participant_count": 5,
            "instruments": [],
        },
    )
    assert resp.status_code == 400
    assert "exceeds limit (3)" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_rule_3_acoustic_rejection_on_booking(client):
    """RULE 3: Bookings that exceed acoustic limits are rejected before saving."""
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
            "room_id": 4,  # Quiet booth (75 dB)
            "session_type_id": 1,
            "booking_date": test_date,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "participant_count": 1,
            "instruments": [
                {"instrument_id": 1, "quantity": 1},  # Drums (110 dB)
            ],
        },
    )
    assert resp.status_code == 422
    assert "AI Acoustic Compatibility Engine rejected this booking" in resp.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_concurrency_exclusion_and_rebooking(client):
    """
    CRITICAL: Validates PostgreSQL EXCLUDE constraint.
    1. User A books 14:00 - 16:00.
    2. User B tries 15:00 - 17:00 -> rejected with HTTP 400.
    3. User A cancels booking.
    4. User B tries again -> successfully confirmed.
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

    # 1. User A books 14:00 to 16:00
    b_a = await client.post(
        "/api/bookings",
        json={
            "user_id": user_a,
            "room_id": 3,
            "session_type_id": 3,
            "booking_date": test_date,
            "start_time": "14:00:00",
            "end_time": "16:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_a.status_code == 201
    booking_a_id = b_a.json()["id"]

    # 2. User B attempts overlapping slot 15:00 to 17:00 (MUST FAIL WITH 400)
    b_b = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "room_id": 3,
            "session_type_id": 3,
            "booking_date": test_date,
            "start_time": "15:00:00",
            "end_time": "17:00:00",
            "participant_count": 2,
            "instruments": [],
        },
    )
    assert b_b.status_code == 400
    assert "already booked during this time range" in b_b.json()["detail"]

    # 3. User A cancels booking
    cancel_resp = await client.post(f"/api/bookings/{booking_a_id}/cancel")
    assert cancel_resp.status_code == 200

    # 4. User B can now book the overlapping slot
    b_b_retry = await client.post(
        "/api/bookings",
        json={
            "user_id": user_b,
            "room_id": 3,
            "session_type_id": 3,
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
