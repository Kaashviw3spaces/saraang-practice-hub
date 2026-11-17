import asyncio
from datetime import date
import uuid

import httpx
import pytest
from pydantic import ValidationError

import main
import production
import email_verification


@pytest.mark.parametrize("email", ["a@gmail.com", "a@sub.rishihood.edu.in", "a@rishihood.edu.in.evil.org", "bad"])
def test_domain_rejection(email):
    with pytest.raises(ValidationError):
        email_verification.VerificationRequest(email=email)


def test_domain_normalization():
    assert email_verification.VerificationRequest(email="Student@RISHIHOOD.EDU.IN").email == "student@rishihood.edu.in"


@pytest.fixture
async def context(monkeypatch):
    deliveries = []
    monkeypatch.setattr(email_verification, "send_verification", lambda email, token: deliveries.append((email, token)))
    async with production.lifespan(production.app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=production.app), base_url="http://localhost") as client:
            email = f"verification_{uuid.uuid4().hex}@rishihood.edu.in"
            response = await client.post("/api/users", json={"name": "Verification Test", "email": email})
            assert response.status_code == 201
            user_id = response.json()["id"]
            try:
                yield client, email, user_id, deliveries
            finally:
                async with main.db_pool.acquire() as conn:
                    await conn.execute("DELETE FROM bookings WHERE user_id=$1", user_id)
                    await conn.execute("DELETE FROM users WHERE id=$1", user_id)


@pytest.mark.asyncio
async def test_verification_single_use_and_throttle(context):
    client, email, user_id, deliveries = context
    responses = await asyncio.gather(*[
        client.post("/api/auth/email/request", json={"email": email}) for _ in range(3)])
    assert all(r.status_code == 202 for r in responses)
    assert len(deliveries) == 1
    token = deliveries[0][1]
    async with main.db_pool.acquire() as conn:
        stored = await conn.fetchval("SELECT token_hash FROM email_verification_tokens WHERE user_id=$1", user_id)
        assert stored != token
    results = await asyncio.gather(*[
        client.post("/api/auth/email/verify", json={"token": token}) for _ in range(2)])
    assert sorted(r.status_code for r in results) == [200, 400]
    async with main.db_pool.acquire() as conn:
        assert await conn.fetchval("SELECT email_verified_at FROM users WHERE id=$1", user_id)


@pytest.mark.asyncio
async def test_expiry_resend_and_unknown_account(context):
    client, email, user_id, deliveries = context
    await client.post("/api/auth/email/request", json={"email": email})
    old = deliveries[-1][1]
    async with main.db_pool.acquire() as conn:
        await conn.execute("UPDATE email_verification_tokens SET expires_at=now()-interval '1 second', sent_at=now()-interval '61 seconds' WHERE user_id=$1", user_id)
    assert (await client.get("/api/auth/email/verify", params={"token": old})).status_code == 400
    await client.post("/api/auth/email/request", json={"email": email})
    assert len(deliveries) == 2
    assert (await client.get("/api/auth/email/verify", params={"token": old})).status_code == 400
    assert (await client.get("/api/auth/email/verify", params={"token": deliveries[-1][1]})).status_code == 200
    assert (await client.post("/api/auth/email/request", json={"email": "unknown@rishihood.edu.in"})).status_code == 202
    assert len(deliveries) == 2


@pytest.mark.asyncio
async def test_delivery_failure_rolls_back(context, monkeypatch):
    client, email, user_id, deliveries = context
    def fail(*args):
        raise RuntimeError("SMTP unavailable")
    monkeypatch.setattr(email_verification, "send_verification", fail)
    assert (await client.post("/api/auth/email/request", json={"email": email})).status_code == 503
    async with main.db_pool.acquire() as conn:
        assert not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM email_verification_tokens WHERE user_id=$1)", user_id)


@pytest.mark.asyncio
async def test_concurrent_booking_preserves_exclusivity(context):
    client, email, user_id, deliveries = context
    types = (await client.get("/api/session-types")).json()
    meeting = next(s["id"] for s in types if "meeting" in s["name"].lower())
    booking = {"user_id": user_id, "session_type_id": meeting,
               "booking_date": str(date(2098, 1, 1)), "start_time": "10:00:00",
               "end_time": "11:00:00", "participant_count": 2, "instruments": []}
    # The same user/day and exclusive slot cannot both pass simultaneous checks.
    responses = await asyncio.gather(*[client.post("/api/bookings", json=booking) for _ in range(2)])
    assert sorted(r.status_code for r in responses) == [201, 400]
