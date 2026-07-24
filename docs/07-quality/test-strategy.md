# Стратегия качества

## Локальная обязательная проверка

```bash
npm run verify
```

Команда выполняет:

1. repository structure, links, secret policy и CI policy;
2. 56 foundation unit/contract tests;
3. TypeScript typecheck;
4. account authentication tests;
5. account isolation, quote idempotency, fallback и payment notification
   contract tests;
6. Windcave adapter tests;
7. production build.
8. configured runtime adapter probes/evidence through `check:release`.

## Runtime smoke

```bash
SMOKE_BASE_URL=https://testing.greenleafpacific.com npm run smoke
```

Проверяются catalog APIs, protected routes, customer login availability,
security headers, CORS, editorial routes и compliance assets.

## Browser regression

```bash
VISUAL_BASE_URL=https://testing.greenleafpacific.com npm run visual:smoke
```

Проверяются mobile `390px` и desktop `1440px`: catalog, basket, account login,
authenticated account, policies, payment security, operations и about pages.
Тест также проверяет отсутствие horizontal overflow и загрузку изображений.

## ERP integration

```bash
npm run erpnext:validate:docker
```

Strict ERP validation применяется перед production/UAT изменениями fixtures.

## Изменение и минимальный набор

| Изменение | Обязательные проверки |
|---|---|
| Docs/CI | repository + foundation tests |
| UI/CSS | verify + visual smoke |
| Account/security | verify + actual login/session + visual smoke |
| ERP catalog/write | verify + ERP validation + smoke |
| Payment | verify + UAT provider scenarios + ERP result check |
| Deploy/runtime | verify + backup evidence + smoke + visual + container status |
| Schema migration | verify + migration checksum/startup + instance validation |

Тестовые записи маркируются `GL-WEB-E2E-<RUN_ID>` и удаляются, если они не
являются согласованным постоянным fixture.
