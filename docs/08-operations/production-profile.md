# Website profiles and current testing rollout

Updated 2026-11-17 after the owner clarified scope: the new website is published
only at testing.greenleafpacific.com and uses production ERP. The main domain stays
on the existing OpenCart website. Payment activation remains disabled.

## Build and API settings

`PUBLIC_SITE_URL` is the website's HTTP(S) origin, without a path or credentials.
`SITE_INDEXING_ENABLED` is explicitly `true` or `false`. Defaults preserve
`https://testing.greenleafpacific.com` and disabled indexing.

The Docker web build passes both settings to the same validated profile. It
generates nginx's `X-Robots-Tag`, robots.txt, static metadata and the origin used
by the live sitemap route. That route obtains eligible SKU and department URLs
from ERP. The catalog, product and editorial canonical URLs, structured data
and sitemap use the selected origin. Indexing cannot
be enabled for a non-HTTPS or testing/staging origin. Rebuild the web image when
changing these settings: they are build inputs, not runtime substitutes.

Current active website profile (production ERP, testing public hostname):

```text
PUBLIC_SITE_URL=https://testing.greenleafpacific.com
SITE_INDEXING_ENABLED=false
STORE_PUBLIC_URL=https://testing.greenleafpacific.com
ERP_TIME_ZONE=Pacific/Fiji
```

The API's `STORE_PUBLIC_URL` and approved `CORS_ALLOWED_ORIGINS` must match the
public website and ERP administration origin. API secrets remain server-only.
Set `NODE_ENV=production` for secure account cookies and non-root DB credentials.
The signed account cookie is host-only, HttpOnly and SameSite=Lax. Testing and
production must have independent session secrets; changing one logs customers
out but does not delete their password hashes.

`ERP_TIME_ZONE` must match ERP's System Settings. Website-created Quotation dates
use that timezone rather than the UTC date. Customer and Quotation creation still
use the native ERP REST API. A request with no valid SKU or an already handled
idempotency marker does not create another Customer.

## Acceptance

```sh
npm run test:site-profile
SMOKE_BASE_URL=https://testing.greenleafpacific.com \
SMOKE_PUBLIC_SITE_URL=https://testing.greenleafpacific.com \
SMOKE_INDEXING_ENABLED=false npm run smoke
```

For a private target carrying the production web image, set `SMOKE_BASE_URL` to
the private origin while keeping `SMOKE_PUBLIC_SITE_URL` at the image's configured
canonical origin. This tests the artifact before the public route is switched.
The default smoke profile remains testing/noindex. Keep production payments
disabled until the separate payment acceptance is completed.

Before switching the public route, retain the existing `/catalogues/` and
`/image/catalogues/` PDF URLs referenced by Website Catalog records. A 200 HTML
SPA fallback is not a successful PDF response: check its type and `%PDF-` signature.

The ERP Website Control Center has its own per-site website URL setting; it must
point at the matching website environment. Account access supports staff provisioning and verified-email self-registration.
Registration/reset require migration003 and configured SendGrid delivery; isolated
rehearsal uses the protected outbox. Account submissions require a verified session.

## Rollback

Keep the prior website image/routes and the old test environment until acceptance.
A web rollback does not roll back ERP business writes. Preserve new quotations and
customer records, stop the new writer if needed, and reconcile them separately.
