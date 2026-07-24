# Журнал изменений

Значимые изменения описываются через пользовательский или эксплуатационный
результат.

## Unreleased

### Added

- Инженерная основа проекта: каноническая документация, repository contract,
  security checks, runtime adapter contracts и CI.
- Личный кабинет клиента с входом по email и паролю и документами ERPNext.
- Подготовленный серверный адаптер Windcave Hosted Payment Page.

### Changed

- Страница личного кабинета отделена от витринных промоблоков и каталога.
- CI проверяет Python-контракт репозитория, TypeScript, account/payment tests и
  production build.

### Known limitations

- Windcave остается выключенным до получения UAT credentials и подтверждения
  документа ERPNext, формирующего сумму платежа.
- Автоматизация backup/deploy/restore остается fail-closed до реализации и
  contract tests; `automation.state` остается `scaffold`.
- Самостоятельная регистрация клиента пока не реализована.
