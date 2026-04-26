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
