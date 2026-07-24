# Архитектура

## Runtime

```text
Browser
  -> Nginx web container
     -> React/Vite static assets
     -> /api proxy
        -> Node integration API
           -> ERPNext REST API
           -> ERPNext MariaDB for approved read/control paths
           -> Windcave HPP API when enabled
```

`web` и `api` находятся в отдельном Docker Compose stack сайта. ERPNext остается
отдельным operational runtime.

## Границы компонентов

- `src/`: пользовательский storefront.
- `api/`: backend validation, account scoping, ERP and payment adapters.
- `erpnext/`: versioned fixtures and Desk assets needed by website integration.
- `scripts/*.mjs`: build, setup, seed, smoke and browser checks.
- `scripts/*.py`: repository foundation and fail-closed runtime contracts.
- `docs/`: факты, решения, процессы, quality и operations.
- `contracts/`: machine-readable evidence and adapter obligations.

## Источники правды

- Код и документация: GitHub `main`.
- Catalog/customer/sales data: ERPNext.
- Website content controls: ERPNext Website DocTypes with local fallback only
  where explicitly implemented.
- Cardholder data and authorization UI: Windcave HPP.
- Runtime values: server-side `.env`, never Git.

Подробности: [integrations.md](integrations.md),
[access-control.md](access-control.md) и
[security-boundaries.md](security-boundaries.md).
