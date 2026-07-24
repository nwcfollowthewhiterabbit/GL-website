# Журнал изменений

Значимые изменения описываются через пользовательский или эксплуатационный
результат.

## Unreleased

### Added

- Инженерная основа проекта: каноническая документация, repository contract,
  security checks, runtime adapter contracts и CI.
- Личный кабинет клиента с входом по email и паролю и документами ERPNext.
- Подготовленный серверный адаптер Windcave Hosted Payment Page.
- Управляемый lifecycle customer access: password reset, enable/disable и отзыв
  ранее выданных сессий.
- Диагностика источников storefront content и policy для ERP/static fallback.
- Contract tests для customer isolation, quote idempotency и Windcave
  notification verification.

### Changed

- Страница личного кабинета отделена от витринных промоблоков и каталога.
- Account state и storefront content loading вынесены из `App.tsx` в отдельные
  hooks; account/payment CSS разделен по модулям.
- CI проверяет Python-контракт репозитория, TypeScript, account/payment tests и
  production build.

### Known limitations

- Windcave остается выключенным до получения UAT credentials и подтверждения
  документа ERPNext, формирующего сумму платежа.
- Автоматизация backup/deploy/restore остается fail-closed до реализации и
  contract tests; `automation.state` остается `scaffold`.
- Самостоятельная регистрация клиента пока не реализована.
