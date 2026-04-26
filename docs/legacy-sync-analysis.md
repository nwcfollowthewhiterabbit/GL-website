# Legacy Sync Analysis

The old local stack already contains a nearly complete sync layer between OpenCart and ERPNext.

## Scripts Found

Old site path: `/Users/bc/woocommerce/greenleafpacific-local/scripts`

| Script | Direction | Purpose |
| --- | --- | --- |
| `sync_catalog_from_erp.py` | ERPNext -> OpenCart | Updates OpenCart products from ERPNext item master, price list, and stock bins. |
| `import_orders_to_erp_quotation.py` | OpenCart -> ERPNext | Imports OpenCart orders into ERPNext as Quotations. |
| `order_sync_once.sh` | OpenCart -> ERPNext | Runs one import tick and appends logs. |
| `order_sync_daemon.sh` | OpenCart -> ERPNext | Installs a macOS launchd job every 15 seconds. |
| `cleanup_sku_against_erp.py` | Data cleanup | Removes OpenCart products with missing SKU and resolves duplicated SKU records against ERPNext. |

## Existing Catalog Sync Rules

- ERPNext is the source of truth for SKU, name, description, price, quantity, and active status.
- Price source is `Item Price` from `Standard Selling` by default.
- Stock source is summed from `tabBin.actual_qty`.
- Warehouses named `Showroom - GL`, `Furniture Showroom (Upstairs) - GL`, or containing `showroom` are excluded from sellable stock.
- Products with price `<= 0` are disabled on the website.
- Quantity is floored to an integer and clamped to `>= 0`.
- Out-of-stock items receive the OpenCart stock status containing `special order`.
- OpenCart `model` is filled with SKU when blank.
- Product descriptions are written for every OpenCart language id.
- New item insertion was intentionally optional via `--insert-new`.
- OpenCart tables use `utf8mb3`, so 4-byte characters were stripped.

## Existing Order Sync Rules

- OpenCart orders are imported in batches with a lock file to prevent concurrent runs.
- Import state is tracked with `.order_sync_state.json` and `last_order_id`.
- Default imported status is OpenCart `order_status_id = 1`.
- ERPNext target document is `Quotation`, not `Sales Order`.
- Duplicate protection is based on `Quotation.enq_det` containing `OpenCart Order #<id>`.
- Customers are matched by `Customer.email_id` when possible.
- New customers use deterministic names prefixed with `WEB-`.
- Item lines are accepted only when SKU exists as an ERPNext `Item.name`.
- Missing/empty SKU lines are recorded in quotation notes instead of creating fake items.
- Default company is `Green Leaf Ltd`.
- Default customer group is `Individual`.
- Default territory is `Nadi, Lautoka`.
- Default price list is `Standard Selling`.

## Implications For The New Site

- Quote/cart submission should create ERPNext `Quotation` directly.
- Use idempotency keys like `Green Leaf Website Quote #<id>`.
- Keep ERPNext as the source of truth for catalog, price, stock, and customers.
- Keep missing SKU handling explicit and visible in API responses.
- Replace host-level `launchd` polling with containerized scheduled jobs or queue workers.
- Do not depend on OpenCart table writes for the new storefront.

## Risk Notes

- The old daemon was still installed locally and writing errors when old DB containers were stopped. It was stopped during this audit with `order_sync_daemon_stop.sh`.
- The old scripts embed local default passwords. New code must use env vars only.
- The old WooCommerce connector creates Sales Orders and can submit them automatically; for Green Leaf B2B flow, Quotation-first is safer.
