# Контракт restore

- По умолчанию создавать только план без мутаций.
- План фиксирует target, backup manifest/checksum, ожидаемую release identity и
  ограниченный по времени confirmation token.
- Выполнение требует точного совпадения плана и явного подтверждения.
- Production требует approval reference и maintenance mode.
- До перезаписи сохраняется диагностический backup текущего состояния, если это
  технически возможно.
- После restore обязательны instance/domain/smoke проверки.
- После открытия новых бизнес-операций слепой возврат старой БД запрещён без
  согласованного reconciliation/replay.
