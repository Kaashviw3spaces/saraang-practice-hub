# Saraang deployment milestones

Checkpoint: 13 November 2026

Current state: the frontend has been launched locally at http://localhost:8081.
Its existing API configuration targets port 8001; that backend reported healthy
PostgreSQL and Redis connections at launch. The separate production validation
stack uses http://localhost:8002. Public deployment is still pending.

All work so far is additive. Original tracked files, frontend code, and business
rules remain unchanged. New files are currently untracked in Git; no checkpoint
commit or release has been created.

## Milestone 1 — Backend foundation

- [x] Add a separate production backend entrypoint.
- [x] Run against real PostgreSQL 16 and Redis 7 in an isolated Docker stack.
- [x] Persist PostgreSQL and Redis data in Docker volumes.
- [x] Add transactional, versioned migrations with checksum validation.
- [x] Confirm migrations can rerun without resetting the database.
- [x] Serialize production booking mutations to prevent validation/insert races.
- [x] Add readiness checks, configurable CORS/allowed hosts, and security headers.
- [x] Add a non-root production image with pinned Python dependencies.
- [x] Restrict the API container filesystem and keep database/cache ports private.

Acceptance: production image builds, migrations complete, and `/ready` succeeds.
This was verified locally; it must also pass on the deployment server.

## Milestone 2 — University email verification

- [x] Add verification request and token verification endpoints.
- [x] Accept only the exact `@rishihood.edu.in` domain, case-insensitively.
- [x] Store token hashes and persist mailbox verification in PostgreSQL.
- [x] Add 15-minute expiry, single-use consumption, and resend cooldown.
- [x] Roll back token creation when SMTP delivery fails.
- [x] Test expiry, resend, concurrent use, delivery failures, and domain validation.
- [ ] Choose an SMTP provider and configure real credentials/sender details.
- [ ] Configure sender-domain authentication required by the provider.
- [ ] Confirm delivery and verification using a real university mailbox.
- [ ] Confirm resend and expiry behavior with real delivered links.

Acceptance: a real university account receives a link and verifies successfully;
expired, reused, and replaced links fail. Automated tests currently capture email
instead of contacting an SMTP provider.

## Milestone 3 — Decide and implement access control

This milestone needs a scope decision before implementation. Existing registration
and booking behavior has deliberately been preserved. Verification currently
proves mailbox ownership; it does not create a login session or restrict bookings.

- [ ] Decide whether verified university email is mandatory for registration,
      booking, or both, and define how existing accounts are handled.
- [ ] Approve the required authentication/client-flow changes if enforcement is wanted.
- [ ] Implement authenticated sessions and derive the acting user from the session.
- [ ] Authorize booking cancellation, user data access, and push-token updates.
- [ ] Restrict the existing member listing and protect personal information.
- [ ] Integrate login/verification into the frontend only after approval to change it.
- [ ] Test unverified accounts, unauthenticated access, and attempts to act as another user.

Acceptance: users can perform only actions allowed for their authenticated account.
Until this is complete, use a trusted campus gateway/VPN rather than unrestricted
public exposure. Preserve the no-frontend-change constraint unless explicitly lifted.

## Milestone 4 — Resolve existing test discrepancies

- [ ] Agree on the intended recording-session low-frequency collision policy.
- [ ] Align the acoustic test or implementation with that decision.
- [ ] Replace the meeting-session test's hardcoded ID 9 with catalogue discovery.
- [ ] Run the complete regression suite against a fresh isolated database.

Current evidence: **49 tests passed, 2 failed**. All **9 new tests passed**.
Both failures also occurred with the original backend entrypoint. They were left
untouched because changing existing logic/tests was outside the authorized scope.

Acceptance: all agreed regression tests pass without changing unrelated behavior.
See [validation details](deploy/VALIDATION.md).

## Milestone 5 — Deploy to the chosen host

- [ ] Choose hosting, API domain, and intended frontend deployment target.
- [ ] Decide whether to use the containerized PostgreSQL instance or a managed database.
- [ ] Create a private production environment file outside Git; replace every placeholder.
- [ ] Set a strong database password, public API URL, allowed hosts, and CORS origins.
- [ ] Configure SMTP settings and protect deployment secrets.
- [ ] Configure DNS and HTTPS termination/reverse proxy.
- [ ] Configure proxy request limits, timeouts, and verification-endpoint rate limits.
- [ ] Redact verification query strings from proxy/access logs.
- [ ] Build/start the production stack and verify migration completion/readiness.
- [ ] Configure the frontend's existing `EXPO_PUBLIC_API_URL` for the chosen API;
      this is an environment setting, not a frontend source-code change.
- [ ] Verify browser CORS behavior against the actual frontend origin.
- [ ] Smoke-test catalogue loading, booking, cancellation, and live dashboard data.
- [ ] Verify email links use the real HTTPS API domain.

Acceptance: the intended client works against the hosted API over HTTPS, with
the access restrictions agreed in Milestone 3. Database and Redis remain private.
See [deployment instructions](deploy/README.md) and
[environment template](deploy/production.env.example).

## Milestone 6 — Operations and release checkpoint

- [ ] Schedule encrypted, off-host PostgreSQL backups with a retention policy.
- [ ] Restore a backup into a separate database and verify its data.
- [ ] Configure uptime/readiness, disk usage, database, and error monitoring.
- [ ] Confirm secrets and verification links do not appear in operational logs.
- [ ] Test concurrent bookings and expected peak load on the chosen host.
- [ ] Measure booking lock contention; all booking writers must use the production entrypoint.
- [ ] Document acceptable notification behavior: existing push/SMS tasks include mocks
      and delivery remains best effort; add real integrations/reliable dispatch if required.
- [ ] Rehearse a deployment rollback and recovery after a failed migration/startup.
- [ ] Review the additive files and create a Git checkpoint commit.
- [ ] Create a release tag after deployment acceptance checks pass.

Acceptance: backup restoration, monitoring, deployment recovery, and the agreed
notification behavior are demonstrated before release sign-off.

## Suggested next checkpoint

Choose the access-control policy and deployment host, configure SMTP, and verify
one real university mailbox. These decisions unblock the remaining release work.
