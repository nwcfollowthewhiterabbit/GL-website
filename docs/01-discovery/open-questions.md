# Открытые вопросы

## Блокируют payment UAT

1. Какие Windcave UAT username и API key назначены merchant?
2. Подтверждает ли команда реализованный payable source: submitted Sales
   Invoice и его текущий `outstanding_amount`?
3. Гарантирует ли Sales Invoice, что VAT, delivery и deposit уже отражены до
   HPP session?
4. Какие ERPNext mode-of-payment, receivable и Windcave clearing accounts
   использовать для Payment Entry?

## Блокируют подписание PCI SAQ A-EP

1. Westpac сообщил, что Windcave покрывает vulnerability scanning при HPP, но
   присланный Westpac SAQ A-EP v4.0.1 требует в пункте 11.3.2 passing external
   scan от PCI SSC Approved Scanning Vendor не реже одного раза в три месяца.
   Перед заполнением Requirement 11 обязательно напомнить об этом расхождении
   и получить письменное указание Westpac: кто выполняет merchant-side ASV
   scan и какое evidence должно быть приложено.
2. Подтверждает ли Westpac, что именно SAQ A-EP, а не SAQ A, является
   обязательной формой для финального Windcave HPP redirect?
3. Кто является merchant executive signatory и официальным PCI contact?
4. Какие hosting, development/operations и другие TPSP входят в assessment
   scope, и получены ли их актуальные PCI compliance подтверждения?

## Можно уточнить на техническом этапе

1. Refund выполняется только в Windcave portal или через API сайта?
2. Какие test cards и 3-D Secure scenarios обязательны для UAT sign-off?
3. Нужен ли отдельный customer-facing payment receipt кроме ERP invoice?

## Backlog, не блокирует текущую итерацию

1. Self-registration и email verification.
2. Self-service customer password recovery.
3. Customer-group price lists после входа.
4. Multiple product images.
5. Точные permissions роли Website Content Manager.

Ответ переносится в
[confirmed requirements](confirmed-requirements.md), а долговременное
техническое решение оформляется ADR.
