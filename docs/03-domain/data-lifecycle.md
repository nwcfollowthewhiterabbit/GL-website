# Жизненный цикл данных

## Catalog

ERPNext record -> API filtering/normalization -> storefront response -> browser
render. Local seed используется только как явно обозначенный fallback.

## Quote request

Browser basket -> verified account -> backend SKU/quantity/identity validation -> idempotency marker -> draft ERPNext
Quotation -> response reference. Исправление выполняется sales process в ERP.

## Account

Email request -> hashed expiring challenge -> mailbox link -> password/company/contact
completion -> native Customer/Contact resolution or creation -> insert-only salted
scrypt credential -> signed session. Existing admin-provisioned access remains.
Reset challenge snapshots credential version; successful reset consumes the token
and increments session version. Disabled access remains disabled.
Each paged list/detail resolves allowed Customer scope.
Logout clears the browser session cookie.

## Payment

Payable ERP document -> immutable HPP request -> Windcave-hosted card entry ->
server verification -> idempotent ERP result. Этот lifecycle пока выключен до
UAT inputs.

## Test data

Synthetic records имеют префикс `GL-WEB-E2E-<RUN_ID>` либо документированный
permanent fixture. Temporary records очищаются после validation.
