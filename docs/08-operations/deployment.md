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
