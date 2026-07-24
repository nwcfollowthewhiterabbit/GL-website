# Website backup и restore

## Scope

Website rollback point включает:

- Git commit и remote branch;
- Docker Compose, Dockerfiles и Nginx configuration из commit;
- server-only `.env` backup в защищенном месте вне repository;
- website-owned static/upload assets, если они появятся;
- container/image identifiers, достаточные для диагностики rollback.

Не входит:

- ERPNext database;
- ERPNext files;
- ERP containers;
- business documents и catalog data, которыми владеет ERPNext.

## Restore

Website code restore должен:

1. выбрать существующий проверенный commit;
2. сохранить текущий website rollback point;
3. восстановить server configuration без вывода значений;
4. rebuild/restart только website stack;
5. проверить health, smoke, visual и security headers;
6. записать evidence результата.

## Команды

Создание website-only backup:

```bash
python3 scripts/backup.py --execute --evidence /secure/path/backup-evidence.json
```

Backup сохраняется на host в
`/home/csrss/backups/testing.greenleafpacific.com/<run-id>`. Архив и manifest
имеют SHA-256 и права `0600`; `.env` никогда не выводится.

Restore состоит из двух разных действий:

```bash
python3 scripts/restore.py \
  --backup-reference /home/csrss/backups/testing.greenleafpacific.com/<run-id>

python3 scripts/restore.py --execute \
  --restore-plan /home/csrss/backups/testing.greenleafpacific.com/restore-plans/<run-id>.json \
  --confirmation-token <one-time-token> \
  --evidence /secure/path/restore-evidence.json
```

Plan проверяет checksum и выдает одноразовый token на 15 минут. Execute сначала
создает diagnostic backup текущего сайта, затем восстанавливает только website
configuration/uploads и точный Git SHA, пересобирает website stack и выполняет
public validation.

## Критерий готовности adapters

- изолированный contract test;
- backup хранится вне изменяемого runtime;
- evidence не содержит environment values;
- restore покрыт isolated contract и требует отдельного controlled rollback
  drill перед production;
- ERP resources не затрагиваются;
- повторный запуск не удаляет валидный backup.
