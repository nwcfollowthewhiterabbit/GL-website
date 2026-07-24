# Трассировка требований

| Требование | Реализация | Проверка |
|---|---|---|
| ERP-backed catalog | `api/catalog-service.mjs`, storefront components | smoke + ERP validation |
| Idempotent quotation | quote API, stable client id and ERP fields | `test:integration` + smoke |
| Password customer login | versioned session, account service, `AccountPage.tsx` | `test:account` + actual login |
| Customer isolation | scoped queries plus result boundary check | `test:integration` + protected route |
| Windcave HPP only | server-side session/notification verification | `test:payments` + `test:integration` + UAT |
| Controlled static fallback | source metadata and runtime policy | `test:integration` + storefront diagnostics |
| No indexing on testing | Nginx/static compliance | smoke |
| Responsive UI | React/CSS | visual smoke 390/1440 |
| Repository safety | foundation scripts/contracts | `check:repository` + foundation tests |
| Reproducible release | Git/CI/operations docs | release readiness after adapters |
