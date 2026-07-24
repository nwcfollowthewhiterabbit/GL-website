# Integration Map

## Source Systems

### Old OpenCart

Local path: `/Users/bc/woocommerce/greenleafpacific-local`

Observed counts:

| Entity | Count |
| --- | ---: |
| Products | 15,457 |
| Active products | 11,118 |
| Categories | 528 |
| Manufacturers | 35 |
| Product images | 15,199 |
| Customers | 172 |

Main tables:

- `oc_product`
- `oc_product_description`
- `oc_product_to_category`
- `oc_product_image`
- `oc_category`
- `oc_category_description`
- `oc_category_path`
- `oc_manufacturer`
- `oc_customer`

### ERPNext

Local path: `/Users/bc/woocommerce/erp-greenleafpacific-local`

Observed counts:

| Entity | Count |
| --- | ---: |
| Item | 23,732 |
| Item Group | 125 |
| Item Price | 88,615 |
| Customer | 8,378 |
| Quotation | 18,044 |
| Sales Order | 9,841 |

Installed relevant apps:

- `erpnext`
- `woocommerceconnector`
- `greenleaf`
- `payments`

Custom `Item` fields observed:

- `woocommerce_product_id`
- `woocommerce_variant_id`
- `stock_keeping_unit`
- `sync_with_woocommerce`
- `sync_qty_with_woocommerce`
- `product_category`
- `woocommerce_description`

## Direction Of Truth

Recommended production ownership:

| Data | Master | Storefront Role |
| --- | --- | --- |
| Item code, SKU, UOM, item group | ERPNext | Read and cache |
| Prices and price lists | ERPNext | Read and cache per customer |
| Stock and warehouse availability | ERPNext | Read and cache |
| Product images and merchandising copy | ERPNext or storefront CMS | Render and optimize |
| Cart and quote request | Storefront | Create draft, send to ERPNext |
| Sales quotation | ERPNext | Create/update from quote request |
| Sales order and invoice | ERPNext | Show status to customer |
| Warranty/service issue | ERPNext | Create Issue or custom DocType |

## API Surface

Current local API endpoints:

- `GET /health`
- `GET /api/catalog/summary`
- `GET /api/catalog/search?q=&category=`
- `GET /api/catalog/products?page=1&pageSize=24&q=&category=`
- `GET /api/catalog/products/:sku`
- `GET /api/catalog/item-groups`
- `GET /api/catalog/facets`
- `GET /api/files/:filename`
- `POST /api/quote-requests`
- `GET /api/sync/status`
- `GET /api/sync/legacy-rules`
- `GET /api/admin/catalog-diagnostics`
- `GET /api/admin/recent-quotes`

Planned ERPNext endpoints:

- `GET /api/resource/Item`
- `GET /api/resource/Item Group`
- `GET /api/resource/Item Price`
- `GET /api/resource/Bin`
- `POST /api/resource/Lead`
- `POST /api/resource/Customer`
- `POST /api/resource/Quotation`
- `POST /api/resource/Issue`

## Migration Notes

- OpenCart top-level visible categories are broad and should be remapped to ERPNext item groups, not copied blindly.
- ERPNext has richer operational data than the old site. The new storefront should prefer ERPNext item and price data where duplicates exist.
- The old WooCommerce connector is useful as a field reference but should not dictate the new API design.
- Product image paths in OpenCart include local files and remote supplier URLs; the new site needs an image ingestion/normalization pass.
- Legacy brand/logo assets and reusable About Us content were copied into the new storefront; large PDF catalogues were discovered but intentionally not committed because they are about 152 MB and should move to object storage/CDN.
- See [legacy-sync-analysis.md](legacy-sync-analysis.md) for the already-built OpenCart/ERPNext sync behavior found in the old containers.

## Current Quote Flow

`POST /api/quote-requests` now:

- validates line SKUs against ERPNext `Item`
- prices lines from ERPNext `Item Price`
- matches or prepares a `Customer` by email
- creates a draft ERPNext `Quotation` through REST when credentials are configured
- prevents duplicates with `Green Leaf Website Quote #<id>` in `Quotation.enq_det`
- uses `Quotation.website_quote_id` for duplicate protection when the ERPNext custom field patch is applied
- returns missing SKUs explicitly

## Payment Gateway: Westpac + Windcave HPP

Status: Westpac confirmed Windcave Hosted Payment Page. The implementation uses
submitted Sales Invoice outstanding balance and remains off until Windcave UAT
credentials and ERP Payment Entry account mappings are confirmed.

Recommended integration path:

- Use Windcave Hosted Payment Page with a full-page redirect, not direct card capture or an embedded merchant card form.
- Storefront API creates a provider payment session for an eligible order.
- Customer is redirected to the provider for card entry.
- The provider returns the customer to the storefront and sends a server callback/webhook.
- Storefront API verifies the transaction with the provider before updating ERPNext.
- ERPNext creates an idempotent Payment Entry allocated to the verified Sales
  Invoice and stores the provider transaction reference.

Prepared implementation pieces:

- Environment variables for Windcave UAT/live credentials.
- Server-side Windcave HPP session creation and session-result verification adapter.
- Public `GET /api/payments/config` readiness endpoint with no secrets.
- Callback paths reserved at `/payment/approved`, `/payment/declined` and `/payment/cancelled`.
- `POST /api/payments/notification` validates the session id and obtains the
  authoritative result from Windcave server-to-server. ERP write remains
  disabled until the payable document mapping is confirmed.
- Реализованный ERPNext payment effect: idempotent `Payment Entry`, allocated к
  submitted Sales Invoice; activation ожидает подтверждения account mapping.
- Website Command Center settings for enabling online payments and selecting the payment flow.

Confirmed commerce rules:

- In-stock quantities proceed to full payment after customer phone, email and delivery location are collected.
- Low-stock quantities require sales confirmation before a payment link is issued.
- Special-order and non-stock items require ETA acceptance and a 70% deposit.
- Payment links remain valid for 30 days.
- Catalog prices are in FJD and exclude VAT; VAT and any delivery charge are added before payment.
- Orders over FJD 200 receive free delivery within Viti Levu or to the applicable outer-island shipper's yard.

Westpac-confirmed gateway rules:

- Provider: Windcave.
- Integration: Hosted Payment Page; all cardholder data stays in Windcave.
- Accepted cards: Visa, Mastercard and American Express.
- Transaction and settlement currency: FJD.
- PCI model: SAQ A for HPP; Windcave covers the hosted card-entry environment.
- The non-indexed testing URL can be used for Westpac review.

Remaining technical-stage inputs:

- Windcave REST UAT username and API key.
- Confirmation that submitted Sales Invoice `outstanding_amount` is the final
  payable total after VAT/delivery/deposit handling.
- Activation of 3-D Secure on the Windcave REST username and UAT test execution.
- Whether provider refunds are portal-only at launch or exposed through API.
- Exact mode-of-payment, receivable and Windcave clearing account names.
