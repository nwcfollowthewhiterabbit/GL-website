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

## Текущее состояние автоматизации

`scripts/backup.py` и `scripts/restore.py` являются fail-closed scaffold.
Автоматический deploy не должен обходить этот статус. До реализации adapters
backup/restore выполняются только как осознанная operator procedure с отдельной
проверкой target.

## Критерий готовности adapters

- изолированный contract test;
- backup хранится вне изменяемого runtime;
- evidence не содержит environment values;
- restore проверен на disposable website stack;
- ERP resources не затрагиваются;
- повторный запуск не удаляет валидный backup.
