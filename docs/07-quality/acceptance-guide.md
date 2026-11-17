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

1. Email-first registration creates no Customer/credential before mailbox proof.
2. Wrong password returns a generic failure.
3. Correct Customer sees only linked orders, quotations and invoices.
4. Direct request for another Customer document is denied.
5. Logout removes account access.
6. Verification/reset links expire, work once and never leak through logs/referrers.
7. Existing credentials cannot be overwritten by registration; disabled accounts
   cannot be restored by password reset. Reset invalidates old sessions.
8. Page through older orders, quotes and invoices; direct foreign-document requests fail.
9. Anonymous cart survives sign-in/verification. Sending a quote requires session;
   spoofed email, malformed lines and unknown SKUs create no partial quotation.
10. Two equivalent submissions return one request; customer sees it Under review.
11. Native stage order/status fixtures appear only for their owner and are cleaned.

Registration delivery is tested with an isolated protected outbox. Production
SendGrid configuration is checked with sandbox mode (no message delivered);
receipt evidence must distinguish API acceptance from a real mailbox delivery.

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
