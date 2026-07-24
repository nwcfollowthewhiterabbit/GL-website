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
2. Подтвердить реализованный payable mode:
   submitted Sales Invoice, current `outstanding_amount`.
3. Заполнить Payment Entry mode/account mapping.
4. Активировать UAT flags.
5. Пройти HPP/3DS callback и duplicate-notification scenarios.
6. Подтвердить созданный Payment Entry и обновить evidence/release record.

## 4. Production readiness

Статус: testing automation configured.

- Провести controlled restore drill.
- Настроить внешний alert webhook и on-call recipient.
- Сохранить runtime evidence для каждого deployment.
