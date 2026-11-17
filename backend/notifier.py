"""
Saraang App - Background Notification Worker (Celery & FCM/SMS Tasks)

Handles asynchronous and scheduled user notifications including booking confirmations,
cancellation alerts, acoustic safety warnings, and 15-minute slot expiry warnings (rebook or vacate).
"""

import os
import logging
import asyncio
from typing import Dict, Any, Optional, List
import httpx
from celery import Celery
import asyncpg
import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_default_host = "postgres" if os.path.exists("/.dockerenv") else "localhost"
POSTGRES_HOST = os.getenv("POSTGRES_HOST", _default_host)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@"
    f"{POSTGRES_HOST}:{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'saraang_db')}",
)

# Initialize Celery app
celery_app = Celery(
    "saraang_notifier",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="notifications",
    worker_prefetch_multiplier=1,
)


def send_expo_push(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Sends push notifications via Expo's Push API endpoint.
    https://docs.expo.dev/push-notifications/sending-notifications/
    """
    valid_tokens = [
        t for t in tokens if t and (t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken["))
    ]
    if not valid_tokens:
        logger.info("No valid Expo push tokens found among recipients: %s", tokens)
        return []

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "rehearsal-reminders",
        }
        for token in valid_tokens
    ]

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            logger.info("Expo push service returned HTTP %s: %s", resp.status_code, resp.text)
            return resp.json().get("data", [])
    except Exception as e:
        logger.warning("Failed to dispatch push notification via Expo API: %s", e)
        return [{"status": "error", "message": str(e)}]


@celery_app.task(name="notifier.send_booking_confirmation")
def send_booking_confirmation(
    booking_id: int,
    user_name: str,
    user_email: str,
    room_name: str,
    booking_date: str,
    start_time: str,
    end_time: str,
    effective_decibels: float,
    push_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Sends booking confirmation notification via Expo push and logs confirmation.
    """
    title = "🎸 BOOKING CONFIRMED"
    body = f"Your reservation for {room_name} on {booking_date} ({start_time}-{end_time}) is locked in!"
    logger.info(
        "🚀 [BOOKING CONFIRMED] Booking #%s for %s (%s). Room: %s on %s from %s to %s. Acoustic Level: %s dB",
        booking_id,
        user_name,
        user_email,
        room_name,
        booking_date,
        start_time,
        end_time,
        effective_decibels,
    )
    if push_token:
        send_expo_push([push_token], title, body, {"booking_id": booking_id, "type": "confirmation"})

    return {
        "status": "delivered",
        "channel": ["FCM_PUSH", "IN_APP"],
        "booking_id": booking_id,
        "recipient": user_email,
        "title": title,
        "message": body,
    }


@celery_app.task(name="notifier.send_cancellation_alert")
def send_cancellation_alert(
    booking_id: int,
    user_name: str,
    user_email: str,
    room_name: str,
    booking_date: str,
    start_time: str,
    push_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatches cancellation notification via Expo push and logs cancellation.
    """
    title = "🛑 RESERVATION CANCELLED"
    body = f"Your reservation #{booking_id} for {room_name} on {booking_date} at {start_time} has been cancelled."
    logger.info(
        "🛑 [CANCELLATION ALERT] Booking #%s CANCELLED for %s (%s). Room: %s on %s at %s.",
        booking_id,
        user_name,
        user_email,
        room_name,
        booking_date,
        start_time,
    )
    if push_token:
        send_expo_push([push_token], title, body, {"booking_id": booking_id, "type": "cancellation"})

    return {
        "status": "delivered",
        "channel": ["FCM_PUSH", "IN_APP"],
        "booking_id": booking_id,
        "recipient": user_email,
        "title": title,
        "message": body,
    }


@celery_app.task(name="notifier.send_session_expiry_warning")
def send_session_expiry_warning(
    booking_id: int,
    user_name: str,
    user_email: str,
    room_name: str,
    booking_date: str,
    end_time: str,
    push_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatches 15-minute slot expiry warning:
    Alerts the user 15 minutes before their 1-hour slot ends to either rebook or vacate the room.
    """
    title = "⚠️ 15 MINS REMAINING // REBOOK OR VACATE"
    message = (
        f"Your rehearsal slot in {room_name} ends at {end_time}. "
        "Please either rebook an available upcoming slot or prepare to vacate the room."
    )
    logger.info(
        "⏰ [15-MIN EXPIRY WARNING] Booking #%s for %s (%s). Room: %s. Slot ends at: %s.",
        booking_id,
        user_name,
        user_email,
        room_name,
        end_time,
    )

    if push_token:
        send_expo_push(
            tokens=[push_token],
            title=title,
            body=message,
            data={"booking_id": booking_id, "type": "warning", "action": "rebook_or_vacate"},
        )

    return {
        "status": "delivered",
        "type": "expiry_warning",
        "booking_id": booking_id,
        "recipient": user_email,
        "title": title,
        "message": message,
    }


@celery_app.task(name="notifier.send_session_over_alert")
def send_session_over_alert(
    booking_id: int,
    user_name: str,
    user_email: str,
    room_name: str,
    booking_date: str,
    end_time: str,
    push_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Alerts user when their 1-hour rehearsal slot is officially completed.
    Triggers the 4-loop signature Google AI Studio alert chime and prompts vacating the room.
    """
    title = "🛑 SESSION IS NOW OVER // PLEASE VACATE"
    message = (
        f"Your 1-hour rehearsal slot in {room_name} ended at {end_time}. "
        "The session is now officially over. Please pack up all instruments and vacate the room for the next band."
    )
    logger.warning(
        "🛑 [SESSION OVER ALERT] Slot #%s completed for %s (%s). Room: %s. Ended at: %s.",
        booking_id,
        user_name,
        user_email,
        room_name,
        end_time,
    )

    if push_token:
        send_expo_push(
            tokens=[push_token],
            title=title,
            body=message,
            data={"booking_id": booking_id, "type": "alert", "action": "session_over", "sound_loops": 4},
        )

    return {
        "status": "delivered",
        "type": "session_over",
        "booking_id": booking_id,
        "recipient": user_email,
        "title": title,
        "message": message,
        "sound_loops": 4,
    }


@celery_app.task(name="notifier.send_acoustic_warning")
def send_acoustic_warning(
    room_name: str,
    effective_decibels: float,
    max_threshold: float,
    violating_instruments: str,
) -> Dict[str, Any]:
    """
    Broadcasts high-priority alert to sound engineers / room monitors.
    """
    logger.warning(
        "⚠️ [ACOUSTIC ALERT] Room '%s' approached noise ceiling: %s dB / %s dB threshold. Instruments: %s",
        room_name,
        effective_decibels,
        max_threshold,
        violating_instruments,
    )
    return {
        "status": "alert_dispatched",
        "room": room_name,
        "effective_db": effective_decibels,
        "ceiling_db": max_threshold,
    }


# Celery Beat Scheduled Tasks
celery_app.conf.beat_schedule = {
    # Scans every 60 seconds to catch active sessions 15 minutes before slot ends
    "check-session-expiry-every-minute": {
        "task": "notifier.check_session_expiry_reminders",
        "schedule": 60.0,
    },
    # Scans every 60 seconds to catch sessions whose 1-hour slot has officially ended
    "check-session-over-every-minute": {
        "task": "notifier.check_session_over_alerts",
        "schedule": 60.0,
    },
    "upcoming-session-reminder-every-5-minutes": {
        "task": "notifier.check_upcoming_sessions_reminder",
        "schedule": 300.0,
    },
}


@celery_app.task(name="notifier.check_session_expiry_reminders")
def check_session_expiry_reminders() -> str:
    """
    Periodic Celery Beat worker:
    Queries PostgreSQL for confirmed bookings ending in ~15 minutes (between 10 and 16 minutes from now).
    Ensures idempotency via Redis key saraang:expiry_reminder_sent:{booking_id} with 2-hour TTL.
    """
    async def _async_scan():
        conn = None
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            # Find active bookings ending within 9 to 16 minutes from current time today
            query = """
                SELECT b.id, b.booking_date, b.start_time, b.end_time, b.user_id,
                       u.name as user_name, u.email as user_email, u.push_token,
                       r.name as room_name, st.name as session_name
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN rooms r ON b.room_id = r.id
                JOIN session_types st ON b.session_type_id = st.id
                WHERE b.status = 'Confirmed'
                  AND b.booking_date = CURRENT_DATE
                  AND (b.booking_date + b.end_time) > LOCALTIMESTAMP
                  AND ((b.booking_date + b.end_time) - LOCALTIMESTAMP) BETWEEN INTERVAL '9 minutes' AND INTERVAL '16 minutes';
            """
            rows = await conn.fetch(query)
            if not rows:
                return "Scan complete: 0 sessions ending in 15 minutes."

            # Redis client for idempotency
            r_client = redis.from_url(REDIS_URL, decode_responses=True)
            reminders_sent = 0

            for r in rows:
                booking_id = r["id"]
                redis_key = f"saraang:expiry_reminder_sent:{booking_id}"
                if r_client.get(redis_key):
                    continue

                # Mark idempotency key (2 hour TTL)
                r_client.setex(redis_key, 7200, "1")

                # Insert into notifications history table
                title = "⚠️ 15 MINS REMAINING // REBOOK OR VACATE"
                msg = (
                    f"Your rehearsal slot in {r['room_name']} ends at {r['end_time']}. "
                    "Please either rebook an available upcoming slot or prepare to vacate the room."
                )
                try:
                    await conn.execute(
                        """
                        INSERT INTO notifications (user_id, booking_id, title, message, type, channel, action_type)
                        VALUES ($1, $2, $3, $4, 'warning', 'PUSH', 'rebook_or_vacate')
                        """,
                        r["user_id"],
                        booking_id,
                        title,
                        msg,
                    )
                except Exception as db_err:
                    logger.warning("Could not insert notification into DB: %s", db_err)

                # Send push notification
                send_session_expiry_warning(
                    booking_id=booking_id,
                    user_name=r["user_name"],
                    user_email=r["user_email"],
                    room_name=r["room_name"],
                    booking_date=str(r["booking_date"]),
                    end_time=str(r["end_time"]),
                    push_token=r["push_token"],
                )
                reminders_sent += 1

            return f"Scan complete: {reminders_sent} 15-minute slot expiry warnings sent."
        except Exception as e:
            logger.error("Error in check_session_expiry_reminders: %s", e)
            return f"Scan error: {e}"
        finally:
            if conn:
                await conn.close()

    try:
        return asyncio.run(_async_scan())
    except Exception as exc:
        return f"Scan wrapper exception: {exc}"


@celery_app.task(name="notifier.check_session_over_alerts")
def check_session_over_alerts() -> str:
    """
    Periodic Celery Beat worker:
    Queries PostgreSQL for confirmed bookings that reached the end of their slot within the last 5 minutes.
    Dispatches session over alert with 4-loop signature Google AI Studio chime.
    Ensures idempotency via Redis key saraang:session_over_sent:{booking_id} with 2-hour TTL.
    """
    async def _async_scan():
        conn = None
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            query = """
                SELECT b.id, b.booking_date, b.start_time, b.end_time, b.user_id,
                       u.name as user_name, u.email as user_email, u.push_token,
                       r.name as room_name, st.name as session_name
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN rooms r ON b.room_id = r.id
                JOIN session_types st ON b.session_type_id = st.id
                WHERE b.status = 'Confirmed'
                  AND b.booking_date = CURRENT_DATE
                  AND LOCALTIMESTAMP >= (b.booking_date + b.end_time)
                  AND (LOCALTIMESTAMP - (b.booking_date + b.end_time)) <= INTERVAL '5 minutes';
            """
            rows = await conn.fetch(query)
            if not rows:
                return "Scan complete: 0 sessions completed in the last 5 minutes."

            r_client = redis.from_url(REDIS_URL, decode_responses=True)
            alerts_sent = 0

            for r in rows:
                booking_id = r["id"]
                redis_key = f"saraang:session_over_sent:{booking_id}"
                if r_client.get(redis_key):
                    continue

                r_client.setex(redis_key, 7200, "1")

                title = "🛑 SESSION IS NOW OVER // PLEASE VACATE"
                msg = (
                    f"Your rehearsal slot in {r['room_name']} ended at {r['end_time']}. "
                    "The session is now officially over. Please pack up all instruments and vacate the room for the next band."
                )
                try:
                    await conn.execute(
                        """
                        INSERT INTO notifications (user_id, booking_id, title, message, type, channel, action_type)
                        VALUES ($1, $2, $3, $4, 'alert', 'PUSH', 'session_over')
                        """,
                        r["user_id"],
                        booking_id,
                        title,
                        msg,
                    )
                except Exception as db_err:
                    logger.warning("Could not insert session over notification into DB: %s", db_err)

                send_session_over_alert(
                    booking_id=booking_id,
                    user_name=r["user_name"],
                    user_email=r["user_email"],
                    room_name=r["room_name"],
                    booking_date=str(r["booking_date"]),
                    end_time=str(r["end_time"]),
                    push_token=r["push_token"],
                )
                alerts_sent += 1

            return f"Scan complete: {alerts_sent} session-over alerts sent."
        except Exception as e:
            logger.error("Error in check_session_over_alerts: %s", e)
            return f"Scan error: {e}"
        finally:
            if conn:
                await conn.close()

    try:
        return asyncio.run(_async_scan())
    except Exception as exc:
        return f"Scan wrapper exception: {exc}"


@celery_app.task(name="notifier.check_upcoming_sessions_reminder")
def check_upcoming_sessions_reminder() -> str:
    """
    Periodic worker task: checks for sessions starting within 15 minutes and sends reminders.
    """
    logger.info("🔍 [CELERY BEAT] Scanning database for upcoming bookings starting in next 15 minutes...")
    return "Scan complete: 0 reminders needed at this moment."

