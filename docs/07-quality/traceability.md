# Трассировка требований

| Требование | Реализация | Проверка |
|---|---|---|
| ERP-backed catalog | `api/catalog-service.mjs`, storefront components | smoke + ERP validation |
| Idempotent quotation | quote API and ERP fields | smoke/integration scenario |
| Password customer login | `api/account-service.mjs`, `AccountPage.tsx` | `test:account` + actual login |
| Customer isolation | account service queries | protected route + cross-customer scenario |
| Windcave HPP only | `api/payment-service.mjs` | `test:payments` + UAT |
| No indexing on testing | Nginx/static compliance | smoke |
| Responsive UI | React/CSS | visual smoke 390/1440 |
| Repository safety | foundation scripts/contracts | `check:repository` + foundation tests |
| Reproducible release | Git/CI/operations docs | release readiness after adapters |
