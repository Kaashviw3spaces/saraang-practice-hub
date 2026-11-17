Validation against PostgreSQL 16 and Redis 7
==========================================

The isolated `saraang-backend-validation` Compose project initialized a new real
PostgreSQL database, applied the original schema/catalogues plus the additive
verification migration, and started the production API and notification worker.
Rerunning the migration runner succeeded without resetting the data.

Full suite: **49 passed, 2 failed** (51 tests total).
All 9 new tests passed: exact domain validation, normalization, concurrent resend
cooldown, token hashing, concurrent single-use consumption, expiry, resend
invalidation, delivery failure rollback, and concurrent booking exclusion.

The two existing failures were reproduced separately with the unchanged
`main:app` entrypoint:

- `test_frequency_collision_and_lockdown`: expects low-frequency recording
  collisions to be rejected; the existing acoustic engine permits this case.
- `test_meeting_session_policy`: hardcodes session type ID 9, while the original
  seed assigns Meeting Session ID 5 on a fresh database.

These existing behaviors/tests were left untouched as requested. Actual SMTP
delivery was replaced with an in-process capture for verification tests; no real
university email was sent. SMTP credentials, real mailbox delivery, public DNS,
HTTPS termination, and hosting still require deployment environment configuration.
