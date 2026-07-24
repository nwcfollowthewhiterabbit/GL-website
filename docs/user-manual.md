# Green Leaf Pacific Website User Guide

Verified environment: `https://testing.greenleafpacific.com`

The testing website is not indexed and must not be treated as the production
store.

## Browse Products

1. Open `/catalog`.
2. Select a department or use search and filters.
3. Open a product to view its SKU, availability and price mode.
4. Select **Add to order** to place the item in the **Order basket**.

Prices are shown in FJD and exclude VAT unless the interface explicitly states
otherwise.

## Submit an Order Basket

1. Open **Order basket**.
2. Review item quantities.
3. Enter company/contact, email, phone and delivery location.
4. Submit the request.
5. Keep the displayed reference for communication with Green Leaf.

The website creates or links the request to an ERPNext quotation. Missing or
invalid SKU lines are reported instead of being silently replaced.

## Customer Account

1. Open `/account`.
2. Enter the customer email and password supplied by Green Leaf.
3. Select **Sign in**.
4. Use **Orders**, **Quotations**, and **Invoices** to switch document types.
5. Select **View** to open document lines and the current customer-facing
   status.
6. Select **Sign out** when finished on a shared device.

Existing customers do not enter an email code. Self-registration and
self-service password recovery are not available in the current testing
version; Green Leaf support can reset, disable or restore an existing account.
Contact `buy@greenleafpacific.com` for access support.

## Online Payment

Online payment is not active in the current testing release. When enabled after
UAT, card details will be entered only on Windcave's hosted payment page. Green
Leaf Pacific's website must not ask for a card number or CVV directly.

## Report an Issue

Send the page, document reference, time, expected result, actual result and a
screenshot without passwords, cookies or card details to Green Leaf support.
