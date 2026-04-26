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
- Advanced catalog filters read ERPNext item groups and display storefront rules such as excluded showroom warehouses.
- Diagnostics show ERPNext catalog quality counters and recent website-created quotations.

## Current Discovered Sources

- Old OpenCart/PHP copy: `/Users/bc/woocommerce/greenleafpacific-local`
- ERPNext v14 local copy: `/Users/bc/woocommerce/erp-greenleafpacific-local`
- Ignored legacy attempt: `gl-wp-*`

## Next Milestones

1. Split the large `App.tsx` and `main.css` into focused catalog, quote, diagnostics, and layout modules.
2. Add a quote-request confirmation flow with validation messages for missing SKUs, duplicate requests, and ERPNext failures.
3. Add customer account scaffolding for saved quote history and customer-specific price lists.
4. Add admin controls for include/exclude storefront item groups, hidden no-price products, and showroom stock rules.
5. Add visual/browser regression checks once the frontend structure settles.
