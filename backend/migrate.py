"""Transactional, checksum-checked migrations; safe on existing databases."""
import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg


async def migrate():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"], command_timeout=60)
    try:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(73912001)")
            await conn.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY, checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
            root = Path(__file__).resolve().parent
            sources = [root / "sql" / "01_schema.sql", root / "sql" / "02_seed.sql"]
            sources += sorted((root / "migrations").glob("*.sql"))
            for source in sources:
                content = source.read_text()
                checksum = hashlib.sha256(content.encode()).hexdigest()
                previous = await conn.fetchval(
                    "SELECT checksum FROM schema_migrations WHERE name=$1", source.name)
                if previous:
                    if previous != checksum:
                        raise RuntimeError(f"Applied migration changed: {source.name}")
                    continue
                # The original bootstrap names a particular database. Session UTC
                # works equally on managed PostgreSQL without ALTER DATABASE rights.
                content = content.replace("ALTER DATABASE saraang_db SET timezone TO 'UTC';", "")
                # Existing installations already have their catalogues and must
                # not have custom values overwritten by the original seed file.
                if source.name != "02_seed.sql" or not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM session_types)"):
                    await conn.execute(content)
                await conn.execute("INSERT INTO schema_migrations(name, checksum) VALUES($1,$2)",
                                   source.name, checksum)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
