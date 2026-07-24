# ADR-0002: Testing runtime automation

## Status

Accepted.

## Context

Testing website updates require a website-only backup and must not mutate or
copy ERP runtime/data. The host uses SSH alias `cloud`, a fixed repository path
and standalone `docker-compose`.

## Decision

- Runtime identity is fixed in `infra/runtime.testing.json`.
- Adapter commands never accept SSH host, repository path or compose services
  from user input.
- Existing-instance deploy requires a full expected SHA, clean remote checkout,
  exact `origin/main` match, verified website backup and fast-forward update.
- Backup contains server `.env` and website-owned uploads only; ERP data/files
  are excluded.
- Restore uses a checksum-verified plan, one-time expiring confirmation token
  and diagnostic backup before mutation.
- First-instance adapter rejects the existing testing target.
- Every operation emits evidence matching `contracts/evidence.schema.json`.

## Consequences

Testing updates become reproducible and fail closed. Production remains a
separate target and requires its own runtime configuration and acceptance.
