# 2026-11-17 — Регистрация и запросы котировок без онлайн-оплаты

Развёрнуто 2026-11-17 20:10:45 UTC. Публичный браузер проверен 20:24:11 UTC.
Production cleanup и независимый zero-residue proof завершены; private fixture
удалён 20:27:33 UTC. Исходные истории проверок сохранены.

## Scope и source

Новый сайт остаётся на `https://testing.greenleafpacific.com`, noindex, с
production ERP. Main/www остаются прежним OpenCart. Запросы на testing hostname
создают реальные бизнес-документы. ERP application/image этим релизом не меняется.

- Repo/branch: `nwcfollowthewhiterabbit/GL-website`, `main`.
- Финальный code SHA: `88bdf5debd8007bfc16b28508c5562e08a2930b9`.
- [Exact-SHA CI 44159840146](https://github.com/nwcfollowthewhiterabbit/GL-website/actions/runs/44159840146): success, 19:33:53 UTC.
- Полный verify/readiness прошёл: 72 foundation tests, 48 self-service checks,
  typecheck/build и обязательные contracts. Финальная поправка — 14 публичных
  текстов каталога, без изменения logic/layout/API/ERP.
- Evidence: `source-checks-final.json`, `ci-88bdf5d.json` в operations packet
  `docs/evidence/website-customer-release-20261117/`. Завершённые source/stage/backup/DNS результаты опубликованы в canonical
  operations work-log; финальная запись сверяется с production cleanup.
- [Первоначальное подключение сайта к ERP](2026-11-17-testing-site-production-erp.md)
  остаётся историей; его ограничения self-registration не описывают новый код.

## Поведение клиента

Регистрация начинается с email; пароль выбирается после одноразовой ссылки
(30 минут, новый допустимый запрос заменяет предыдущую). Ответ generic;
ограничения действуют по IP/email. Fragment удаляется после чтения, в том числе
при открытии новой ссылки на уже открытой странице. Хранятся hash и срок токена.
После проверки почты обязательны company/contact/phone и пароль 10–128 символов.

Website password отделён от ERP password. Существующий администраторский доступ
сохраняется; активный ERP staff user может подтвердить свою почту и завести
отдельный website password без изменения `__Auth`, ERP ролей и прав. Reset
одноразовый, отзывает старые sessions; registration/reset не включают отключённый
website credential или ERP User. Доступ восстанавливается через администратора.

Корзина сохраняется при переходе к регистрации/входу. Отправка требует session;
backend связывает запрос с её email/Customer, проверяет все SKU/количества и
берёт цены из ERP. Невалидная строка блокирует запрос целиком. Создаётся draft
Quotation для sales review, без подтверждения заказа, резерва и оплаты.

Повтор неопределённой попытки сохраняет ID. После HTTP success `created` или
`idempotent` с quotation reference удаляется только соответствующий завершённый
ID; новая одинаковая корзина после reload создаёт новую заявку. Ключ другой
вкладки сохраняется. Кабинет показывает customer-scoped котировки, Sales Orders
и invoices, строки, ERP статусы и постраничную историю. Draft — `Under review`,
Open Quotation — `Quotation ready`; On Hold имеет приоритет над долей доставки.
Online payments и финансовые ERP writes выключены; sales подтверждает каждую
котировку и дальнейшие условия.

## Runtime и доказательства

| Target | Проверенное состояние / оставшийся gate |
| --- | --- |
| Private stage, `gl-web-stage-20261117`, loopback `18494` | API/web `ef9e479` развёрнуты 19:18:00 UTC; migration `003-website-account-challenge`, temporary migrator removed, payments off. Receipt `initial-stage-deployment.json` |
| Final web `88bdf5d` | Bundle `/assets/index-Twfga-Cy.js` проверен через local preview с реальным stage API; final web image активен на stage и public testing, `runtime-metadata-final.json` |
| Public testing / production ERP, `gl-website-production-20261117`, loopback `18594` | Deploy завершён 20:10:45; account registration/reset enabled, payments off, migration 003; `production-deployment.json`, `production-post-deploy-checks.json` |
| API / monitor image | `sha256:5cf12c02c9a652d60ebb77565ad4ce92ca9fdae13363741b896c9041cfe30103` |
| Web image | `sha256:5dded870ff825c2dcb931b6283fe66661ae4bad81781f59e289775d553cff267` |
| ERP image | `sha256:e57484298a13c99e527cf488c16893264dde2af85e7773f62ebd29de2e04478f`; IDs/images/state десяти ERP containers сохранены |

| Проверка | Результат и receipt |
| --- | --- |
| Stage API | 63/63: register, one-use, session, quote/replay, invalid lines, price tamper, ownership, paging, reset/revocation/logout; `stage-api-acceptance.json` |
| Native draft Sales Order и HTTP | 9/9: own detail/history/offset, чужой Customer/Guest denied; financial counts unchanged, zero synthetic recipients; `stage-api-native-fixture.json` |
| Real stage UI / final compiled bundle | Passed 19:46:25 UTC: email-first registration, fragment removed, basket retained, own quote/order history/details, logout; desktop 1440/mobile 390, no overflow/payment buttons. `stage-browser-acceptance.json`, screenshots `browser/stage-*.png` |
| Final bundle repeat request | Одинаковые business payload после success/reload дали разные `QTN-19126`/`QTN-19127`, видимое подтверждение и собственную историю из трёх котировок. Реальный stage API, не mocks; remote image activation проверяется отдельно |
| Local UI / retry | `ui-mock-qa.json`, `repeat-quote-fix-receipt.json`, `repeat-quote-cache-guards-receipt.json`; 9/9 cache guards |
| API fixture group cleanup | Passed 19:31:29–19:32:37 UTC: exact-owned records и recipients 0, exact outbox/fixture files removed; `stage-api-cleanup.json`, `stage-api-post-cleanup-proof.json`, `stage-api-outbox-cleanup.json` |
| Stage UI group cleanup | Passed: native cleanup 19:47:20, zero-residue proof 19:48:10, exact outbox cleanup 19:48:16; `stage-ui-cleanup.json`, `stage-ui-post-cleanup-proof.json`, `stage-ui-outbox-cleanup.json` |
| Browser secrets cleanup | Context/cookies/link reference cleared, exact local fixture removed 19:47:12; `stage-browser-secrets-cleanup.json` |
| Stage combined totals | Удалены 3 Customer, 5 Quotation, 2 draft Sales Order и связанные exact-owned auth/contact/EPS записи. Финансовые counts неизменны, synthetic recipients 0 |
| Production API/native | Первые 56 checks прошли, затем quote HTTP201-check остановился на native SQL1054; продолжение 29/29 прошло, `QTN-19117`/`QTN-19118`, native draft `SO-10591`, financial counts unchanged, synthetic recipients 0 |
| Public browser | Passed 20:24:11: login, own quote/order history/status/details, empty invoices, mobile390 без overflow, logout clears, no payment buttons; `production-public-browser.json` |
| Production smoke/monitor | Public smoke passed, monitor failureCount0, indexing off; `production-smoke-monitor.json` |
| Production cleanup | Native cleanup committed 20:26:59: 2 Customer/Contact/credentials, 4 challenges, QTN-19117/19118, SO-10591 и 2 exact EPS logs удалены. Zero-residue proof passed 20:27:17; private fixture absence verified 20:27:33. `production-native-cleanup.json`, `production-post-cleanup-proof.json`, `production-private-fixture-cleanup.json` |

Mock UI не подтверждает ERP/mail. Final compiled bundle `88bdf5d` проверен с
реальным stage API через local same-origin transport; production activation и
public acceptance подтверждены отдельными receipts выше. Stage использовал synthetic `.invalid`
аккаунты без реальной отправки почты. Original receipts (`initial-*`, failed
cleanup и later proofs) сохраняются без переписывания.

## Почта, backup и migration

Production использует SendGrid HTTP API с существующим Sales Team sender;
секрет только в protected `website.env`, без SQL-доступа сайта к ERP secrets.
Stage использует `ACCOUNT_ENVIRONMENT=test`, transport `outbox`, protected
`/private/account-outbox` (directory 0700, files 0600), без SendGrid credential.
Одно разрешённое регистрационное письмо отправлено 20:12:07, получено в Gmail
Inbox 20:12:09 UTC; `production-approved-mail-delivery.json` не содержит токена
или личного адреса. Регистрация получателя не завершалась; повторных писем нет.
При получении GreenLeaf DKIM/SPF/DMARC не прошли. Позже исправлены только три
SendGrid DNS records: s1/s2 DNS-only и отсутствующий em3979 CNAME; live provider
validation прошла 20:17:51 (`sendgrid-dns-repair.json`,
`sendgrid-domain-auth-validation.json`). Это не новый Gmail authentication pass:
результат первого письма исторический, прежний отрицательный DNS cache может
сохраняться до TTL. Две прежние apex SPF записи — отдельный follow-up, не
блокировка исправленного SendGrid subdomain; Zoho MX/apex SPF/DMARC не менялись.

Production recovery point завершён 19:33:48 UTC:
`/home/csrss/backups/website-customer-release-20261117T191835Z-production`.
`production-backup.json` подтверждает SQL gzip/checksum, 1303 таблицы, config/assets
и прежние images. Receipt сохраняет наблюдавшийся source `f17fdf3`; финальный
`88bdf5d` меняет только публичный текст. Restore не выполнялся. Online InnoDB SQL
с вспомогательными MyISAM ограничениями не является atomic all-services snapshot;
неизменяемые ERP attachments не копировались повторно. Stage backup receipt:
`/home/csrss/backups/website-customer-release-20261117T190131Z-stage/receipt.json`.

Backup/deploy используют global `LOCK_SH` на `/run/greenleaf-stack-backup.lock`
и свой `LOCK_EX` на `/run/greenleaf-website-customer-release.lock`. Проверенный
immutable-archive reader с shared lock не мутировал DB и не пересекался с
website/stage; evidence `lock-scope-assessment.json`. Это не разрешение обходить
новый exclusive holder. Перед DDL исключить активный SQL dump. Additive migration
добавляет только `tabWebsite Account Challenge`; runtime SELECT/INSERT/UPDATE,
без DDL и ERP secret/financial writes. Production migration применена; временный
migrator удалён, grants проверены. Release locks освобождены 20:24:13 UTC,
`release-lock-final.json`; сохранено ноль descriptors.

## Concurrent ERP schema observation

При production canary возник native SQL1054 по `email_quotation_review`.
Отдельный параллельный ERP installer 20:14:14 UTC создал
`email_quotation_review` и `email_source_communication`; источник полей
подтверждён в `production-quotation-field-provenance.json`. Точный механизм
кратковременного 1054 не доказан. Текущие native metadata/physical column
согласованы, продолжение прошло без ERP DDL/cache исправления со стороны
website release. Сохранены initial failure, native error и continuation receipts;
website migration по-прежнему ограничена account-challenge table.

## Обязательная очистка и rollback

Использовать reviewed `customer-release-exact-cleanup-wrapper.py`, SHA-256
`a1ac459603b8f7408cfea6e5a5cfe90e04d2a715514d896dc5ff0bced984c347`, поверх pinned
native helper SHA-256 `a32f01f8b63f765f8fa4f3044f53514f2539e7e01f0d71edb4a848cc867cdda0`.
Исходный helper при native deletion запрещает enqueue
`frappe.model.delete_doc.delete_dynamic_links`; первая попытка безопасно
откатилась (`stage-api-cleanup-attempt1.json`). Wrapper вызывает только эту
штатную функцию синхронно в cleanup transaction и только для exact-owned targets;
другие background/mail hooks остаются запрещены.

Удалять только manifest-owned synthetic Customer/Contact/Quotation/Sales Order,
credentials/challenges и точные EPS Auto +5 deletion effects. Не менять global
EPS rule. Затем independently проверить нулевые остатки/recipients и удалить
только exact outbox/browser fixture files. Сначала завершить browser acceptance.

Rollback возвращает только прежние website images/config для нужного target;
сначала остановить writer и сохранить текущее состояние. Сохранить additive
schema, новые реальные credentials/Customers/Quotations и другие business records.
Старую ERP DB поверх них не восстанавливать; main/www не переключать. Проверить
catalog/account, payments off и exact runtime. Rollback drill не заявлен.

Production release checks и exact cleanup завершены. Financial counts
26995/10783/187477/52151 не изменились, synthetic recipients 0; diagnostic
Error Log `6qpcs0gtsm` и challenge разрешённого реального mailbox сохранены.
`production-customer-acceptance-final.json` связывает original failure, continuation,
browser и cleanup receipts; `production-native-after.json` подтверждает также
отсутствие synthetic User и financial documents. Финальный documentation commit/CI публикуется
отдельно; code/runtime SHA выше сохраняется. Уже опубликованные outcome не дублировать.
