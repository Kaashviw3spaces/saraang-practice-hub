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
    room_id: Optional[int] = None
    session_type_id: int
    booking_date: date
    start_time: time
    end_time: time
    practice_mode: Optional[str] = "Solo Practice"
    participant_count: int = Field(default=1, gt=0)
    instruments: List[BookingInstrumentItem] = Field(default_factory=list)


class AcousticCheckRequest(BaseModel):
    room_id: Optional[int] = None
    session_type_id: int
    practice_mode: Optional[str] = "Solo Practice"
    instruments: List[BookingInstrumentItem] = Field(default_factory=list)


class BookingOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    room_id: int
    assigned_room_id: Optional[int] = None
    room_name: Optional[str] = None
    session_type_id: int
    session_name: Optional[str] = None
    booking_date: date
    start_time: time
    end_time: time
    practice_mode: Optional[str] = "Solo Practice"
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
# Session Policy Validation (Session A, Session B, Meeting Session)
# ---------------------------------------------------------

def validate_session_policy(
    session_name: str,
    practice_mode: Optional[str],
    instrument_rows: List[Dict[str, Any]],
) -> None:
    """
    Validates practice mode and instrument constraints based on session type:
    - Session A:
        Modes: Solo Practice, Collaborative Jam, Full Band Rehearsal.
        Solo Practice: Instruments array must contain only ONE instrument: Acoustic Drums or Electric Guitar.
        Full Band Rehearsal: Bypasses individual instrument checks ("All Instruments Included").
    - Session B:
        Modes: Solo Practice, Collaborative Jam (Full Band Rehearsal not allowed).
        Solo Practice: Instruments array must contain only ONE instrument.
        Acoustic Policy: Instruments must NOT contain Acoustic Drums or Electric Guitar.
    - Meeting Session:
        Bypasses instrument validation completely.
    """
    s_name = (session_name or "").strip().lower()
    mode = (practice_mode or "Solo Practice").strip()
    mode_lower = mode.lower()

    # 1. Meeting Session: Bypass completely
    if s_name == "meeting session":
        return

    def is_drums(name: str) -> bool:
        return "drum" in name.lower()

    def is_electric_guitar(name: str) -> bool:
        return "electric guitar" in name.lower()

    total_qty = sum(inst.get("quantity", 1) for inst in instrument_rows)

    # 2. Session A
    if s_name == "session a":
        valid_modes = ["solo practice", "collaborative jam", "full band rehearsal"]
        if mode_lower not in valid_modes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": f"Invalid practice mode '{mode}' for Session A.",
                    "ai_acoustics": {
                        "compatible": False,
                        "reason": "Session A only supports Solo Practice, Collaborative Jam, or Full Band Rehearsal.",
                    },
                },
            )

        if mode_lower == "full band rehearsal":
            # Bypasses individual instrument checks ("All Instruments Included")
            return

        if mode_lower == "solo practice":
            if len(instrument_rows) != 1 or total_qty != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Session A Solo Policy Violation: Solo practice requires selecting only ONE instrument.",
                        "ai_acoustics": {
                            "compatible": False,
                            "reason": "Session A Solo Policy: Solo practice requires selecting only ONE instrument (Acoustic Drums or Electric Guitar).",
                        },
                    },
                )
            inst_name = instrument_rows[0].get("name", "")
            if not (is_drums(inst_name) or is_electric_guitar(inst_name)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": f"Session A Solo Policy Violation: '{inst_name}' is not permitted.",
                        "ai_acoustics": {
                            "compatible": False,
                            "reason": f"Session A Solo Policy: Solo practice requires Acoustic Drums or Electric Guitar only. Selected: {inst_name}",
                        },
                    },
                )
        return

    # 3. Session B
    if s_name == "session b":
        valid_modes = ["solo practice", "collaborative jam"]
        if mode_lower == "full band rehearsal":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Session B does not permit Full Band Rehearsal.",
                    "ai_acoustics": {
                        "compatible": False,
                        "reason": "Session B Acoustic Policy: Full band rehearsals, drums, and electric guitar are not permitted in Session B.",
                    },
                },
            )
        if mode_lower not in valid_modes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": f"Invalid practice mode '{mode}' for Session B.",
                    "ai_acoustics": {
                        "compatible": False,
                        "reason": "Session B only supports Solo Practice or Collaborative Jam.",
                    },
                },
            )

        if mode_lower == "solo practice":
            if len(instrument_rows) != 1 or total_qty != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Session B Solo Policy Violation: Solo practice requires selecting only ONE instrument.",
                        "ai_acoustics": {
                            "compatible": False,
                            "reason": "Session B Solo Policy: Solo practice requires selecting only ONE instrument.",
                        },
                    },
                )

        for inst in instrument_rows:
            inst_name = inst.get("name", "")
            if is_drums(inst_name) or is_electric_guitar(inst_name):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": f"Session B Acoustic Policy Violation: '{inst_name}' is not permitted.",
                        "ai_acoustics": {
                            "compatible": False,
                            "reason": f"Session B Acoustic Policy: Full band rehearsals, drums, and electric guitar are not permitted. Prohibited: {inst_name}",
                        },
                    },
                )
        return

    # 4. Jam Session: Solo Practice and Full Band Rehearsal removed; Collaborative Jam only
    if s_name == "jam session":
        if mode_lower in ["solo practice", "full band rehearsal"] or mode_lower != "collaborative jam":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": f"Jam Session does not permit '{mode}'. Only Collaborative Jam is permitted.",
                    "ai_acoustics": {
                        "compatible": False,
                        "reason": "Jam Session Policy: Solo Practice and Full Band Rehearsal are not permitted in Jam Session. Only Collaborative Jam is supported.",
                    },
                },
            )
        return


