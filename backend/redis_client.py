"""
Saraang App - Redis Client for 'Now Playing' Live Room Dashboard

Maintains fast in-memory room occupancy states, active noise levels, and current
booking telemetry for instant dashboard queries without heavy database polling.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Global async redis connection pool
_redis_pool: Optional[aioredis.Redis] = None


async def get_redis_client() -> Optional[aioredis.Redis]:
    """Retrieves or initializes the async Redis client."""
    global _redis_pool
    if _redis_pool is None:
        try:
            _redis_pool = aioredis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
            await _redis_pool.ping()
            logger.info("Successfully connected to Redis at %s", REDIS_URL)
        except Exception as e:
            logger.warning("Redis connection failed (%s); running in fallback cache mode.", e)
            _redis_pool = None
    return _redis_pool


async def close_redis_client():
    """Closes Redis connections gracefully upon application shutdown."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


class NowPlayingCache:
    """Manages the 'Now Playing' live room occupancy state."""

    KEY_PREFIX = "saraang:now_playing:room"
    ACTIVE_ROOMS_SET = "saraang:now_playing:active_rooms"

    @classmethod
    async def set_room_active(
        cls, room_id: int, state_data: Dict[str, Any], ttl_seconds: int = 7200
    ) -> bool:
        """Sets the live state for a room when a session is active."""
        redis = await get_redis_client()
        if not redis:
            return False

        try:
            key = f"{cls.KEY_PREFIX}:{room_id}"
            serialized = json.dumps(state_data)
            await redis.set(key, serialized, ex=ttl_seconds)
            await redis.sadd(cls.ACTIVE_ROOMS_SET, str(room_id))
            return True
        except Exception as e:
            logger.error("Failed to write to Redis for room %s: %s", room_id, e)
            return False

    @classmethod
    async def get_room_state(cls, room_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves the live state for a given room."""
        redis = await get_redis_client()
        if not redis:
            return None

        try:
            key = f"{cls.KEY_PREFIX}:{room_id}"
            raw = await redis.get(key)
            if raw:
                return json.loads(raw)
            return None
        except Exception as e:
            logger.error("Failed to read Redis for room %s: %s", room_id, e)
            return None

    @classmethod
    async def clear_room(cls, room_id: int) -> bool:
        """Removes a room from active status (e.g. Upon cancellation or completion)."""
        redis = await get_redis_client()
        if not redis:
            return False

        try:
            key = f"{cls.KEY_PREFIX}:{room_id}"
            await redis.delete(key)
            await redis.srem(cls.ACTIVE_ROOMS_SET, str(room_id))
            return True
        except Exception as e:
            logger.error("Failed to clear room %s from Redis: %s", room_id, e)
            return False

    @classmethod
    async def get_all_active_rooms(cls) -> List[Dict[str, Any]]:
        """Returns the current 'Now Playing' dashboard view for all active rooms."""
        redis = await get_redis_client()
        if not redis:
            return []

        try:
            room_ids = await redis.smembers(cls.ACTIVE_ROOMS_SET)
            results = []
            for r_id in room_ids:
                state = await cls.get_room_state(int(r_id))
                if state:
                    results.append(state)
                else:
                    # Stale set cleanup
                    await redis.srem(cls.ACTIVE_ROOMS_SET, r_id)
            return results
        except Exception as e:
            logger.error("Failed to fetch all active rooms from Redis: %s", e)
            return []
