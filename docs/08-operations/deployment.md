# Deployment

## Автоматизированный testing update

```bash
python3 scripts/deploy_existing_instance.py --execute \
  --expected-sha <full-40-character-sha> \
  --evidence /secure/path/deploy-evidence.json
```

Adapter автоматически:

1. создает и проверяет website-only backup;
2. требует clean `main` и exact match expected SHA с `origin/main`;
3. допускает только fast-forward;
4. пересобирает `api`, `web` и `monitor`;
5. проверяет, что website schema migrations уже применены, либо применяет их
   только при явном `--migrate-schema`;
6. проверяет containers, health, ERP storefront sources, payment-disabled state
   и noindex;
7. возвращает release/backup/rollback references и image digest.

Если release содержит новую website-owned migration, ее применение должно быть
явно разрешено:

```bash
python3 scripts/deploy_existing_instance.py --execute --migrate-schema \
  --expected-sha <full-40-character-sha>
```

Флаг изменяет только версионированные website-owned tables. Он не запускает ERP
backup, ERP application migration или restart ERP containers.

## Ручной аварийный порядок

1. `npm run verify`.
2. Commit и push в `main`.
3. Подтвердить exact remote SHA и CI.
4. Зафиксировать website rollback commit и server configuration backup.
5. На host выполнить fast-forward pull в repository path.
6. Выполнить `docker-compose build api web monitor`.
7. Выполнить `docker-compose run --rm -T api npm run erpnext:migrate-website`.
8. Выполнить `docker-compose up -d --no-build api web monitor`.
9. Проверить web/API/monitor containers и API logs.
10. Выполнить public smoke и visual smoke.
11. Проверить actual customer login, если изменялся account flow.

## Ограничения

- Не выполнять force checkout/reset.
- Не печатать `.env`.
- Не перезапускать и не изменять ERP stack.
- Не включать payment/indexing автоматически.
- Артефакт должен строиться из отправленного commit.
- Production-mode API требует explicit `ERPNEXT_DB_USER` и
  `ERPNEXT_DB_PASSWORD`; root user и `DB_ROOT_PASSWORD` fail closed.
- Database user должен иметь `SELECT` на ERP site database и write/DDL только
  на `tabWebsite Customer Credential`, `tabWebsite Payment Event` и
  `tabGL Website Schema Migration`.

First-instance deploy остается отдельной операцией и намеренно возвращает
blocked для существующего testing target.
