# ERPNext Customization Package

This folder describes the ERPNext side of the Green Leaf storefront integration.

The storefront should stay as a separate Dockerized application. ERPNext should receive only the smallest reproducible customization layer needed for integration: fields, permissions, integration user setup, and operating rules.

## Contents

- `fixtures/custom_fields.json`: proposed ERPNext `Custom Field` fixtures for stable website markers and audit data.
- `patches/`: operational patch notes and future migration scripts.
- `../scripts/erpnext-validate.mjs`: local validator for ERPNext readiness.
- `../docs/erpnext-setup.md`: setup and deployment checklist.

## Current Approach

The site already works without these custom fields by storing the idempotency marker in `Quotation.enq_det`. The custom fields are the cleaner production target:

- `Quotation.website_quote_id`
- `Quotation.website_source`
- `Quotation.website_customer_email`
- `Quotation.website_payload`
- `Customer.website_origin`
- `Customer.website_last_quote_request`
- `Item.website_featured` / label `Recommended on Website` controls the product recommendation strip on the storefront.

Until these fields are applied to ERPNext, the API remains backward-compatible with `enq_det`.
