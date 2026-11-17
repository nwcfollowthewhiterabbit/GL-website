# Add the website ERP layer to the existing image

Build only from a pushed, CI-verified source revision and the exact current
production image ID. The Docker build context is the repository root:

```text
docker build -f infra/erpnext-production-overlay/Dockerfile \
  --build-arg ERP_BASE_IMAGE=<immutable-current-image-id> \
  -t greenleaf-erpnext:website-<release-sha> .
```

The recipe installs only `greenleaf_website` with no runtime dependencies and
inherits the current image's apps/assets. It does not run the synthetic
compatibility bootstrap or rebuild unrelated Frappe/ERP frontend bundles.

The sites volume overrides image files. Before native app install, preserve its
`apps.txt`, verify its expected hash and add exactly one `greenleaf_website` line
without removing/reordering existing entries. Run schema collision preflight
and native install/migrate on the isolated target first. The same image is then
used for backend, frontend, scheduler, websocket and both workers at deployment;
only use workers after environment-specific integration isolation/acceptance.

Set `website_api_url` to the internal API service, e.g. `http://api:3000` (the
actual service/port determines the value), and `website_public_url` to that
environment's HTTPS origin. Store `website_admin_api_token` only in protected
site configuration. No private value is an image build argument.

See [the preservation/import runbook](../../docs/08-operations/website-overlay-preservation.md).

The verified 2026-11-17 production base uses `frappe` UID 1000 and primary GID 0,
with no group named `frappe`. COPY therefore uses numeric ownership `1000:0`.
Recheck `id` and the bench owner when changing the base image; do not assume
that the user and group have matching names or numbers.
