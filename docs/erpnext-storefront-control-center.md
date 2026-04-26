# ERPNext Storefront Control Center

The website should not require a sales/admin user to manage a separate website backend. Storefront behavior is controlled in ERPNext.

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
