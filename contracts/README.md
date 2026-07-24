# Контракты runtime-автоматизации

Сценарии в `scripts/` используют настроенный testing adapter. Рабочая операция
требует явного `--execute`; probe не выполняет мутаций.

После выбора runtime каждый адаптер обязан:

1. реализовать описанный контракт без предположений, скрытых live-fix и секретов
   в аргументах;
2. поддерживать неразрушающий `--contract-probe`;
3. возвращать JSON evidence по `evidence.schema.json`;
4. иметь тесты основного, ошибочного и повторного пути;
5. получить ADR и пройти ручной review до установки
   `automation.state = "configured"`.

Файлы `tests/contracts/test_*_contract.py` выполняют configured
implementation-specific evidence scenario без подключения к live target.
Readiness запускает их по одному, но никогда сам не запускает deploy, restore
или другую рабочую операцию.

При запуске такого теста readiness задаёт:

- `FOUNDATION_CONTRACT_OPERATION` — точную проверяемую операцию;
- `FOUNDATION_CONTRACT_EVIDENCE_PATH` — уникальный временный путь;
- `FOUNDATION_CONTRACT_RUN_ID` — непредсказуемый идентификатор именно этого
  запуска.

Тест обязан выполнить обычный вход адаптера на изолированном target и записать
по этому пути один JSON-объект evidence со статусом `passed` и точным `run_id`
из `FOUNDATION_CONTRACT_RUN_ID`. Readiness требует как минимум один реально
выполненный unittest, не принимает `skipped`, `expected failure` или
`unexpected success` и повторно валидирует evidence по operation-specific
контракту. Пустой либо формально зелёный тест без evidence, а также старый
статический evidence от другого запуска не подтверждают готовность.

Implementation-specific тест и адаптер входят в доверенную инженерную границу:
как и любой CI, статический gate не может отличить намеренно сфабрикованное
evidence от честного теста, если проверяющий код сознательно подменён. Поэтому
переход в `configured` требует review теста: он должен вызывать обычный вход
адаптера, сверять фактические артефакты/эффекты и не использовать статический
sample payload как доказательство выполнения.

Уникальный `run_id` защищает от случайного повторного использования старого
файла, но не является защитой от намеренно вредоносного тестового кода внутри
доверенной границы.

Сырые evidence и runtime-логи хранятся в `.evidence/`, исключённом из Git.
Санитизированные результаты переносятся в журнал релиза.

## Manifest происхождения шаблона

Файл `.template-manifest.json` создаётся bootstrap-процессом и является
**provenance snapshot**: он фиксирует версию шаблона, исходный набор файлов и их
SHA-256 на момент генерации проекта. Repository check проверяет схему manifest,
безопасность путей, формат SHA-256 и наличие baseline-записей.

Это не current integrity gate: хеши намеренно не сравниваются с текущим
содержимым файлов, потому что после bootstrap проект должен изменяться обычными
Git-коммитами. Текущее состояние и аудит обеспечиваются Git, repository
contract и проверками, а не неизменностью шаблонных хешей.

- [Backup](adapters/backup.md)
- [Deploy](adapters/deploy.md)
- [Restore](adapters/restore.md)
- [Validation](adapters/validation.md)
