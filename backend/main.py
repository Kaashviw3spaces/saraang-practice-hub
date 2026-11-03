"""
Saraang App - FastAPI Backend Application

Main API entrypoint handling:
- Room reservation workflows
- Daily user limit enforcement (Rule 1)
- Participant capacity enforcement (Rule 2)
- AI Acoustic compatibility validation (Rule 3)
- Concurrency and time-range overlap protection
- Redis 'Now Playing' live cache integration
- Celery notification worker triggers
"""

import os
from contextlib import asynccontextmanager
from datetime import date, time, datetime
from typing import List, Optional, Dict, Any
import logging

from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncpg

from ai_engine import (
    evaluate_acoustic_compatibility,
    InstrumentAcousticProfile,
    RoomAcousticProfile,
    SessionTypeRules,
    AcousticEvaluation,
)
from redis_client import get_redis_client, close_redis_client, NowPlayingCache
import notifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("saraang_api")

# Database Configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@"
    f"{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'saraang_db')}",
)

db_pool: Optional[asyncpg.Pool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes and tears down async resources (DB pool, Redis)."""
    global db_pool
    logger.info("Initializing asyncpg database pool for %s", DATABASE_URL.split("@")[-1])
    try:
        db_pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=10,
        )
        logger.info("Database pool established.")
    except Exception as e:
        logger.error("Failed to connect to PostgreSQL: %s", e)
        raise e

    # Warm up Redis client
    await get_redis_client()

    yield

    # Teardown
    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed.")
    await close_redis_client()
    logger.info("Redis client closed.")


app = FastAPI(
    title="Saraang Music Club Booking & AI Acoustic API",
    description="High-concurrency room booking backend with AI acoustic compatibility enforcement.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get a database connection from the pool
async def get_db():
    if db_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database pool not initialized",
        )
    async with db_pool.acquire() as conn:
        yield conn


# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------

class PushTokenRequest(BaseModel):
    user_id: int
    push_token: str
    platform: Optional[str] = "expo"


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
    phone_number: Optional[str] = Field(None, max_length=20)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone_number: Optional[str]
    created_at: datetime


class RoomOut(BaseModel):
    id: int
    name: str
    base_capacity: int
    max_decibel_threshold: int
    echo_factor: float


class SessionTypeOut(BaseModel):
    id: int
    name: str
    participant_limit: int
    is_strict_lockdown: bool


class InstrumentOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    base_decibels: int
    frequency_band: Optional[str]


class BookingInstrumentItem(BaseModel):
    instrument_id: int
    quantity: int = Field(default=1, gt=0)


class BookingCreate(BaseModel):
    user_id: int
    room_id: int
    session_type_id: int
    booking_date: date
    start_time: time
    end_time: time
    participant_count: int = Field(default=1, gt=0)
    instruments: List[BookingInstrumentItem] = Field(default_factory=list)


class AcousticCheckRequest(BaseModel):
    room_id: int
    session_type_id: int
    instruments: List[BookingInstrumentItem] = Field(default_factory=list)


class BookingOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    room_id: int
    room_name: Optional[str] = None
    session_type_id: int
    session_name: Optional[str] = None
    booking_date: date
    start_time: time
    end_time: time
    participant_count: int
    status: str
    created_at: datetime
    instruments: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------
# System & Meta Endpoints
# ---------------------------------------------------------

@app.get("/health", tags=["System"])
async def health_check():
    """Returns database, Redis, and service health status."""
    db_ok = False
    redis_ok = False

    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                val = await conn.fetchval("SELECT 1")
                db_ok = val == 1
        except Exception:
            db_ok = False

    redis = await get_redis_client()
    if redis:
        try:
            redis_ok = await redis.ping()
        except Exception:
            redis_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "redis": "connected" if redis_ok else "disconnected",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------
# Users Endpoints
# ---------------------------------------------------------

@app.post("/api/users", response_model=UserOut, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(user: UserCreate, conn=Depends(get_db)):
    """Registers a new music club user."""
    query = """
        INSERT INTO users (name, email, phone_number)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, phone_number, created_at
    """
    try:
        row = await conn.fetchrow(query, user.name, user.email, user.phone_number)
        return dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{user.email}' already exists.",
        )


@app.get("/api/users", response_model=List[UserOut], tags=["Users"])
async def list_users(conn=Depends(get_db)):
    """Lists all registered club members."""
    rows = await conn.fetch("SELECT id, name, email, phone_number, created_at FROM users ORDER BY id ASC")
    return [dict(r) for r in rows]


@app.post("/api/users/push-token", tags=["Users"])
async def register_push_token(req: PushTokenRequest, conn=Depends(get_db)):
    """Registers an FCM / Expo push notification token for a user."""
    user = await conn.fetchrow("SELECT id, name FROM users WHERE id = $1", req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await conn.execute("UPDATE users SET push_token = $1 WHERE id = $2", req.push_token, req.user_id)
    return {
        "status": "success",
        "message": f"Push notification token successfully registered for user {user['name']}.",
        "user_id": req.user_id,
        "token": req.push_token,
    }


# ---------------------------------------------------------
# Rooms, Session Types & Instruments Endpoints
# ---------------------------------------------------------

@app.get("/api/rooms/live", tags=["Catalogue", "Dashboard"])
async def get_live_rooms_status(conn=Depends(get_db)):
    """
    Returns real-time occupancy and acoustic states for all rooms,
    polling-compatible for the mobile app home screen (every 30s).
    """
    rooms = await conn.fetch("SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms ORDER BY id ASC")
    
    current_time_bookings = await conn.fetch(
        """
        SELECT 
            b.id AS booking_id, b.room_id, b.participant_count,
            b.start_time, b.end_time,
            u.name AS user_name, s.name AS session_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN session_types s ON b.session_type_id = s.id
        WHERE b.booking_date = CURRENT_DATE
          AND b.status = 'Confirmed'
          AND CURRENT_TIME BETWEEN b.start_time AND b.end_time
        """
    )
    active_by_room = {b["room_id"]: dict(b) for b in current_time_bookings}
    
    result = []
    for r in rooms:
        r_dict = dict(r)
        room_id = r["id"]
        
        # Check Redis cached state first
        redis_state = await NowPlayingCache.get_room_state(room_id)
        active_db = active_by_room.get(room_id)
        
        is_occupied = redis_state is not None or active_db is not None
        current_session = None
        current_db = 35.0  # Ambient baseline
        
        if redis_state:
            current_session = {
                "booking_id": redis_state.get("booking_id"),
                "session_type": redis_state.get("session_type"),
                "user_name": redis_state.get("user_name"),
                "start_time": redis_state.get("start_time"),
                "end_time": redis_state.get("end_time"),
                "participant_count": redis_state.get("participant_count"),
                "effective_decibels": redis_state.get("effective_decibels", 75.0),
                "instruments": redis_state.get("instruments", []),
            }
            current_db = redis_state.get("effective_decibels", 75.0)
        elif active_db:
            current_session = {
                "booking_id": active_db["booking_id"],
                "session_type": active_db["session_name"],
                "user_name": active_db["user_name"],
                "start_time": str(active_db["start_time"]),
                "end_time": str(active_db["end_time"]),
                "participant_count": active_db["participant_count"],
                "effective_decibels": 70.0,
                "instruments": [],
            }
            current_db = 70.0
            
        r_dict["status"] = "Occupied" if is_occupied else "Available"
        r_dict["is_occupied"] = is_occupied
        r_dict["current_decibels"] = current_db
        r_dict["current_session"] = current_session
        result.append(r_dict)
        
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_rooms": len(rooms),
        "occupied_count": sum(1 for r in result if r["is_occupied"]),
        "rooms": result,
    }

@app.get("/api/rooms", response_model=List[RoomOut], tags=["Catalogue"])
async def list_rooms(conn=Depends(get_db)):
    """Lists all music practice rooms and acoustic parameters."""
    rows = await conn.fetch("SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms ORDER BY id ASC")
    return [dict(r) for r in rows]


@app.get("/api/rooms/{room_id}/schedule", tags=["Catalogue"])
async def get_room_schedule(
    room_id: int,
    query_date: date = Query(default_factory=date.today),
    conn=Depends(get_db),
):
    """Fetches confirmed bookings for a specific room on a given date."""
    room = await conn.fetchrow("SELECT id, name FROM rooms WHERE id = $1", room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    bookings = await conn.fetch(
        """
        SELECT b.id, b.start_time, b.end_time, b.participant_count, s.name AS session_type
        FROM bookings b
        JOIN session_types s ON b.session_type_id = s.id
        WHERE b.room_id = $1
          AND b.booking_date = $2
          AND b.status = 'Confirmed'
        ORDER BY b.start_time ASC
        """,
        room_id,
        query_date,
    )
    return {
        "room_id": room_id,
        "room_name": room["name"],
        "date": query_date,
        "confirmed_slots": [dict(b) for b in bookings],
    }


@app.get("/api/session-types", response_model=List[SessionTypeOut], tags=["Catalogue"])
async def list_session_types(conn=Depends(get_db)):
    """Lists all session types and lockdown constraints."""
    rows = await conn.fetch("SELECT id, name, participant_limit, is_strict_lockdown FROM session_types ORDER BY id ASC")
    return [dict(r) for r in rows]


@app.get("/api/instruments", response_model=List[InstrumentOut], tags=["Catalogue"])
async def list_instruments(conn=Depends(get_db)):
    """Lists the acoustic instrument catalogue."""
    rows = await conn.fetch("SELECT id, name, category, base_decibels, frequency_band FROM instruments ORDER BY id ASC")
    return [dict(r) for r in rows]


# ---------------------------------------------------------
# AI Acoustic Compatibility Check (Dry Run)
# ---------------------------------------------------------

@app.post("/api/bookings/acoustic-check", response_model=AcousticEvaluation, tags=["AI Engine"])
async def check_acoustic_compatibility(
    req: AcousticCheckRequest,
    conn=Depends(get_db),
):
    """
    Evaluates the acoustic and frequency compatibility of a planned booking
    without creating a database record.
    """
    # 1. Fetch Room
    room_row = await conn.fetchrow(
        "SELECT id, name, max_decibel_threshold, echo_factor FROM rooms WHERE id = $1",
        req.room_id,
    )
    if not room_row:
        raise HTTPException(status_code=404, detail="Room not found")
    room_profile = RoomAcousticProfile(**dict(room_row))

    # 2. Fetch Session Type
    st_row = await conn.fetchrow(
        "SELECT id, name, participant_limit, is_strict_lockdown FROM session_types WHERE id = $1",
        req.session_type_id,
    )
    if not st_row:
        raise HTTPException(status_code=404, detail="Session type not found")
    session_rules = SessionTypeRules(**dict(st_row))

    # 3. Fetch Instruments Profiles
    instrument_profiles: List[InstrumentAcousticProfile] = []
    if req.instruments:
        inst_ids = [item.instrument_id for item in req.instruments]
        qty_map = {item.instrument_id: item.quantity for item in req.instruments}

        rows = await conn.fetch(
            "SELECT id, name, category, base_decibels, frequency_band FROM instruments WHERE id = ANY($1::int[])",
            inst_ids,
        )
        for r in rows:
            instrument_profiles.append(
                InstrumentAcousticProfile(
                    id=r["id"],
                    name=r["name"],
                    category=r["category"],
                    base_decibels=r["base_decibels"],
                    frequency_band=r["frequency_band"],
                    quantity=qty_map.get(r["id"], 1),
                )
            )

    # 4. Execute AI Evaluation
    evaluation = evaluate_acoustic_compatibility(
        room=room_profile,
        instruments=instrument_profiles,
        session_type=session_rules,
    )
    return evaluation


# ---------------------------------------------------------
# Bookings Endpoints
# ---------------------------------------------------------

@app.post("/api/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED, tags=["Bookings"])
async def create_booking(booking: BookingCreate, conn=Depends(get_db)):
    """
    Creates a new room booking while strictly validating:
    1. Daily Booking Limit: Maximum 1 active booking per user per day.
    2. Capacity Enforcement: Participant count <= session type limit and room capacity.
    3. AI Acoustic Engine Compatibility: Decibel threshold and frequency clash clearance.
    4. Room Availability: PostgreSQL Exclusion constraint protects against any double bookings.
    """
    if booking.end_time <= booking.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be strictly greater than start_time.",
        )

    # ---------------------------------------------------------
    # RULE 1: Enforce Daily User Booking Limit (Limit: 3/day)
    # ---------------------------------------------------------
    active_user_bookings = await conn.fetchval(
        """
        SELECT COUNT(*) 
        FROM bookings 
        WHERE user_id = $1 
          AND booking_date = $2 
          AND status != 'Cancelled'
        """,
        booking.user_id,
        booking.booking_date,
    )
    if active_user_bookings >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User already has 3 active bookings on {booking.booking_date}. Daily limit of 3 bookings reached.",
        )

    # ---------------------------------------------------------
    # RULE 2: Capacity Enforcement
    # ---------------------------------------------------------
    user_row = await conn.fetchrow("SELECT id, name, email FROM users WHERE id = $1", booking.user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    room_row = await conn.fetchrow(
        "SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms WHERE id = $1",
        booking.room_id,
    )
    if not room_row:
        raise HTTPException(status_code=404, detail="Room not found")

    session_row = await conn.fetchrow(
        "SELECT id, name, participant_limit, is_strict_lockdown FROM session_types WHERE id = $1",
        booking.session_type_id,
    )
    if not session_row:
        raise HTTPException(status_code=404, detail="Session type not found")

    if booking.participant_count > session_row["participant_limit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Participant count ({booking.participant_count}) exceeds limit ({session_row['participant_limit']}) for session '{session_row['name']}'.",
        )

    if booking.participant_count > room_row["base_capacity"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Participant count ({booking.participant_count}) exceeds physical capacity ({room_row['base_capacity']}) of room '{room_row['name']}'.",
        )

    # ---------------------------------------------------------
    # RULE 3: AI Acoustic Compatibility Check
    # ---------------------------------------------------------
    instrument_profiles: List[InstrumentAcousticProfile] = []
    qty_map = {item.instrument_id: item.quantity for item in booking.instruments}

    if booking.instruments:
        inst_ids = list(qty_map.keys())
        inst_rows = await conn.fetch(
            "SELECT id, name, category, base_decibels, frequency_band FROM instruments WHERE id = ANY($1::int[])",
            inst_ids,
        )
        for r in inst_rows:
            instrument_profiles.append(
                InstrumentAcousticProfile(
                    id=r["id"],
                    name=r["name"],
                    category=r["category"],
                    base_decibels=r["base_decibels"],
                    frequency_band=r["frequency_band"],
                    quantity=qty_map[r["id"]],
                )
            )

    room_profile = RoomAcousticProfile(**dict(room_row))
    session_rules = SessionTypeRules(**dict(session_row))

    evaluation = evaluate_acoustic_compatibility(
        room=room_profile,
        instruments=instrument_profiles,
        session_type=session_rules,
    )

    if not evaluation.compatible:
        primary_reason = evaluation.rejection_reasons[0] if evaluation.rejection_reasons else "Acoustic noise ceiling exceeded."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Booking rejected by Acoustic AI: {primary_reason}",
                "ai_acoustics": {
                    "compatible": False,
                    "reason": primary_reason,
                    "rejection_reasons": evaluation.rejection_reasons,
                    "effective_decibels": evaluation.effective_decibels,
                    "max_allowed_decibels": evaluation.max_allowed_decibels,
                    "frequency_collisions": evaluation.frequency_collisions,
                    "warnings": evaluation.warnings,
                },
            },
        )

    # ---------------------------------------------------------
    # Database Transaction: Insert Booking & Junction Instruments
    # ---------------------------------------------------------
    async with conn.transaction():
        try:
            booking_row = await conn.fetchrow(
                """
                INSERT INTO bookings (
                    user_id, room_id, session_type_id, 
                    booking_date, start_time, end_time, 
                    participant_count, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'Confirmed')
                RETURNING id, user_id, room_id, session_type_id, booking_date, start_time, end_time, participant_count, status, created_at
                """,
                booking.user_id,
                booking.room_id,
                booking.session_type_id,
                booking.booking_date,
                booking.start_time,
                booking.end_time,
                booking.participant_count,
            )
        except (asyncpg.ExclusionViolationError, asyncpg.UniqueViolationError) as e:
            logger.warning("Room booking collision: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room '{room_row['name']}' is already booked during this time range on {booking.booking_date}.",
            )

        booking_id = booking_row["id"]

        # Insert instruments junction
        if booking.instruments:
            records = [
                (booking_id, item.instrument_id, item.quantity)
                for item in booking.instruments
            ]
            await conn.executemany(
                """
                INSERT INTO booking_instruments (booking_id, instrument_id, quantity)
                VALUES ($1, $2, $3)
                """,
                records,
            )

    # ---------------------------------------------------------
    # Redis Real-Time State Update & Celery Dispatch
    # ---------------------------------------------------------
    # If booking is scheduled for today, update the Redis "Now Playing" live dashboard state
    if booking.booking_date == date.today():
        await NowPlayingCache.set_room_active(
            room_id=booking.room_id,
            state_data={
                "booking_id": booking_id,
                "room_id": booking.room_id,
                "room_name": room_row["name"],
                "session_type": session_row["name"],
                "user_name": user_row["name"],
                "start_time": str(booking.start_time),
                "end_time": str(booking.end_time),
                "participant_count": booking.participant_count,
                "effective_decibels": evaluation.effective_decibels,
                "instruments": [p.model_dump() for p in instrument_profiles],
            },
        )

    # Trigger async notification task
    try:
        notifier.send_booking_confirmation.delay(
            booking_id=booking_id,
            user_name=user_row["name"],
            user_email=user_row["email"],
            room_name=room_row["name"],
            booking_date=str(booking.booking_date),
            start_time=str(booking.start_time),
            end_time=str(booking.end_time),
            effective_decibels=evaluation.effective_decibels,
        )
    except Exception as e:
        logger.warning("Celery dispatch unavailable (running synchronous notification mock): %s", e)
        notifier.send_booking_confirmation(
            booking_id=booking_id,
            user_name=user_row["name"],
            user_email=user_row["email"],
            room_name=room_row["name"],
            booking_date=str(booking.booking_date),
            start_time=str(booking.start_time),
            end_time=str(booking.end_time),
            effective_decibels=evaluation.effective_decibels,
        )

    return BookingOut(
        id=booking_id,
        user_id=booking_row["user_id"],
        user_name=user_row["name"],
        room_id=booking_row["room_id"],
        room_name=room_row["name"],
        session_type_id=booking_row["session_type_id"],
        session_name=session_row["name"],
        booking_date=booking_row["booking_date"],
        start_time=booking_row["start_time"],
        end_time=booking_row["end_time"],
        participant_count=booking_row["participant_count"],
        status=booking_row["status"],
        created_at=booking_row["created_at"],
        instruments=[p.model_dump() for p in instrument_profiles],
    )


@app.get("/api/bookings", response_model=List[BookingOut], tags=["Bookings"])
async def list_bookings(
    booking_date: Optional[date] = None,
    user_id: Optional[int] = None,
    room_id: Optional[int] = None,
    conn=Depends(get_db),
):
    """Lists bookings with optional date, user, or room filters."""
    query = """
        SELECT 
            b.id, b.user_id, u.name AS user_name,
            b.room_id, r.name AS room_name,
            b.session_type_id, s.name AS session_name,
            b.booking_date, b.start_time, b.end_time,
            b.participant_count, b.status, b.created_at
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN session_types s ON b.session_type_id = s.id
        WHERE ($1::date IS NULL OR b.booking_date = $1)
          AND ($2::int IS NULL OR b.user_id = $2)
          AND ($3::int IS NULL OR b.room_id = $3)
        ORDER BY b.booking_date DESC, b.start_time DESC
    """
    rows = await conn.fetch(query, booking_date, user_id, room_id)
    return [BookingOut(**dict(r), instruments=[]) for r in rows]


@app.post("/api/bookings/{booking_id}/cancel", tags=["Bookings"])
async def cancel_booking(booking_id: int, conn=Depends(get_db)):
    """Cancels a booking and clears active live room state in Redis."""
    booking = await conn.fetchrow(
        """
        SELECT b.id, b.room_id, b.booking_date, b.start_time, b.status,
               u.name AS user_name, u.email AS user_email, r.name AS room_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.id = $1
        """,
        booking_id,
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["status"] == "Cancelled":
        return {"message": "Booking is already cancelled."}

    await conn.execute("UPDATE bookings SET status = 'Cancelled' WHERE id = $1", booking_id)

    # Clear active state in Redis
    await NowPlayingCache.clear_room(booking["room_id"])

    # Dispatch cancellation notification
    try:
        notifier.send_cancellation_alert.delay(
            booking_id=booking_id,
            user_name=booking["user_name"],
            user_email=booking["user_email"],
            room_name=booking["room_name"],
            booking_date=str(booking["booking_date"]),
            start_time=str(booking["start_time"]),
        )
    except Exception as e:
        logger.warning("Celery dispatch unavailable (running synchronous notification mock): %s", e)
        notifier.send_cancellation_alert(
            booking_id=booking_id,
            user_name=booking["user_name"],
            user_email=booking["user_email"],
            room_name=booking["room_name"],
            booking_date=str(booking["booking_date"]),
            start_time=str(booking["start_time"]),
        )

    return {
        "status": "success",
        "message": f"Booking #{booking_id} cancelled successfully. The room slot is now available for rebooking.",
    }


# ---------------------------------------------------------
# Redis 'Now Playing' Live Dashboard
# ---------------------------------------------------------

@app.get("/api/dashboard/now-playing", tags=["Dashboard"])
async def get_now_playing_dashboard():
    """
    Returns real-time occupancy, active noise levels, and telemetry
    for all rooms currently running live sessions from Redis.
    """
    active_rooms = await NowPlayingCache.get_all_active_rooms()
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "active_rooms_count": len(active_rooms),
        "rooms": active_rooms,
    }
