# Границы безопасности

## Card data

Сайт не содержит card form и не принимает PAN/CVV. Ввод карты выполняется на
Windcave Hosted Payment Page. Callback обязательно подтверждается provider API.

## Secrets

- Git содержит только имена environment variables.
- Реальные значения находятся в server `.env`.
- Логи, smoke output и release evidence не печатают credentials или cookies.
- CI actions закреплены по полному commit SHA.
- Repository check ищет private keys, известные token formats, credential URLs
  и secret-bearing config values.

## Customer data

- Account documents разрешаются из authenticated email через ERP links.
- ERPNext `Website User`, `Website Customer` role, Contact и Customer link
  создаются штатно в ERPNext. Website API только проверяет эту связь и хранит
  собственный password hash.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Login имеет rate limit.
- Password hash отделен от storefront session secret.
- Тестовые данные используют отдельного синтетического Customer.

## Runtime separation

Website Docker Compose stack и ERP stack имеют разные ownership boundaries.
Обычный website deploy не выполняет ERP backup, migration или restart.

- Website API подключается к MariaDB только отдельным non-root user.
- User имеет read-only доступ к ERP data и write/DDL только к versioned
  website-owned tables.
- API, web и monitor работают non-root, с read-only root filesystem, dropped
  Linux capabilities и `no-new-privileges`.
- Monitor получает только alert/monitor variables, а не полный website `.env`.

## Public testing

- Search indexing выключен.
- Security headers и CORS проверяются smoke test.
- Admin endpoints требуют token и не публикуют environment values.

## Compressed request bodies

The public API accepts plain JSON up to 1 MiB and configures `inflate: false`.
Compressed JSON is rejected with HTTP 415 before decompression or business
handlers. This removes the reachable body-parser decompression crash path while
retaining the existing browser and ERP proxy request format.


## Build dependencies

The API image installs `npm ci --omit=dev`; Vite, the React build plugin and
TypeScript are build-only. The 2026-11-18 lockfile audit reported zero advisories
for API dependencies. The full build tree still reports the picomatch advisory
and its dependants in the reviewed Vite pipeline. Only repository-controlled
patterns are used during the build. Track a patched upstream version.
[Advisory GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
