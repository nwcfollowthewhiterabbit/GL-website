# Инварианты

1. ERPNext остается master для SKU, price, stock, Customer и sales documents.
2. Website quote id не создает более одного Quotation.
3. Customer account не возвращает document вне разрешенных Customer links.
4. Неверный login не раскрывает существование email.
5. Password хранится только как salted `scrypt` hash.
6. Cardholder data никогда не проходит через website backend.
7. Payment amount, currency и ERP reference фиксируются до HPP redirect.
8. Повторный verified callback не создает второй ERP payment effect.
9. Payment/indexing выключены по умолчанию до явного approval.
10. Website deploy не изменяет ERP runtime.
