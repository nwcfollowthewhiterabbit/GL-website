# Интеграции

## ERPNext

ERPNext предоставляет Item, Item Group, Item Price, Bin, Customer, Quotation,
Sales Order и Sales Invoice. Website-specific content и visibility controls
хранятся в versioned fixtures и применяются отдельно.

Направления:

- catalog/content: ERPNext -> website;
- quote request: website -> draft ERPNext Quotation;
- account history: ERPNext -> authenticated customer;
- payment result: Windcave -> website verification -> ERPNext, еще не активирован.

Текущая карта и discovered data:
[../integration-map.md](../integration-map.md).

## Windcave

Backend создает HPP session и передает browser только redirect URL. Callback и
notification не считаются доказательством оплаты до server-side provider
verification. Credentials читаются только из runtime environment.

Payment adapter поддерживает UAT base URL и остается отключенным по умолчанию.

Payment orchestration поддерживает только явно настроенный submitted
`Sales Invoice`:

- customer scope повторно проверяется backend;
- amount берется из `outstanding_amount`;
- request/session/transaction фиксируются в versioned website payment table;
- callback сверяет reference, amount и currency через Windcave query;
- повтор ищет существующий Payment Entry по provider transaction id;
- Payment Entry создается только при полном ERP account mapping.

До заполнения всех `PAYMENT_*`/`ERP_PAYMENT_*` значений public config имеет
`enabled=false`.

## Storefront fallback

ERP-controlled departments, banners, catalogs, manufacturers и customer corner
сохраняют `source` metadata. `STOREFRONT_FALLBACK_MODE` определяет поведение:

- `allow` сохраняет локальный fallback;
- `warn` сохраняет fallback и помечает degraded resources в
  `/api/storefront/diagnostics`;
- `deny` возвращает ошибку вместо неявной подмены ERP-контента.

Testing использует `warn`; переход на `deny` выполняется после заполнения и
проверки всех ERP website DocTypes.

## GitHub

`main` является release branch. CI выполняет repository contract, foundation
tests, TypeScript checks, account/payment tests и production build.

## Testing host

- SSH alias: `cloud`;
- repository path:
  `/home/csrss/stacks/testing.greenleafpacific.com`;
- public URL: `https://testing.greenleafpacific.com`;
- containers: `testinggreenleafpacificcom_web_1` и
  `testinggreenleafpacificcom_api_1`.

Эти имена не являются production identifiers.
