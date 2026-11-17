"""Additive, single-use university mailbox verification for existing users."""
import asyncio
import hashlib
import os
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator


class VerificationRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def university_email(cls, value):
        value = str(value).lower()
        if value.rsplit("@", 1)[-1] != "rishihood.edu.in":
            raise ValueError("Use an @rishihood.edu.in email address")
        return value


class VerificationToken(BaseModel):
    token: str


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def send_verification(email, token):
    base = os.environ["PUBLIC_API_URL"].rstrip("/")
    link = base + "/api/auth/email/verify?" + urlencode({"token": token})
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email
    message["Subject"] = "Verify your Saraang university email"
    message.set_content(f"Verify your email by opening this link within 15 minutes:\n{link}\n"
                        "If you did not request this email, ignore it.")
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    implicit_tls = os.getenv("SMTP_SSL", "false").lower() == "true"
    client = smtplib.SMTP_SSL if implicit_tls else smtplib.SMTP
    kwargs = {"context": ssl.create_default_context()} if implicit_tls else {}
    with client(host, port, timeout=10, **kwargs) as smtp:
        if not implicit_tls:
            smtp.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USERNAME"):
            smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def verification_router(get_db):
    router = APIRouter(prefix="/api/auth/email", tags=["Email verification"])

    @router.post("/request", status_code=202)
    async def request_verification(body: VerificationRequest, conn=Depends(get_db)):
        # Row locks serialize concurrent requests and enforce a persistent cooldown
        # across all API workers. No tokens are stored in plaintext or returned.
        async with conn.transaction():
            users = await conn.fetch("SELECT id, email, email_verified_at FROM users WHERE lower(email)=$1 FOR UPDATE", body.email)
            if len(users) == 1 and not users[0]["email_verified_at"]:
                user = users[0]
                token = secrets.token_urlsafe(32)
                issued = await conn.fetchval("""
                    INSERT INTO email_verification_tokens(user_id,token_hash,expires_at)
                    VALUES($1,$2,now()+interval '15 minutes')
                    ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,
                      expires_at=EXCLUDED.expires_at, sent_at=now(), used_at=NULL
                    WHERE email_verification_tokens.sent_at < now()-interval '60 seconds'
                    RETURNING user_id
                """, user["id"], token_digest(token))
                if issued:
                    try:
                        await asyncio.to_thread(send_verification, user["email"], token)
                    except Exception:
                        # Rollback token/cooldown on delivery failure; avoid leaking
                        # credentials or verification URLs through exception logs.
                        raise HTTPException(503, "Email delivery unavailable. Try again later.") from None
        return {"message": "If an eligible account exists, a verification email has been sent."}

    async def consume(token, conn):
        if not 20 <= len(token) <= 128:
            raise HTTPException(400, "Invalid or expired verification link")
        async with conn.transaction():
            user_id = await conn.fetchval("""
                UPDATE email_verification_tokens SET used_at=now()
                WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()
                RETURNING user_id
            """, token_digest(token))
            if user_id is None:
                raise HTTPException(400, "Invalid or expired verification link")
            updated = await conn.fetchval("""
                UPDATE users SET email_verified_at=now() WHERE id=$1
                AND lower(split_part(email,'@',2))='rishihood.edu.in' RETURNING id
            """, user_id)
            if updated is None:
                raise HTTPException(400, "Account is not eligible for university verification")
        return {"verified": True, "message": "Your university email is verified."}

    @router.get("/verify")
    async def verify_link(token: str, conn=Depends(get_db)):
        return await consume(token, conn)

    @router.post("/verify")
    async def verify_token(body: VerificationToken, conn=Depends(get_db)):
        return await consume(body.token, conn)

    return router