# ---------------------------------------------------------
# Rooms, Session Types & Instruments Endpoints
# ---------------------------------------------------------

@app.get("/api/sessions/live", tags=["Catalogue", "Dashboard"])
async def get_live_sessions_status(conn=Depends(get_db)):
    """
    Returns real-time rehearsal occupancy and telemetry categorised strictly by SESSION,
    polling-compatible for the mobile app home screen (every 30s).
    """
    sessions = await conn.fetch(
        "SELECT id, name, participant_limit, is_strict_lockdown FROM session_types ORDER BY id ASC"
    )

    current_time_bookings = await conn.fetch(
        """
        SELECT 
            b.id AS booking_id, b.session_type_id, b.participant_count,
            b.start_time, b.end_time, b.practice_mode,
            u.name AS user_name, s.name AS session_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN session_types s ON b.session_type_id = s.id
        WHERE b.booking_date = CURRENT_DATE
          AND b.status = 'Confirmed'
          AND CURRENT_TIME BETWEEN b.start_time AND b.end_time
        """
    )
    active_by_session = {b["session_type_id"]: dict(b) for b in current_time_bookings}

    result = []
    for s in sessions:
        s_dict = dict(s)
        session_id = s["id"]
        active_db = active_by_session.get(session_id)
        is_occupied = active_db is not None
        current_session = None

        if active_db:
            current_session = {
                "booking_id": active_db["booking_id"],
                "session_type": active_db["session_name"],
                "practice_mode": active_db.get("practice_mode", "Solo Practice"),
                "user_name": active_db["user_name"],
                "start_time": str(active_db["start_time"]),
                "end_time": str(active_db["end_time"]),
                "participant_count": active_db["participant_count"],
            }

        s_dict["status"] = "On Air" if is_occupied else "Available"
        s_dict["is_occupied"] = is_occupied
        s_dict["current_session"] = current_session
        result.append(s_dict)

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_sessions": len(sessions),
        "occupied_count": sum(1 for s in result if s["is_occupied"]),
        "sessions": result,
    }


