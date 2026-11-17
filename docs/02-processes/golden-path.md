# Golden paths

## Catalog to quotation

```text
ERP-visible item
-> customer adds quantity to Order basket
-> customer registers/verifies email or signs in (basket persists)
-> API validates customer and SKU lines
-> API resolves ERP price and idempotency marker
-> draft Quotation is created once
-> customer receives reference
-> sales verifies the document in ERPNext
```

Ошибка отсутствующего SKU возвращается явно. Повтор с тем же website quote id
не должен создавать второй Quotation.

## Customer account

```text
verified self-registered customer or existing ERP Customer with assigned website password
-> customer signs in
-> backend verifies scrypt hash
-> signed secure cookie is issued
-> email resolves allowed ERP Customer links
-> orders/quotations/invoices are filtered by those links
-> customer opens a document and sees customer-friendly status
-> customer loads older history pages when needed
```

Неверный пароль возвращает одинаковую ошибку без раскрытия существования email.
Прямой URL другого customer document должен вернуть отказ.

## Email registration and recovery

```text
email request -> generic response -> single-use30-minute mailbox link
-> customer chooses password after opening link
-> registration creates one credential and links/creates native Customer
OR reset changes password and revokes previous sessions
```

Ссылка хранится в URL fragment, очищается из адреса после чтения и не попадает
в request/access logs. Повтор, истёкшая ссылка, отключённый доступ и конфликт
версии credential отклоняются. Перезапрос ограничен по email и IP. Владелец
почты с активным ERP System User также может создать отдельный website account;
пароль и роли ERP User не меняются. Повторный submit не создаёт дубль.

## Windcave HPP

```text
eligible payable ERP document
-> backend fixes amount/currency/reference
-> Windcave session is created server-side
-> customer is redirected to hosted card page
-> Windcave returns and sends notification
-> backend verifies provider result
-> one payment result is recorded in ERPNext
-> customer sees approved/declined/cancelled state
```

До подтверждения payable document и UAT credentials этот процесс остается
выключенным.

## Testing deployment

```text
clean tested commit
-> push to main
-> CI for exact SHA
-> website-only backup/rollback point
-> remote fast-forward pull
-> Docker image build
-> container restart
-> public smoke and visual checks
-> runtime SHA and status recorded
```

ERP stack не является target этой операции.
