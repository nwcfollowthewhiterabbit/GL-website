# Green Leaf Pacific Ecommerce

Modern B2B storefront and integration foundation for Green Leaf Pacific.

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
- `POST /api/account/login/start`
- `POST /api/account/login/verify`
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
- The customer account reads linked ERPNext quotations, sales orders, and sales invoices after email OTP authentication.
- Account sessions use a signed `HttpOnly` cookie; customer document access is resolved from ERPNext Contact/Customer links.

## Customer Account Login

Production email login remains off unless all account and SMTP settings are present:

```text
ACCOUNT_LOGIN_ENABLED=true
ACCOUNT_SESSION_SECRET=<unique random value of at least 32 characters>
ACCOUNT_EMAIL_FROM=Green Leaf Pacific <buy@greenleafpacific.com>
SMTP_HOST=<mail server>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<mail user>
SMTP_PASSWORD=<mail password>
```

Use `ACCOUNT_DEV_LOGIN=true` only outside production. It returns the OTP in the API response for local account-flow testing.

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
