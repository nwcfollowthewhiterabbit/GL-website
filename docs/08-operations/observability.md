# Наблюдаемость

## Active runtime — 2026-11-17

В новом website с production ERP и private rehearsal запущен source-provided `monitor` service из того
же API image. Интервал — 60 секунд; проверяются HTTP health, storefront diagnostics
и payment readiness. Контейнеры подключены к соответствующей isolated network,
не имеют ERP credentials и не отправляют внешний webhook. Docker logs ограничены
10 MB × 3 на контейнер. Alerts пока остаются в логах; external recipient/on-call
не объявляются настроенными.

## Текущие сигналы

- Public `/health`.
- Protected Prometheus-compatible `/api/admin/metrics`.
- Docker container status.
- Structured JSON API/monitor logs.
- `monitor` container выполняет health/storefront/payment-readiness checks.
- `ALERT_WEBHOOK_URL` доставляет critical/recovery alert во внешнюю систему;
  при необходимости используется `ALERT_WEBHOOK_BEARER_TOKEN`.
- Public smoke suite.
- Browser visual suite.
- ERPNext validation script.
- GitHub CI for exact commit SHA.

## После deploy

Проверяются:

1. web/api containers находятся в `Up`;
2. API log не содержит startup/runtime errors;
3. health возвращает success;
4. smoke и visual checks проходят;
5. account/payment readiness соответствует environment flags.

## Метрики

Metrics endpoint содержит process uptime, HTTP request counters/duration и
payment notification outcome/effect counters. Endpoint защищен
`ADMIN_API_TOKEN`; scraper должен использовать Bearer token.

## Alerts

Monitor выполняется каждые `MONITOR_INTERVAL_SECONDS` (минимум 30 секунд),
дедуплицирует одинаковый incident и отправляет recovery после восстановления.
Без `ALERT_WEBHOOK_URL` alert остается в structured container log. Конкретный
webhook recipient и on-call schedule являются environment/operations
configuration, а не значениями repository.
