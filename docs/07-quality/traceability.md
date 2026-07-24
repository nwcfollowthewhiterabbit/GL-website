# Трассировка требований

| Требование | Реализация | Проверка |
|---|---|---|
| ERP-backed catalog | `api/catalog-service.mjs`, storefront components | smoke + ERP validation |
| Idempotent quotation | quote API, stable client id and ERP fields | `test:integration` + smoke |
| Password customer login | versioned session, account service, `AccountPage.tsx` | `test:account` + actual login |
| Customer isolation | scoped queries plus result boundary check | `test:integration` + protected route |
| Windcave HPP only | server-side session/notification verification | `test:payments` + `test:integration` + UAT |
| Idempotent ERP payment effect | website payment event + transaction reference lookup | `test:integration` + Windcave UAT |
| Controlled static fallback | source metadata and runtime policy | `test:integration` + storefront diagnostics |
| No indexing on testing | Nginx/static compliance | smoke |
| Responsive UI | React/CSS | visual smoke 390/1440 |
| Repository safety | foundation scripts/contracts | `check:repository` + foundation tests |
| Reproducible release | configured runtime adapters and evidence schema | `check:release` + runtime evidence |
| Runtime observability | metrics, structured logs, monitor/webhook | instance validation + alert test |
