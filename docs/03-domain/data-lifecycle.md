# Жизненный цикл данных

## Catalog

ERPNext record -> API filtering/normalization -> storefront response -> browser
render. Local seed используется только как явно обозначенный fallback.

## Quote request

Browser basket -> backend validation -> idempotency marker -> draft ERPNext
Quotation -> response reference. Исправление выполняется sales process в ERP.

## Account

Admin assigns password -> salted hash stored against ERP Customer -> login issues
short-lived signed session -> each list/detail resolves allowed Customer scope.
Logout clears the browser session cookie.

## Payment

Payable ERP document -> immutable HPP request -> Windcave-hosted card entry ->
server verification -> idempotent ERP result. Этот lifecycle пока выключен до
UAT inputs.

## Test data

Synthetic records имеют префикс `GL-WEB-E2E-<RUN_ID>` либо документированный
permanent fixture. Temporary records очищаются после validation.
