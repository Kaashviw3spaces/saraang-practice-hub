"""Production entrypoint. Original application and frontend remain untouched."""
import os
from contextlib import asynccontextmanager

from fastapi import HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

import main
from email_verification import verification_router

app = main.app


@asynccontextmanager
async def lifespan(app):
    for name in ("DATABASE_URL", "REDIS_URL", "PUBLIC_API_URL", "SMTP_HOST", "SMTP_FROM", "CORS_ORIGINS", "ALLOWED_HOSTS"):
        if not os.getenv(name):
            raise RuntimeError(f"Required deployment setting missing: {name}")
    if not os.environ["PUBLIC_API_URL"].startswith("https://"):
        raise RuntimeError("PUBLIC_API_URL must use HTTPS")
    async with main.lifespan(app):
        yield


app.router.lifespan_context = lifespan
# Replace only deployment CORS settings; preserve every route and response model.
app.user_middleware = [m for m in app.user_middleware if m.cls is not CORSMiddleware]
app.add_middleware(CORSMiddleware,
                   allow_origins=os.getenv("CORS_ORIGINS", "").split(","),
                   allow_credentials=True, allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Content-Type", "Authorization"])
app.add_middleware(TrustedHostMiddleware,
                   allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost").split(","))


async def transaction_db(request: Request):
    if main.db_pool is None:
        raise HTTPException(503, "Database pool not initialized")
    async with main.db_pool.acquire() as conn:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api/bookings"):
            # Serialize booking mutations across processes before existing checks
            # execute, closing check-then-insert races without changing the rules.
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(73912002)")
                yield conn
        else:
            yield conn


app.dependency_overrides[main.get_db] = transaction_db
app.include_router(verification_router(main.get_db))


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/ready", tags=["System"])
async def ready():
    state = await main.health_check()
    if state["database"] != "connected" or state["redis"] != "connected":
        raise HTTPException(503, "Dependencies unavailable")
    return {"status": "ready"}
