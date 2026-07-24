# Тестовые данные и очистка

- Run-specific prefix: `GL-WEB-E2E-<RUN_ID>`.
- Permanent synthetic login fixture:
  `customer-demo@example.com` / `Green Leaf Website Test Customer`.
- Password не хранится в Git, docs или server `.env`; он передается только
  seed/admin operation.
- Temporary quotations, orders, payment sessions и callbacks удаляются или
  отменяются после проверки.
- Permanent fixture documents должны иметь явный marker и не использоваться для
  финансовой отчетности.
- Проверка customer isolation использует два разных Customer identities; второй
  Customer document не должен открываться первой сессией.
- Card testing использует только Windcave UAT test values на hosted page.
