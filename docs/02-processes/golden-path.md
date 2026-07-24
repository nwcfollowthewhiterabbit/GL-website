# Golden paths

## Catalog to quotation

```text
ERP-visible item
-> customer adds quantity to Order basket
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
existing ERP Customer with assigned website password
-> customer signs in
-> backend verifies scrypt hash
-> signed secure cookie is issued
-> email resolves allowed ERP Customer links
-> orders/quotations/invoices are filtered by those links
-> customer opens a document and sees customer-friendly status
```

Неверный пароль возвращает одинаковую ошибку без раскрытия существования email.
Прямой URL другого customer document должен вернуть отказ.

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
