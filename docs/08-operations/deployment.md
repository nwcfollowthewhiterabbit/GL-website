# Deployment

## Новый testing website → production ERP, с 2026-11-17

Активные targets и независимый source checkout перечислены в
[environments](environments.md). Первый запуск выполнен отдельным reviewed
operator workflow; [release record](releases/2026-11-17-testing-site-production-erp.md)
связывает точные source commits, immutable images, acceptance и rollback.

Перед следующим обновлением:

1. Проверить clean source, отправленный commit, exact remote SHA и успешный CI.
2. Выбрать конкретный website/rehearsal project и сохранить protected config
   preimages и проверенный website backup. Не печатать environment values.
3. Строить web с нужными `PUBLIC_SITE_URL`/`SITE_INDEXING_ENABLED`; API и ERP images
   могут сохраняться только при доказанной идентичности соответствующих Git trees.
4. Проверить exact image IDs, native role/grant contract, schema ledger и готовность
   API на private origin, затем public smoke и customer-scoped UI.
5. Основной домен не переключать: текущий approved hostname — testing.greenleafpacific.com.
   Отдельно проверить любые новые business hooks и notification side effects.
   Service-user email не должен отправляться на reserved `.invalid` address.
6. Записать receipts, фактический cleanup и rollback boundary.

Изменение ERP приложения остаётся отдельной операцией с shared
`/run/greenleaf-stack-backup.lock`, preinstall DB/config backup, maintenance/drain,
физическим DB guard, native install/migrate и website-only CAS import. Обычное
обновление website не перезапускает ERP containers и не восстанавливает ERP DB.

## Website session revocation

Apply additive migration `004-website-session-revocation` with the migration
account before starting this API. Limit new runtime grants to SELECT, INSERT and
DELETE on `tabWebsite Session Revocation`. Keep the table and rows across API
restarts. Records contain a token digest and expiry in epoch milliseconds. A
logout records revocation before clearing the cookie. In isolated acceptance
check that the signed-out session ends and a second browser keeps its session.
Rolling back to an older API also removes its revocation check; before serving
that API rotate the website session secret to invalidate outstanding sessions.

## Legacy runtime adapters

`infra/runtime.testing.json` и `scripts/_runtime_adapter.py` пока привязаны к
сохранённому `/home/csrss/stacks/testing.greenleafpacific.com` и
`testinggreenleafpacificcom_*`. Их execute-команды backup/deploy/restore не являются
операторами новых активных stacks. Публичный testing hostname уже переключён;
его имя не разрешает заменять target в старом adapter наугад. Перенос adapters,
их recovery contract и отдельный restore drill требуют reviewed изменения.

Не запускать старый `deploy_existing_instance.py --execute` для обновления нового
testing. Исторические implementation/tests сохранены; новая runtime topology
документирована отдельно и не выдаётся за автоматически перенесённую automation.

## Разрешения и rollback

Production API требует explicit non-root DB credentials. Runtime SQL grants
ограничены нужными ERP tables/columns и website-owned tables. Временный migration
user с нужным DDL удаляется после schema runner; runtime не получает schema-wide
DDL или доступ к `__Auth`/секретным полям User.

Native integration role разрешает Customer/Contact creation, draft Quotation
read/create/write и необходимые reference reads, включая Account. Submit,
финансовые документы и административные права не выдаются.

Payments не включаются автоматически. Web rollback останавливает новый writer
и возвращает проверенный route/image. Additive ERP app/schema и уже появившиеся
business documents сохраняются; возврат старой DB после новых записей запрещён.
Сверка новых заявок выполняется отдельно до возобновления старого writer.

## Customer quotation release (2026-11-17)

The release adds website-owned migration003 (`tabWebsite Account Challenge`),
not an ERP app update. Runtime gains only SELECT/INSERT/UPDATE on that table;
use a temporary table-scoped migration identity and remove it afterwards.
No ERP containers/images or financial document permissions change.

Production email uses the existing Sales Team sender with the private SendGrid
credential copied server-to-server into protected website.env. API requires
outbound HTTPS on the existing edge network and still has no host-published port.
`ACCOUNT_SELF_SERVICE_ENABLED=true` enables verified registration and recovery;
payments and payment ERP writes stay false. Never print email tokens/passwords.

The isolated stage uses `ACCOUNT_ENVIRONMENT=test`,
`ACCOUNT_EMAIL_TRANSPORT=outbox` and a protected mounted absolute outbox directory.
It has no SendGrid credential and does not deliver messages. A separate browser
fixture may be written0600 outside source for synthetic acceptance, then removed.

Source/runtime checks: `npm run verify`, `npm run check:release`, exact main SHA/CI,
fresh bounded SQL + website/config backup, immutable image build, migration,
`scripts/customer-release-runtime-test.mjs` on stage, browser and public smoke.
Cleanup must remove only recorded GL-WEB-E2E records and exact EPS delete side
effects. Preserve newly created real Customer/Quotation records during rollback.

For this website-only operation, a global shared backup lock may coexist with
a proven read-only immutable-archive verifier, while a dedicated exclusive
website release lock serializes backup/schema/deploy operations. The shared lock
blocks scheduled exclusive snapshot/prune producers. Before DDL, also verify no
mariadb-dump/mysqldump is active. Native ERP app changes retain their existing
exclusive global lock rule. Record exact lock-holder evidence for this exception.
