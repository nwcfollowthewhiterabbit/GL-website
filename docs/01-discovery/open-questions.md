# Открытые вопросы

## Блокируют payment UAT

1. Какие Windcave UAT username и API key назначены merchant?
2. Какой ERPNext document является payable source: Sales Order, Sales Invoice
   или отдельная payment request?
3. Где окончательно рассчитываются VAT, delivery и deposit перед HPP session?
4. Какие поля и reference должны записываться в ERPNext Payment Entry?

## Можно уточнить на техническом этапе

1. Refund выполняется только в Windcave portal или через API сайта?
2. Какие test cards и 3-D Secure scenarios обязательны для UAT sign-off?
3. Нужен ли отдельный customer-facing payment receipt кроме ERP invoice?

## Backlog, не блокирует текущую итерацию

1. Self-registration и email verification.
2. Customer password reset.
3. Customer-group price lists после входа.
4. Multiple product images.
5. Точные permissions роли Website Content Manager.

Ответ переносится в
[confirmed requirements](confirmed-requirements.md), а долговременное
техническое решение оформляется ADR.
