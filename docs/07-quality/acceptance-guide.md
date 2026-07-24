# Руководство по приемке

## Baseline

- Environment: `https://testing.greenleafpacific.com`
- Viewports: 390px mobile и 1440px desktop
- Roles: anonymous и synthetic Customer
- Runtime: exact commit from `main`

## Catalog and basket

1. Catalog routes load without overflow or broken primary images.
2. Search/filter returns ERP-backed products.
3. Basket validates required customer fields and SKU lines.
4. Successful request returns one ERP Quotation reference.
5. Repeat with the same idempotency marker does not create a duplicate.

## Customer account

1. Login form contains email/password and no email-code step.
2. Wrong password returns a generic failure.
3. Correct Customer sees only linked orders, quotations and invoices.
4. Direct request for another Customer document is denied.
5. Logout removes account access.

## Payment UAT

До активации: `/api/payments/config` сообщает disabled/readiness state, card form
на сайте отсутствует.

После получения UAT inputs проверяются approved, declined, cancelled, repeated
notification, amount mismatch и invalid provider result. ERP effect создается
только после server verification.

## Release acceptance

Приемка завершена, когда `npm run verify`, public smoke, visual smoke, exact SHA,
container status и применимые role scenarios подтверждены для одного release
commit. Payment production approval является отдельным gate.
