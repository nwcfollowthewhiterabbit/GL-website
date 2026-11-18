# Журнал изменений

## 2026-11-18 — customer browser privacy

- Revoke the signed-out browser session on the server. Purge legacy contact drafts, keep new contact details in page memory, and preserve quote retries using a digest. Update patched API dependencies and isolate build tooling.

## 2026-11-18 — Storefront presentation and quotation terms

- Preserved complete campaign artwork on small screens and added readable linked captions, compact images and the site icon.
- Corrected tablet filters, keyboard access to the product preview and the account-loading state.
- Updated customer-facing terms, payment information and privacy copy for the current sales-reviewed quotation process.

## 2026-11-18 — Упаковки каталога и котировки

- Сохранены продажная упаковка и цена на всём пути до строк ERP. Разные упаковки одного SKU остаются отдельными строками при любом порядке добавления.
- Старые корзины сохраняют количество и запрашивают явный выбор, если упаковку нельзя восстановить однозначно.

## 2026-11-17 — Customer quotation release

- Added email-first registration and single-use password recovery with throttling.
- Bound quotation submission to the signed-in customer and rejected invalid/partial carts.
- Added paged account history and preserved the basket during sign-in/registration.
- Replaced checkout/payment promises with quotation review; online payment remains disabled.
- Added additive challenge schema and isolated outbox validation; production delivery uses the existing Sales Team sender.
- Deployed code `88bdf5d` on the testing hostname with production ERP; public account/quote/order browser checks passed.
- Verified one authorized Inbox delivery and repaired provider-confirmed SendGrid DNS records; the original arrival authentication result remains historical.
- Recorded source, stage, production and cleanup evidence in [the release record](docs/08-operations/releases/2026-11-17-customer-quotation-release.md).

## 2026-11-17 — Testing website on production ERP and isolated v16 testing

- Published the new ERP-backed website only on the testing domain, with noindex and payments disabled.
- Restored the main OpenCart domain after a temporary cutover, following the owner’s scope correction.
- Preserved the old website content in a separately installed v16 ERP app and refreshed testing from production.
- Recorded immutable artifacts, role/permission checks, controlled canary cleanup, route rollback and retained legacy environments.
- Corrected the private API alias and disabled notification mail only for the reserved integration account.
- Documented that legacy runtime adapters still target the retained old testing stack.

## 2026-11-17 — Production website profile

- Added explicit public-origin/indexing build settings; robots, sitemap, editorial
  canonical metadata and nginx indexing headers now use the same profile.
  Testing remains non-indexed by default.
- Parameterized smoke checks for either the testing or production profile.
- Replaced testing-stage checkout wording with the active sales-confirmation flow.
- Product preview closes when adding an item so the basket is immediately usable.
- Successful order requests now describe sales confirmation without checkout rollout details.
- Quotation dates now follow the configured ERP timezone (Pacific/Fiji default),
  including the UTC-day boundary. Invalid SKU and repeated quote requests no
  longer create an unused Customer before returning their result.


Значимые изменения описываются через пользовательский или эксплуатационный
результат.

## Unreleased

### Added

- Переключатель светлой и темной темы с учетом системной настройки и
  сохранением выбора пользователя.
- Инженерная основа проекта: каноническая документация, repository contract,
  security checks, runtime adapter contracts и CI.
- Личный кабинет клиента с входом по email и паролю и документами ERPNext.
- Подготовленный серверный адаптер Windcave Hosted Payment Page.
- Управляемый lifecycle customer access: password reset, enable/disable и отзыв
  ранее выданных сессий.
- Диагностика источников storefront content и policy для ERP/static fallback.
- Contract tests для customer isolation, quote idempotency и Windcave
  notification verification.
- Website-only backup/restore/deploy и четыре runtime validation adapters с
  machine-readable evidence.
- Versioned website schema migrations для credentials и payment events.
- Идемпотентный Windcave callback -> ERPNext Payment Entry orchestration,
  остающийся disabled до полной UAT configuration.
- Prometheus-compatible metrics, structured logs и webhook-capable runtime
  monitor.
- Изолированный ERPNext v16 compatibility stand и минимальный
  `greenleaf_website` app с website DocTypes, fixtures и synthetic runtime
  contracts.
- Воспроизводимый изолированный rehearsal stack для миграции SQL-копии
  production ERP с v14 через v15 на v16.

### Changed

- Блок загрузки прайс-листов и каталогов скрыт с витрины вместе со ссылками
  в навигации; ERPNext-модель оставлена для возможного возврата раздела.
- Кнопка меню в верхней панели заменена прямым входом в личный кабинет.
- Страница личного кабинета отделена от витринных промоблоков и каталога.
- Account state и storefront content loading вынесены из `App.tsx` в отдельные
  hooks; account/payment CSS разделен по модулям.
- CI проверяет Python-контракт репозитория, TypeScript, account/payment tests и
  production build.
- Quote pricing теперь всегда берется из опубликованной ERP price list; цены,
  hidden products и произвольные price lists из public request не принимаются.
- Website runtime использует non-root/read-only containers и отдельного
  least-privilege ERP database user. Сайт больше не изменяет системные
  ERPNext User, Role и Contact tables.
- Public API errors больше не раскрывают внутренние database/runtime messages;
  catalog и file proxy получили rate и resource limits.
- Catalog и customer account SQL совместимы с ERPNext v14/v16; backend-created
  Customer может получить website password без отдельного Frappe Website User.
- Runtime contracts используют фактическую ERP price-list rate, а storefront
  smoke различает ERP content и явно объявленный degraded fallback.
- API secret интеграционного пользователя сохраняется через encrypted-password
  API Frappe, совместимый с v16.

### Known limitations

- Windcave остается выключенным до получения UAT credentials и подтверждения
  Sales Invoice/payment account mapping.
- Внешний alert recipient и controlled restore drill требуют operations
  configuration/evidence.
- Самостоятельная регистрация клиента пока не реализована.
- Перенос website-layer на чистый ERPNext v16 и миграция SQL-копии production
  v14 до v16 проверены; business UAT и cutover остаются release gates.

## ERP overlay preservation — 2026-11-17

- Added read-only export/plan and compare-and-swap import for website-owned content
  and explicit Item/Item Group website values; existing differing records fail closed.
- Recorded two evidence-based menu reference corrections without changing ERP groups.
- Website Control Center now uses per-site public/internal URLs and a server-only
  System Manager proxy for customer access; no testing URL or admin token in browser.

## Quote request replay isolation — 2026-11-17

- Request IDs use exact indexed matching and an exact legacy first-line marker;
  underscores and prefixes no longer match unrelated quotations.
- Replays are bound to the normalized customer and request payload. Conflicting
  reuse fails without disclosing another quotation or creating a Customer.
- In-flight payload checks and a database advisory lock protect repeats across
  API processes; the lock connection is separate from the catalog read pool.

- Public JSON parsing now rejects compressed request bodies before inflation; plain browser/API JSON remains accepted.
