# Release checklist

Release record должен подтвердить:

## Source

- рабочее дерево чистое;
- branch `main`;
- local, GitHub и deployed SHA совпадают;
- CI успешен для exact SHA.

## Validation

- `npm run verify`;
- применимые ERP/integration tests;
- public smoke;
- visual smoke для UI changes;
- actual role scenario для account/payment changes.

## Runtime

- target environment указан явно;
- website backup/rollback point проверен;
- ERP stack исключен из target;
- build/restart завершен;
- health, containers и logs проверены;
- payment/indexing flags не изменены случайно.

## Handover

- scope, limitations и manual checks сообщены;
- user manual/changelog обновлены;
- temporary test data очищены;
- release evidence не содержит secrets.

`automation.state = "configured"` подтверждается `npm run check:release`.
Фактический release все равно требует evidence конкретного backup/deploy и
runtime validation run.
