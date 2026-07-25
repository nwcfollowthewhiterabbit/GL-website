# Production ERP v16 Upgrade Rehearsal

Date: 2026-07-25

## Result

The current production ERP database was restored into an isolated environment
and migrated successfully:

1. Frappe `14.96.7`, ERPNext `14.86.0`, HRMS `14.37.3`;
2. Frappe `15.116.0`, ERPNext `15.118.1`, HRMS `15.63.1`;
3. Frappe `16.28.0`, ERPNext `16.29.0`, HRMS `16.14.0`.

The final v16 site starts, `bench migrate` completes, and all production apps
remain installed:

- `frappe`, `erpnext`, `hrms`;
- `greenleaf`, `posawesome`;
- `knowledge_base`, `woocommerceconnector`;
- `greenleaf_website`.

Production was not migrated, restarted, reconfigured, or connected to the
rehearsal. The only production operation was a consistent read-only SQL dump.

## Backup And Isolation

- Backup:
  `/home/csrss/backups/erp-production-upgrade-rehearsal/ERP-PROD-UPGRADE-20260725T084248Z/database.sql.gz`
- SHA-256:
  `338c88ce4678f8719a07a9965e446e37907b58751b77b6afdc574b6d9cb031df`
- Backup directory mode: `0700`; backup file mode: `0600`.
- No site files, attachments, private files or container volumes were copied.
- The rehearsal ERP network is internal and has no outbound email or
  integration access.
- Scheduler and workers are absent; scheduler is disabled in site config.
- ERP and website ports are bound to server localhost only.

The SQL dump contains production business data and must be handled as
production-sensitive material.

## Data Verification

Before synthetic website tests, core document counts matched the restored
production database. After tests, the remaining differences are explained by
the test fixtures:

| Document | Production | v16 clone | Explanation |
|---|---:|---:|---|
| Item | 24,973 | 24,973 | unchanged |
| Customer | 8,578 | 8,580 | two synthetic website customers |
| Quotation | 19,385 | 19,387 | two synthetic quotations |
| Sales Order | 10,607 | 10,608 | one synthetic account order |
| Sales Invoice | 26,520 | 26,520 | unchanged |
| POS Closing Shift | 2,402 | 2,402 | unchanged |
| Custom Field | 202 | 226 | website app fields |

## Website Verification

The `greenleaf_website` app was installed on the migrated clone and its
versioned schema migrations were applied. A separate least-privilege website
runtime was connected to the clone.

Passed checks:

- strict ERP contract and all required website custom fields;
- 23,959 enabled sales items with prices;
- catalog read from the production-derived database;
- trusted FJD price from `Standard Selling`;
- idempotent Quotation creation through the website API;
- customer password login without 2FA for a backend-created customer;
- account session, quotation and Sales Order history;
- denial of access to another customer's order;
- website migration checks, route/security smoke and noindex policy;
- disabled and unconfigured Windcave state.

The production clone has no Website Department, Banner, Catalog or
Manufacturer records because these DocTypes were introduced by the website app.
The frontend uses its declared local fallback and monitoring reports the
degraded source. These records must be populated or migrated before cutover.

## Compatibility Notes

- The exact production POS Awesome `6.3.0` source migrated through v15 and v16.
  Its POS workflows still require user acceptance testing.
- The legacy Knowledge Base app lacks `__version__`; the rehearsal image adds a
  compatibility value so `bench version` works.
- WooCommerce Connector requires its production dependency
  `WooCommerce==3.0.0`; the rehearsal image installs it explicitly.
- Current production-local modifications to Knowledge Base and WooCommerce
  Connector were included in the rehearsal source snapshot.
- Frappe/ERPNext v16 removes or deprecates multiple core modules. Migration
  completed, but business owners must confirm that removed modules are not
  part of active processes.
- Site files were intentionally excluded, so attachment rendering and
  file-dependent workflows were not tested here.

## Production Release Gates

The technical migration is feasible, but production should not be upgraded
until all of these gates pass:

1. Freeze and version the exact custom-app source used by production.
2. Repeat the SQL-only backup and verify its checksum immediately before the
   maintenance window.
3. Rehearse the final source revisions through v14 -> v15 -> v16.
4. Run POS Awesome, accounting, Sales Invoice, HR and permission UAT.
5. Populate and approve website control records on the target ERP.
6. Run website strict validation, quote/account runtime contracts and smoke.
7. Keep Windcave disabled until UAT credentials and payment account mappings
   are approved and Payment Entry tests pass.
8. Define a rollback point and do not resume writes until validation is
   accepted.

Official migration references:

- https://github.com/frappe/frappe/wiki/Migrating-to-version-16
- https://github.com/frappe/erpnext/wiki/Migration-Guide-To-ERPNext-Version-16
