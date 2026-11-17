Production deployment (additive)
===============================

All original files, frontend code, route contracts, registration behavior, and
booking/acoustic policies are preserved. Run the new `production:app` entrypoint
to enable these additions. The old development entrypoint remains available.

Requirements: Docker Engine with Compose, a server with an HTTPS reverse proxy,
a domain, and an SMTP provider capable of delivering to rishihood.edu.in.

1. Copy `deploy/production.env.example` to a private location outside the repo.
   Replace every placeholder. Use a long random hexadecimal database password.
   Set the real HTTPS API URL, permitted hosts, web origins, and SMTP credentials.
   Keep `localhost` in ALLOWED_HOSTS for health checks. Protect this file with
   `chmod 600 /absolute/path/production.env`.
2. From the repository root run:

   ```sh
   docker compose --env-file /absolute/path/production.env -f compose.production.yml up -d --build
   docker compose --env-file /absolute/path/production.env -f compose.production.yml ps
   curl --fail http://localhost:8002/ready
   ```

3. Configure your HTTPS reverse proxy on the same host to forward the API domain
   to `127.0.0.1:8002`. Set request body limits, request timeouts, and rate limits
   (especially `/api/auth/email/request`). Redact query strings from proxy logs:
   verification links contain bearer secrets. Backend access logging is disabled
   for this reason. Keep PostgreSQL and Redis private; neither publishes ports.

The database and Redis have persistent volumes, and the backend runs as a non-root
user with a read-only filesystem. A one-shot migration service must succeed before
API startup. Migrations run under a database lock, record checksums, and commit
atomically. Existing catalogue values are not overwritten on migration adoption.
Do not edit applied SQL files; add a new migration. The original schema's hardcoded
database ALTER statement is omitted by the new runner for managed DB compatibility.
For a managed database, provide its TLS-enabled DATABASE_URL and run `python
migrate.py` from the built image before starting `uvicorn production:app`.

Booking writes in the production entrypoint acquire one transaction-level advisory
lock before existing validation. This prevents simultaneous requests from passing
capacity/collision checks together. It deliberately serializes booking mutations;
monitor throughput before scaling. All writers must use this entrypoint for this
guarantee. Existing notification tasks are still best effort; they are not a
transactional outbox and existing push/SMS integrations are unchanged.

University email verification
-----------------------------

Register using the existing `POST /api/users`, then request verification:

```sh
curl https://api.example.org/api/auth/email/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@rishihood.edu.in"}'
```

Only the exact university domain is accepted, case-insensitively; lookalike and
subdomains are rejected. Eligible existing accounts receive an HTTPS link. Open
it to persist `users.email_verified_at`. Links expire after 15 minutes, are
single-use, and are stored only as SHA-256 hashes. Resends invalidate the previous
link and have a 60-second cooldown across workers. Delivery failures roll back
the token and cooldown. Unknown/already-verified accounts return the same generic
202 response. Existing duplicate emails differing only by case require manual
resolution before verification; this update does not merge user data.

API clients can alternatively POST `{"token":"..."}` to `/api/auth/email/verify`.
The token proves mailbox ownership, not a login session. To preserve the existing
frontend and behavior, verification does **not** restrict old registrations or
bookings. Existing endpoints still trust supplied user IDs and expose the original
member listing. User authentication and authorization need a separately approved
client integration before this is suitable for unrestricted public access. Until
then deploy behind a trusted campus access gateway/VPN. No frontend login or
verification UI has been added.

Backups and updates
-------------------

Back up PostgreSQL regularly to encrypted off-host storage and test restoration:

```sh
docker compose --env-file /absolute/path/production.env -f compose.production.yml exec -T postgres pg_dump -U saraang -d saraang_db -Fc > saraang.dump
```

Restore into a separate empty database using `pg_restore --no-owner`; verify it
before switching traffic. Take a backup before each deployment. Use the same
Compose project name on later deployments so volumes are reused. Do not use
`down -v` on production. Rebuild/up applies new migrations without dropping data.

Validation
----------

Against an isolated stack (tests create/delete their own records):

```sh
docker compose --env-file /absolute/path/test.env -f compose.production.yml exec -T backend pytest tests/test_ai_engine.py tests/production -v
docker compose --env-file /absolute/path/test.env -f compose.production.yml exec -T backend pytest tests/test_api.py -v
```

Verification tests use real PostgreSQL and replace SMTP delivery with a capture
function; actual provider delivery must also be tested with a real campus mailbox.
