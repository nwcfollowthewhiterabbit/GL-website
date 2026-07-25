# ERPNext v16 Website Compatibility

Date: 2026-07-25

## Scope

This rehearsal covers only the Green Leaf website and its ERPNext integration
layer. Production was not accessed or modified.

Excluded from migration:

- customer and user data from the existing testing ERP;
- quotations, orders, invoices, payments and uploaded files;
- POS Awesome, HRMS, Knowledge Base, WooCommerce Connector and unrelated
  `greenleaf` customizations.

The exact portable scope is declared in `erpnext/website-layer.json`.

## Target

- Frappe `16.16.0`
- ERPNext `16.14.0`
- `greenleaf_website` `0.1.0`
- MariaDB `10.6`
- synthetic FJD company and `GL-WEB-E2E-*` records only

The stack is isolated in Docker project `gl-erp-v16`. ERP is bound to server
localhost port `8193`; the separate website runtime is bound to localhost port
`8194`. The active testing website remains connected to ERPNext v14.

## Verified

- clean site creation and ERPNext installation;
- standard app installation and `bench migrate`;
- 7 website DocTypes, 19 Custom Fields and Website Control Center Page;
- versioned website credential and payment-event migrations;
- least-privilege DB access: global read plus writes to website-owned tables;
- catalog, departments, banners, catalogs, manufacturers and featured product;
- FJD price and special-order behavior;
- REST creation of a draft Quotation;
- repeated quote request returns the same Quotation;
- backend-created Customer can receive a website password without 2FA or a
  separate Frappe Website User;
- customer session returns only linked quotations and sales orders;
- complete runtime smoke including security headers and noindex.

## Compatibility Fixes

1. ERPNext v16 removed `Item.web_long_description`. Publication SQL now checks
   the live schema and falls back to `Item.description`.
2. ERPNext v16 does not expose `Quotation.customer`. Customer account queries
   now use the cross-version `Quotation.party_name`.
3. Build-time Vite SSR no longer starts a file watcher.
4. ERP readiness no longer requires `System Manager` or the presence of
   optional excluded warehouses.

## Commands

```bash
npm run verify
SMOKE_BASE_URL=https://testing.greenleafpacific.com npm run smoke
```

Inside the isolated v16 website runtime:

```bash
npm run erpnext:check-website-migrations
npm run erpnext:validate -- --strict
SMOKE_BASE_URL=http://web:8080 SMOKE_CATALOG_QUERY=Website npm run smoke
ERP_RUNTIME_BASE_URL=http://web:8080 npm run test:erpnext-runtime
ERP_RUNTIME_BASE_URL=http://web:8080 ACCOUNT_TEST_PASSWORD=... npm run test:account-runtime
```

## Remaining Gates

- Production-data upgrade rehearsal is complete. See
  [Production ERP v16 upgrade rehearsal](production-erp-v16-upgrade-rehearsal-2026-07-25.md).
- Reconcile production custom fields and naming defaults against the manifest.
- Test Sales Invoice and Payment Entry after Windcave UAT credentials and
  accounting mappings are confirmed.
- Run user acceptance testing before switching the testing website from v14 to
  v16.

Official references:

- https://frappe.io/support-versions
- https://github.com/frappe/frappe/wiki/Migrating-to-version-16
- https://github.com/frappe/erpnext/wiki/Migration-Guide-To-ERPNext-Version-16
