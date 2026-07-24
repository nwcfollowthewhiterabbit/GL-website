# Deployment

## Текущее состояние

Testing deploy подтвержден вручную, но foundation adapter
`scripts/deploy_existing_instance.py` пока fail-closed. Поэтому
`automation.state = "scaffold"` и release readiness не может быть зеленым.

## Проверенный ручной порядок testing update

1. `npm run verify`.
2. Commit и push в `main`.
3. Подтвердить exact remote SHA и CI.
4. Зафиксировать website rollback commit и server configuration backup.
5. На host выполнить fast-forward pull в repository path.
6. Выполнить `docker-compose up --build -d`.
7. Проверить web/API containers и API logs.
8. Выполнить public smoke и visual smoke.
9. Проверить actual customer login, если изменялся account flow.

## Ограничения

- Не выполнять force checkout/reset.
- Не печатать `.env`.
- Не перезапускать и не изменять ERP stack.
- Не включать payment/indexing автоматически.
- Артефакт должен строиться из отправленного commit.

## Целевой adapter

Existing-instance adapter должен:

- принимать явные target environment и expected SHA;
- требовать валидное website backup evidence;
- разрешать только fast-forward;
- build/restart только website stack;
- выполнять health, smoke и container checks;
- возвращать machine-readable evidence;
- завершаться отказом при любой обязательной ошибке.

First-instance deploy остается отдельной операцией и не применяется к текущему
testing host.
