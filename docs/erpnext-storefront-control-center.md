# ERPNext Storefront Control Center

The website should not require a sales/admin user to manage a separate website backend. Storefront behavior is controlled in ERPNext.

Desk page:

```text
http://localhost:18092/app/website-control-center
```

Workspace:

```text
http://localhost:18092/app/website-command-center
```

The Desk page source is kept in this repository under `erpnext/page/website_control_center/`. The local ERPNext app copy currently lives at:

```text
/Users/bc/woocommerce/erp-greenleafpacific-local/erp-build/apps/greenleaf/greenleaf/greenleaf/page/website_control_center/
```

After changing the page files, copy them into the ERPNext app and run:

```bash
docker exec erp-greenleafpacific-local-backend-1 bash -lc 'cd /home/frappe/frappe-bench && bench --site erp.greenleafpacific.com clear-cache'
docker exec erp-greenleafpacific-local-backend-1 bash -lc 'cd /home/frappe/frappe-bench && bench build --app greenleaf'
```

The Command Center is intentionally written for everyday operators: large sections, simple labels, direct buttons, and short warnings instead of technical setup language.

## Category Controls

ERPNext DocType: `Item Group`

Fields added by `erpnext/fixtures/custom_fields.json`:

| Field | Purpose |
| --- | --- |
| `website_show_on_storefront` | Show or hide this category on the website. |
| `website_sort_order` | Controls category/product ordering where applicable. |
| `website_price_mode` | `Price List`, `Quote Only`, or `Hide Price`. |
| `website_price_list` | Optional category-specific price list. |
| `website_stock_display` | `Availability`, `Quantity`, `Special Order`, or `Hidden`. |
| `website_show_products_without_images` | Allow products without images in this category. |
| `website_show_products_without_price` | Allow products without a selling price in this category. |
| `website_category_note` | Optional category note for storefront display. |

## Website Navigation Mapping

ERPNext `Item Group` is not the same thing as a customer-facing website category.

The old OpenCart site had hundreds of storefront categories, while ERPNext has a smaller operational `Item Group` tree with names such as `Gas Equipment AU/NZ`, `Crockery SG`, and `Karcher AU`. The storefront should therefore use a separate navigation layer:

| Website department | Mapped ERPNext item groups |
| --- | --- |
| Kitchen & Equipment | `Kitchen`, `Gas Equipment AU/NZ`, `Countertop AU/NZ`, `Refrigeration AU/NZ`, etc. |
| Front of House | `Crockery SG`, `Crockery AU/NZ`, `Glassware AU/NZ`, `Cutlery AU/NZ`, `Table Accessories`, etc. |
| Buffet & Table Service | `Buffetware`, `Buffet Display Ware`, `Buffet Serving Ware`, etc. |
| Housekeeping & Cleaning | `House Keeping Items AU/NZ`, `Karcher AU`, `Bedding`, `Chemicals AU/NZ`, etc. |
| Furniture & Fitouts | `Joinery`, `Non-Wooden Furniture`, `Mattresses`, `Trex Decking`, etc. |

Current implementation note: this mapping is stored in `src/data/websiteCategories.ts` as a safe fallback. The storefront API now checks ERPNext for `Website Department` records first. If the DocTypes from `erpnext/fixtures/website_department_doctypes.json` are installed and populated, ERPNext becomes the source of truth for website navigation.

Recommended ERPNext control fields / DocTypes:

| Control | Purpose |
| --- | --- |
| `Website Department` DocType | Customer-facing catalog department such as `Kitchen & Equipment`. |
| Department label/description/order | Controls menu text, sidebar order, and landing copy. |
| Department enabled flag | Hides an entire department without deleting mappings. |
| Department child table: `ERP Item Group` | Maps one website department to many ERP item groups. |
| Show in main menu / show in catalog sidebar | Controls where the department appears. |
| Featured flag | Controls whether the department appears in `Shop by department`. |

API behavior:

- `GET /api/storefront/departments` returns ERP-managed departments when the DocTypes exist.
- If the DocTypes are not installed yet, the endpoint reports `source: fallback_static_storefront_mapping` and the React app uses the local fallback mapping.
- This keeps the current site stable while the ERP control center is introduced.

Local seed command:

```bash
npm run erpnext:seed-departments:docker
```

This creates the runtime tables, registers the ERPNext DocType metadata, and loads the initial department mapping from the current storefront category map.

## Hero Banner Controls

ERPNext DocType: `Website Banner`

| Field | Purpose |
| --- | --- |
| `banner_id` | Stable id for the banner record. |
| `label` | Internal/admin label. |
| `title` | Main hero headline. |
| `copy` | Supporting text shown over the banner. |
| `image` | Public storefront path or ERP file URL. |
| `href` | Click destination. |
| `open_in_new_tab` | Opens the destination in a new tab when enabled. |
| `enabled` | Shows or hides this banner. |
| `sort_order` | Controls banner order. |

API behavior:

- `GET /api/storefront/banners` returns ERP-managed hero slides when `Website Banner` exists.
- If the DocType/table is not installed, React uses `src/data/heroBannersSeed.mjs` as fallback.

Local seed command:

```bash
npm run erpnext:seed-banners:docker
```

## Product Overrides

ERPNext DocType: `Item`

Fields added:

| Field | Purpose |
| --- | --- |
| `website_show_on_storefront` | Show or hide this item. |
| `website_featured` | Mark item for featured product use. |
| `website_price_mode_override` | Product-level price display override. |
| `website_stock_display_override` | Product-level stock display override. |
| `website_sort_order` | Product ordering override. |

## Featured Product Controls

ERPNext DocType: `Website Featured Product`

This controls the storefront block titled `You may also be interested in`.

| Field | Purpose |
| --- | --- |
| `item_code` | ERP Item shown in the recommendation block. |
| `display_name` | Optional staff-friendly label in ERP. Product data still comes from the Item. |
| `enabled` | Shows or hides the product from the recommendation block. |
| `sort_order` | Controls display order. Smaller number appears first. |
| `note` | Internal note for staff. |

API behavior:

- `GET /api/catalog/featured` first reads enabled rows from `Website Featured Product`.
- If the DocType/table is missing or empty, the API falls back to `Item.website_featured`.
- If no item is flagged, the API falls back to latest catalog products so the section is never empty during setup.

Local seed command:

```bash
npm run erpnext:seed-assets:docker
```

The seed creates the DocType/table and inserts an initial set of products from the live ERP catalog only when the featured list is empty.

## Current Website Behavior

- Hidden categories are removed from website facets and return no products unless the API is called with `includeHidden=1`.
- Hidden products are excluded from catalog queries.
- Category `website_price_list` overrides the default `Standard Selling` price list.
- `Quote Only` and `Hide Price` categories still show products but do not expose numeric price.
- `Quantity`, `Availability`, `Special Order`, and `Hidden` stock display modes change the product card availability label.
- Product-level price/stock overrides win over category rules.

## Staff Workflow

1. Open ERPNext.
2. Go to `Item Group` for category-wide website rules.
3. Go to `Item` for product-specific overrides.
4. Save the ERPNext document.
5. The website API reads the updated rules from ERPNext.

No separate website admin panel is required for sales/catalog staff.
