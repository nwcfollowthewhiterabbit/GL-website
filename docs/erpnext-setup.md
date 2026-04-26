# ERPNext Setup For Green Leaf Storefront

## Target Shape

The website is a separate Docker stack. ERPNext remains the operational source of truth.

The website reads:

- `Item`
- `Item Group`
- `Item Price`
- `Bin`
- `Warehouse`
- `Customer`
- `Quotation`

The website writes:

- `Customer`
- draft `Quotation`

Future phases may write:

- `Sales Order`
- `Issue`

## Required ERPNext Settings

### Integration User

Recommended user:

```text
website.integration@greenleaf.local
```

Required roles:

- `System Manager`
- `Sales User`
- `Stock User`

The local development ERPNext copy already has this user and an API token. Production should create a dedicated user with the minimum final role set after permission review.

### Price And Currency

Current storefront defaults:

```text
DEFAULT_PRICE_LIST=Standard Selling
DEFAULT_CURRENCY=FJD
ERP_COMPANY=Green Leaf Ltd
ERP_CUSTOMER_GROUP=Individual
ERP_TERRITORY=Nadi, Lautoka
```

### Stock Rules

The storefront excludes showroom warehouses from sellable stock:

- `Showroom - GL`
- `Furniture Showroom (Upstairs) - GL`
- any warehouse name containing `showroom`

### Custom Fields

Apply `erpnext/fixtures/custom_fields.json` to ERPNext before production launch.

The current API remains compatible before this patch by storing the idempotency marker in `Quotation.enq_det`.

Production target fields:

- `Quotation.website_quote_id`
- `Quotation.website_source`
- `Quotation.website_customer_email`
- `Quotation.website_payload`
- `Customer.website_origin`
- `Customer.website_last_quote_request`

Storefront control fields:

- `Item Group.website_show_on_storefront`
- `Item Group.website_sort_order`
- `Item Group.website_price_mode`
- `Item Group.website_price_list`
- `Item Group.website_stock_display`
- `Item Group.website_show_products_without_images`
- `Item Group.website_show_products_without_price`
- `Item Group.website_category_note`
- `Item.website_show_on_storefront`
- `Item.website_featured`
- `Item.website_price_mode_override`
- `Item.website_stock_display_override`
- `Item.website_sort_order`

See [erpnext-storefront-control-center.md](erpnext-storefront-control-center.md).

To apply the fixture set to the connected local/staging ERPNext instance:

```bash
npm run erpnext:apply-fixtures:docker
```

## Validation

From inside the website API container, with ERPNext containers running and `.env` configured:

```bash
npm run erpnext:validate:docker
```

For CI-like strict mode:

```bash
docker compose exec api npm run erpnext:validate -- --strict
```

Strict mode fails if proposed production custom fields are missing.

## Website Smoke Test

With website and ERPNext containers running:

```bash
npm run smoke
```
