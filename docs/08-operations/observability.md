# Наблюдаемость

## Текущие сигналы

- Public `/health`.
- Docker container status.
- API container logs.
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

## Ограничение

Centralized metrics/alerts и назначенный on-call пока отсутствуют. Это blocker
production operations, но не testing development.
