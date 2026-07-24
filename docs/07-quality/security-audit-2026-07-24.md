# Security audit: 2026-07-24

Scope: public testing website, website API and containers, ERP integration
boundary, testing ERP public surface, TLS, host-exposed services, dependency
state and recovery controls.

## Fixed in this iteration

- Public cAdvisor port was removed from the external interface. Metrics remain
  available on host localhost only and its Docker/socket mounts are read-only.
- Quote requests no longer trust a browser-supplied rate. SKU eligibility and
  the current ERP selling price are resolved server-side from published items.
- Public catalog requests cannot enable hidden/weak groups or select an
  arbitrary ERP price list.
- Website account administration no longer writes Frappe core User, Role,
  Contact or Dynamic Link tables.
- Production API rejects root or missing ERP database credentials.
- Website containers run non-root with read-only filesystems, dropped
  capabilities, PID limits and `no-new-privileges`.
- Monitor no longer receives the complete website secret environment.
- Public internal error messages were replaced with stable error codes.
- Catalog and file proxy endpoints have rate limits. The file proxy has an
  upstream timeout, streaming response and 25 MiB limit.

## Verified controls

- TLS 1.0 and 1.1 are rejected; TLS 1.2 and 1.3 are accepted.
- HSTS, CSP, frame denial, content-type protection and noindex are active on
  the testing website.
- ERP guest requests to User and accounting resources are denied.
- ERP database, Redis and backend ports are not publicly exposed.
- Payment remains disabled and the website does not collect card data.
- Production npm dependency audit reports no known vulnerabilities.
- Fail2ban and unattended security upgrades are active on the host.

## Remaining high-priority work

- Frappe and ERPNext v14 reached end of support on 2026-01-31. Build a cloned
  environment, upgrade to a supported major version, run ERP migration/UAT and
  cut over only after rollback evidence.
- SSH still permits root and password authentication. Before disabling them,
  inventory all operators and automation, verify at least two working key-based
  admin paths, validate `sshd` configuration and keep a recovery console.
- The shared host exposes mail and legacy WordPress/PHP workloads. Confirm
  ownership, patch levels and network policy for those independent services or
  isolate this stack on a dedicated host.
- Guest quote submission remains an intentional public write path. Add
  challenge/email verification if abuse is observed or before public launch.
- Complete alert recipient configuration, centralized retention and a tested
  restore drill.

## Release gates

- No production launch while ERPNext/Frappe is outside supported security
  maintenance.
- No payment enablement before Windcave UAT credentials, callback validation,
  narrowly scoped Payment Entry permissions and reconciliation tests.
- No indexing change as part of security or payment deployment.
