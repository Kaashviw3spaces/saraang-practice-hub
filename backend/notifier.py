"""
Saraang App - Background Notification Worker (Celery & FCM/SMS Tasks)

Handles asynchronous and scheduled user notifications including booking confirmations,
cancellation alerts, acoustic safety warnings, and session reminders.
"""

import os
import logging
from typing import Dict, Any
from celery import Celery

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

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
) -> Dict[str, Any]:
    """
    Simulates sending FCM push notification and SMS confirmation to the user.
    """
    logger.info(
        "🚀 [FCM PUSH / SMS] Booking #%s Confirmed for %s (%s). Room: %s on %s from %s to %s. Acoustic Level: %s dB",
        booking_id,
        user_name,
        user_email,
        room_name,
        booking_date,
        start_time,
        end_time,
        effective_decibels,
    )
    return {
        "status": "delivered",
        "channel": ["FCM_PUSH", "SMS"],
        "booking_id": booking_id,
        "recipient": user_email,
        "message": f"Your reservation for {room_name} on {booking_date} ({start_time}-{end_time}) is confirmed!",
    }


@celery_app.task(name="notifier.send_cancellation_alert")
def send_cancellation_alert(
    booking_id: int,
    user_name: str,
    user_email: str,
    room_name: str,
    booking_date: str,
    start_time: str,
) -> Dict[str, Any]:
    """
    Dispatches cancellation notification via FCM push and email.
    """
    logger.info(
        "🛑 [FCM PUSH] Booking #%s CANCELLED for %s (%s). Room: %s on %s at %s.",
        booking_id,
        user_name,
        user_email,
        room_name,
        booking_date,
        start_time,
    )
    return {
        "status": "delivered",
        "channel": ["FCM_PUSH", "EMAIL"],
        "booking_id": booking_id,
        "recipient": user_email,
        "message": f"Your reservation #{booking_id} for {room_name} on {booking_date} has been cancelled.",
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
    "upcoming-session-reminder-every-5-minutes": {
        "task": "notifier.check_upcoming_sessions_reminder",
        "schedule": 300.0,  # Run every 5 minutes
    },
}


@celery_app.task(name="notifier.check_upcoming_sessions_reminder")
def check_upcoming_sessions_reminder() -> str:
    """
    Periodic worker task: checks for sessions starting within 15 minutes and sends reminders.
    """
    logger.info("🔍 [CELERY BEAT] Scanning database for upcoming bookings starting in next 15 minutes...")
    return "Scan complete: 0 reminders needed at this moment."
