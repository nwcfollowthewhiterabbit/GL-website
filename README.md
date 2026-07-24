# Green Leaf Pacific Ecommerce

Modern B2B storefront and integration foundation for Green Leaf Pacific.

## Development Workflow

Install dependencies and run the complete repository verification:

```bash
npm ci
npm run verify
```

`verify` checks the repository contract and secret policy, runs the foundation
tests, typechecks the frontend, tests account authentication and the Windcave
adapter, and creates a production build.

Runtime checks are separate because they require a running stack:

```bash
SMOKE_BASE_URL=http://localhost:8080 npm run smoke
VISUAL_BASE_URL=http://localhost:8080 npm run visual:smoke
```

Before changing behavior, read [AGENTS.md](AGENTS.md), the
[current scope](docs/00-project/current-scope.md), and the relevant process,
architecture, quality, and operations documents from the
[documentation index](docs/README.md).

The generated automation foundation is currently in `scaffold` state. The
manual `npm run check:release` gate must remain fail-closed until backup,
deployment, restore, and runtime-validation adapters are fully implemented and
contract-tested.

## Local Docker

```bash
docker compose up --build -d
```

Storefront:

```text
http://localhost:8080
```

Storefront routes:

- `/catalog`
- `/catalog/:item-group-slug`
- `/products/:encoded-sku`
- `/account`

Integration API health:

```text
http://localhost:8080/health
```

Smoke test after the Docker stack is running:

```bash
npm run smoke
```

ERPNext readiness checks and fixture application:

```bash
npm run erpnext:validate:docker
npm run erpnext:apply-fixtures:docker
```

Useful API endpoints:

- `GET /api/catalog/summary`
- `GET /api/catalog/search?q=&category=`
- `GET /api/catalog/products?page=1&pageSize=24&q=&category=`
- `GET /api/catalog/product?sku=`
- `GET /api/catalog/related?sku=&limit=4`
- `GET /api/catalog/products/:sku`
- `GET /api/account/quotes?limit=20`
- `POST /api/account/login`
- `GET /api/account/session`
- `GET /api/account/orders/:name`
- `GET /api/account/invoices/:name`
- `GET /api/catalog/item-groups`
- `GET /api/catalog/facets`
- `GET /api/files/:filename`
- `POST /api/quote-requests`
- `GET /api/sync/status`
- `GET /api/sync/legacy-rules`
- `GET /api/admin/catalog-diagnostics`
- `GET /api/admin/recent-quotes`

`POST /api/quote-requests` validates SKU lines against ERPNext and creates a draft ERPNext `Quotation` when REST credentials are configured.

## Services

- `web`: production Vite build served by Nginx.
- `api`: Node integration API connected to local ERPNext for catalog, quote requests, diagnostics, and sync metadata.

## Current Storefront State

- Catalog grid reads live ERPNext items, `Standard Selling` prices, stock-derived availability, and proxied ERP images.
- Quote basket persists in `localStorage` and creates draft ERPNext `Quotation` documents through the integration user.
- ERPNext custom fields are defined under `erpnext/fixtures` and can store website quote id, source, customer email, and payload.
- ERPNext Item Group and Item fields now control storefront category visibility, price mode, price list, stock display, image requirements, and product overrides.
- Advanced catalog filters read ERPNext item groups and display storefront rules such as excluded showroom warehouses.
- Diagnostics show ERPNext catalog quality counters and recent website-created quotations.
- The customer account reads linked ERPNext quotations, sales orders, and sales invoices after email/password authentication.
- Account sessions use a signed `HttpOnly` cookie; customer document access is resolved from ERPNext Contact/Customer links.

## Customer Account Login

Customer login uses a password assigned to an existing ERP Customer through the protected admin API. Only a `scrypt` password hash is stored.

```text
ACCOUNT_LOGIN_ENABLED=true
ACCOUNT_SESSION_SECRET=<unique random value of at least 32 characters>
```

Assign or replace a password with `POST /api/admin/customer-access/password` using the admin API token. The request body accepts `customer`, `email`, `password`, `firstName`, and `lastName`.

Self-registration is a separate future flow and must verify the email address before creating credentials. Backend-created and existing ERP customers do not require email verification.

Seed the synthetic testing account and draft documents by passing a temporary password for one command:

```bash
ACCOUNT_TEST_PASSWORD='<temporary-password>' npm run erpnext:seed-test-account
```

## Current Discovered Sources

- Old OpenCart/PHP copy: `/Users/bc/woocommerce/greenleafpacific-local`
- ERPNext v14 local copy: `/Users/bc/woocommerce/erp-greenleafpacific-local`
- Ignored legacy attempt: `gl-wp-*`

## Next Milestones

1. Split the large `App.tsx` and `main.css` into focused catalog, quote, diagnostics, and layout modules.
2. Add a quote-request confirmation flow with validation messages for missing SKUs, duplicate requests, and ERPNext failures.
3. Harden customer account scaffolding for saved quote history, orders, and customer-specific price lists.
4. Expand Website Command Center controls for payment settings, featured products, catalogs, manufacturers, and storefront rules.
5. Activate and UAT-test the prepared Windcave Hosted Payment Page adapter after credentials are supplied.
6. Add broader browser regression checks for catalog departments, subcategories, account routes, and payment flow.