@app.get("/api/rooms/live", tags=["Catalogue", "Dashboard"])
async def get_live_rooms_status(conn=Depends(get_db)):
    """
    Returns real-time occupancy status for all rooms in a clean, minimalistic format,
    polling-compatible for the mobile app home screen (every 30s).
    """
    rooms = await conn.fetch("SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms ORDER BY id ASC")
    
    current_time_bookings = await conn.fetch(
        """
        SELECT 
            b.id AS booking_id, b.room_id, b.participant_count,
            b.start_time, b.end_time, b.practice_mode,
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
        
        if redis_state:
            current_session = {
                "booking_id": redis_state.get("booking_id"),
                "session_type": redis_state.get("session_type"),
                "practice_mode": redis_state.get("practice_mode", "Solo Practice"),
                "user_name": redis_state.get("user_name"),
                "start_time": redis_state.get("start_time"),
                "end_time": redis_state.get("end_time"),
                "participant_count": redis_state.get("participant_count"),
            }
        elif active_db:
            current_session = {
                "booking_id": active_db["booking_id"],
                "session_type": active_db["session_name"],
                "practice_mode": active_db.get("practice_mode", "Solo Practice"),
                "user_name": active_db["user_name"],
                "start_time": str(active_db["start_time"]),
                "end_time": str(active_db["end_time"]),
                "participant_count": active_db["participant_count"],
            }
            
        r_dict["status"] = "Occupied" if is_occupied else "Available"
        r_dict["is_occupied"] = is_occupied
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
    without creating a database record. Supports automatic candidate room evaluation.
    """
    # 1. Fetch Session Type
    st_row = await conn.fetchrow(
        "SELECT id, name, participant_limit, is_strict_lockdown FROM session_types WHERE id = $1",
        req.session_type_id,
    )
    if not st_row:
        raise HTTPException(status_code=404, detail="Session type not found")
    session_rules = SessionTypeRules(**dict(st_row))

    # 2. Fetch Instruments Profiles
    instrument_profiles: List[InstrumentAcousticProfile] = []
    inst_rows: List[Dict[str, Any]] = []
    if req.instruments:
        inst_ids = [item.instrument_id for item in req.instruments]
        qty_map = {item.instrument_id: item.quantity for item in req.instruments}

        rows = await conn.fetch(
            "SELECT id, name, category, base_decibels, frequency_band FROM instruments WHERE id = ANY($1::int[])",
            inst_ids,
        )
        inst_rows = [dict(r, quantity=qty_map.get(r["id"], 1)) for r in rows]
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

    # 3. Session & Practice Mode Policy Check
    validate_session_policy(session_rules.name, req.practice_mode, inst_rows)

    # 4. Fetch Candidate Rooms (Automatic room evaluation only - manual selection removed)
    p_mode_lower = (req.practice_mode or "Solo Practice").strip().lower()
    all_rooms_rows = await conn.fetch(
        "SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms ORDER BY id ASC"
    )
    all_rooms = [dict(r) for r in all_rooms_rows]
    if p_mode_lower == "solo practice":
        candidate_rooms = [r for r in all_rooms if "jam pod" not in r["name"].lower()]
    else:
        candidate_rooms = all_rooms

    s_name_lower = session_rules.name.lower()
    is_bypassed = s_name_lower == "meeting session" or (s_name_lower == "session a" and p_mode_lower == "full band rehearsal")

    first_room = candidate_rooms[0] if candidate_rooms else {"max_decibel_threshold": 115, "echo_factor": 1.0}
    if is_bypassed:
        return AcousticEvaluation(
            compatible=True,
            total_decibels=35.0,
            effective_decibels=35.0,
            max_allowed_decibels=float(first_room["max_decibel_threshold"]),
            echo_factor=first_room["echo_factor"],
            is_strict_lockdown=session_rules.is_strict_lockdown,
            frequency_band_distribution={},
            frequency_collisions=[],
            warnings=[],
            rejection_reasons=[],
        )

    last_eval = None
    for r in candidate_rooms:
        r_profile = RoomAcousticProfile(**r)
        eval_res = evaluate_acoustic_compatibility(
            room=r_profile,
            instruments=instrument_profiles,
            session_type=session_rules,
        )
        if eval_res.compatible:
            return eval_res
        last_eval = eval_res

    return last_eval or AcousticEvaluation(
        compatible=False,
        total_decibels=0.0,
        effective_decibels=0.0,
        max_allowed_decibels=0.0,
        echo_factor=1.0,
        is_strict_lockdown=session_rules.is_strict_lockdown,
        frequency_band_distribution={},
        frequency_collisions=[],
        warnings=[],
        rejection_reasons=["No candidate rooms can handle the acoustic load of the selected instruments."],
    )


# ---------------------------------------------------------
# Bookings Endpoints
# ---------------------------------------------------------

@app.post("/api/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED, tags=["Bookings"])
async def create_booking(booking: BookingCreate, conn=Depends(get_db)):
    """
    Creates a new room booking while strictly validating:
    1. Daily Booking Limit: Maximum 3 active bookings per user per day.
    2. Capacity Enforcement: Participant count <= session type limit.
    3. Session Mode & Instrument Policies: Strict single-instrument Solo Practice, Session B acoustic limits.
    4. Auto-Room Assignment: Automatic room selection with Jam Pod exclusion for Solo Practice and AI acoustic clearance.
    5. Room Availability: PostgreSQL Exclusion constraint protects against double bookings.
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
    # RULE 2: User & Session Type Validation
    # ---------------------------------------------------------
    user_row = await conn.fetchrow("SELECT id, name, email FROM users WHERE id = $1", booking.user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

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

    # ---------------------------------------------------------
    # RULE 3: Session Policy Validation
    # ---------------------------------------------------------
    instrument_profiles: List[InstrumentAcousticProfile] = []
    inst_rows: List[Dict[str, Any]] = []
    qty_map = {item.instrument_id: item.quantity for item in booking.instruments}

    if booking.instruments:
        inst_ids = list(qty_map.keys())
        rows = await conn.fetch(
            "SELECT id, name, category, base_decibels, frequency_band FROM instruments WHERE id = ANY($1::int[])",
            inst_ids,
        )
        inst_rows = [dict(r, quantity=qty_map.get(r["id"], 1)) for r in rows]
        for r in rows:
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

    # Enforce Session A / Session B / Meeting Session mode & instrument constraints
    validate_session_policy(session_row["name"], booking.practice_mode, inst_rows)

    # ---------------------------------------------------------
    # Auto-Room Assignment & Acoustic Validation (CRITICAL)
    # ---------------------------------------------------------
    all_rooms_rows = await conn.fetch(
        "SELECT id, name, base_capacity, max_decibel_threshold, echo_factor FROM rooms ORDER BY id ASC"
    )
    all_rooms = [dict(r) for r in all_rooms_rows]

    # Find rooms already booked for the requested date and time slot
    busy_rows = await conn.fetch(
        """
        SELECT room_id FROM bookings
        WHERE booking_date = $1
          AND status != 'Cancelled'
          AND (start_time < $3 AND end_time > $2)
        """,
        booking.booking_date,
        booking.start_time,
        booking.end_time,
    )
    busy_room_ids = {r["room_id"] for r in busy_rows}
    available_rooms = [r for r in all_rooms if r["id"] not in busy_room_ids]

    p_mode_lower = (booking.practice_mode or "Solo Practice").strip().lower()

    # Auto-assignment (Manual room selection removed altogether):
    # Jam Pod Constraint: If Solo Practice, filter out "Jam Pod" rooms from available pool
    if p_mode_lower == "solo practice":
        candidate_rooms = [r for r in available_rooms if "jam pod" not in r["name"].lower()]
    else:
        candidate_rooms = list(available_rooms)

    # Capacity check: room must be able to accommodate requested participants
    candidate_rooms = [r for r in candidate_rooms if r["base_capacity"] >= booking.participant_count]

    if not candidate_rooms:
        if not available_rooms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No rooms are available for the requested time slot.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No available rooms can accommodate {booking.participant_count} participants for this session mode.",
        )

    s_name_lower = session_row["name"].lower()
    is_bypassed = s_name_lower == "meeting session" or (s_name_lower == "session a" and p_mode_lower == "full band rehearsal")
    session_rules = SessionTypeRules(**dict(session_row))

    assigned_room = None
    chosen_evaluation = None
    last_eval = None

    for room_cand in candidate_rooms:
        room_profile = RoomAcousticProfile(**room_cand)
        if is_bypassed:
            assigned_room = room_cand
            chosen_evaluation = AcousticEvaluation(
                compatible=True,
                total_decibels=35.0,
                effective_decibels=35.0,
                max_allowed_decibels=float(room_profile.max_decibel_threshold),
                echo_factor=room_profile.echo_factor,
                is_strict_lockdown=session_rules.is_strict_lockdown,
                frequency_band_distribution={},
                frequency_collisions=[],
                warnings=[],
                rejection_reasons=[],
            )
            break
        else:
            eval_result = evaluate_acoustic_compatibility(
                room=room_profile,
                instruments=instrument_profiles,
                session_type=session_rules,
            )
            if eval_result.compatible:
                assigned_room = room_cand
                chosen_evaluation = eval_result
                break
            else:
                last_eval = eval_result

    if not assigned_room:
        primary_reason = "No available rooms can handle the acoustic load of your selected instruments at this time."
        rejection_reasons = (
            last_eval.rejection_reasons if last_eval and last_eval.rejection_reasons else [primary_reason]
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Booking rejected by Acoustic AI: {primary_reason}",
                "ai_acoustics": {
                    "compatible": False,
                    "reason": primary_reason,
                    "rejection_reasons": rejection_reasons,
                    "effective_decibels": last_eval.effective_decibels if last_eval else 0.0,
                    "max_allowed_decibels": last_eval.max_allowed_decibels if last_eval else 0.0,
                    "frequency_collisions": last_eval.frequency_collisions if last_eval else [],
                    "warnings": last_eval.warnings if last_eval else [],
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
                    participant_count, status, practice_mode
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'Confirmed', $8)
                RETURNING id, user_id, room_id, session_type_id, booking_date, start_time, end_time, participant_count, status, practice_mode, created_at
                """,
                booking.user_id,
                assigned_room["id"],
                booking.session_type_id,
                booking.booking_date,
                booking.start_time,
                booking.end_time,
                booking.participant_count,
                booking.practice_mode or "Solo Practice",
            )
        except (asyncpg.ExclusionViolationError, asyncpg.UniqueViolationError) as e:
            logger.warning("Room booking collision: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room '{assigned_room['name']}' is already booked during this time range on {booking.booking_date}.",
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
    if booking.booking_date == date.today():
        await NowPlayingCache.set_room_active(
            room_id=assigned_room["id"],
            state_data={
                "booking_id": booking_id,
                "room_id": assigned_room["id"],
                "room_name": assigned_room["name"],
                "session_type": session_row["name"],
                "practice_mode": booking.practice_mode or "Solo Practice",
                "user_name": user_row["name"],
                "start_time": str(booking.start_time),
                "end_time": str(booking.end_time),
                "participant_count": booking.participant_count,
            },
        )

    # Trigger async notification task
    evaluation_effective_db = chosen_evaluation.effective_decibels if chosen_evaluation else 35.0
    try:
        notifier.send_booking_confirmation.delay(
            booking_id=booking_id,
            user_name=user_row["name"],
            user_email=user_row["email"],
            room_name=assigned_room["name"],
            booking_date=str(booking.booking_date),
            start_time=str(booking.start_time),
            end_time=str(booking.end_time),
            effective_decibels=evaluation_effective_db,
        )
    except Exception as e:
        logger.warning("Celery dispatch unavailable (running synchronous notification mock): %s", e)
        notifier.send_booking_confirmation(
            booking_id=booking_id,
            user_name=user_row["name"],
            user_email=user_row["email"],
            room_name=assigned_room["name"],
            booking_date=str(booking.booking_date),
            start_time=str(booking.start_time),
            end_time=str(booking.end_time),
            effective_decibels=evaluation_effective_db,
        )

    return BookingOut(
        id=booking_id,
        user_id=booking_row["user_id"],
        user_name=user_row["name"],
        room_id=assigned_room["id"],
        assigned_room_id=assigned_room["id"],
        room_name=assigned_room["name"],
        session_type_id=booking_row["session_type_id"],
        session_name=session_row["name"],
        booking_date=booking_row["booking_date"],
        start_time=booking_row["start_time"],
        end_time=booking_row["end_time"],
        practice_mode=booking_row["practice_mode"],
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
            b.participant_count, b.status, b.created_at,
            b.practice_mode
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
    return [BookingOut(**dict(r), assigned_room_id=r["room_id"], instruments=[]) for r in rows]


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
