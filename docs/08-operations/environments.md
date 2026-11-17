# Окружения

Финальный scope по уточнению владельца 2026-11-17. SSH alias: `cloud`.

| Назначение | Публичный адрес | Stack / ERP target |
|---|---|---|
| Прежний основной сайт | `https://greenleafpacific.com` | сохранённый OpenCart origin; основной домен не переносится на новый сайт |
| Новый сайт | `https://testing.greenleafpacific.com` | `cloud:/home/csrss/stacks/greenleaf-website-20261117`, project `gl-website-production-20261117`; подключён к production ERP |
| Production ERP | `https://erp.greenleafpacific.com` | `erp-next-20261005`, project `gl-cutover-20261005` |
| Изолированная testing ERP / bot | `https://testing.erp.greenleafpacific.com` | `gl-website-stage-20261117`, project `gl-web-stage-20261117`; свежая отдельная DB |
| Private rehearsal website | публичного website alias нет | тот же isolated stage root; loopback18494 |

Новый публичный testing website слушает loopback18594; testing ERP —18393.
Имя проекта с production обозначает backend target, а не разрешение использовать
основной публичный домен. Website build/public origin — testing, indexing disabled.
Payments выключены. Новый website работает с настоящими production Customer и
Quotation; изолированная testing ERP/bot работает с отдельной копией.

Source checkout: `/home/csrss/releases/gl-website-20261117-source`, branch `main`.
Секреты/keys/session secrets/DB grants stage и production раздельные. Оба ERP site
могут называться `erp.greenleafpacific.com`; target проверяют по DB host и mounts.
Testing workers и внешние integrations не активируются восстановлением DB.

## Сохранённые окружения

Старая v14 testing и `/home/csrss/stacks/testing.greenleafpacific.com` сохранены;
их website API/monitor и ERP scheduler/queue workers остановлены. Legacy runtime
adapters всё ещё связаны с этим старым stack, а не с новым публичным testing.

OpenCart origin сохраняет свои DB/files/orders. Временный scoped503 и apex DNS
cutover отменены по уточнению владельца; никакая старая ERP DB поверх новых
production записей не восстанавливается.

## Local и границы deploy

Local Docker Compose: `http://localhost:8080`, untracked `.env`.
Website deploy/backup не включает ERP migrate/DB/files; website ERP overlay имеет
[отдельный runbook](website-overlay-preservation.md).
