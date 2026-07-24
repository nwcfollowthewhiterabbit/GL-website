# ADR-0001: GitHub main как source of truth

- Статус: accepted
- Дата: 2026-07-24

## Контекст

Testing website ранее изменялся непосредственно на server. Для
воспроизводимости нужен один versioned источник кода, конфигурации и
документации.

## Решение

Repository `nwcfollowthewhiterabbit/GL-website`, branch `main`, является source
of truth. Server принимает только fast-forward commits. Runtime environment
остается вне Git. Изменения сначала проверяются и отправляются, затем из exact
commit строится artifact.

## Последствия

- Runtime-only изменение считается временным и должно быть перенесено в Git.
- Force reset и незафиксированные server edits блокируют deploy.
- Rollback выбирает существующий commit и не изменяет ERP data.
