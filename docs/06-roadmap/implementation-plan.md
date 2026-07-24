# План реализации

## 1. Repository foundation

Статус: внедрено.

- Каноническая документация и AGENTS policy.
- Repository/security contract.
- Node + Python CI.
- Fail-closed runtime adapter contracts.

## 2. Customer account

Статус: testing.

- Password login для existing/backend-created Customer.
- Customer-scoped lists/details.
- Orders, quotations, invoices и status translation.
- Admin-managed password reset, enable/disable и немедленный session revocation.
- Следом: self-service recovery и self-registration/email verification после
  выбора почтового канала.

## 3. Payment UAT

Статус: ожидает входных данных.

1. Получить Windcave UAT credentials.
2. Выбрать payable ERP document.
3. Зафиксировать VAT/delivery/deposit calculation.
4. Реализовать ERP payment result write.
5. Пройти HPP/3DS callback и duplicate-notification scenarios.
6. Обновить user manual, evidence и release record.

## 4. Production readiness

Статус: не начато.

- Реализовать website backup/restore и update deploy adapters.
- Добавить instance/domain/MVP/UI validation adapters.
- Настроить observability и incident runbook.
- Перевести `automation.state` в `configured` только после contract tests.
