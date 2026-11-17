# Подтвержденные требования

## Storefront

- ERPNext является источником item, item group, price, stock и customer data.
- Публичные цены отображаются в FJD без VAT.
- Товары без валидного изображения, цены или описания не публикуются согласно
  storefront rules.
- Запрос с сайта создает draft ERPNext Quotation и защищен от дублей.
- Индексация testing URL выключена.

## Customer account

- Существующий или созданный backend-клиент входит по email и паролю.
- Self-registration начинается с email; одноразовая ссылка подтверждает владение
  почтой до ввода пароля и создания Customer/credential. Старые ERP Customer и
  Contact связи переиспользуются; чужие документы недоступны.
- Self-service reset использует отдельную одноразовую ссылку; смена пароля
  отзывает старые сессии и не включает отключённый доступ.
- Клиент видит только документы связанных с ним ERP Customer records.
- В кабинете доступны orders, quotations, invoices и customer-friendly status.
- История загружается страницами, а детали показывают фактический статус ERP.
- Каталог/корзина доступны гостю, отправка котировки — только вошедшему клиенту.
- API связывает заявку с проверенным email и Customer текущего credential;
  подмена email отклоняется. Невалидная корзина не создаёт частичную котировку.
- Релиз без онлайн-оплаты: отправка создаёт только draft Quotation, окончательные
  цены, наличие и доставка подтверждаются sales. Создание заказа — штатный ERP процесс.
- Session cookie: signed, `HttpOnly`, `Secure`, `SameSite=Lax`.

## Payments

- Провайдер: Windcave.
- Метод: Hosted Payment Page; cardholder data остается у Windcave.
- Карты: Visa, Mastercard, American Express.
- Валюта transaction/settlement: FJD.
- Westpac прислал для заполнения PCI DSS v4.0.1 SAQ A-EP для Windcave HPP.
  Требование 11.3.2 по merchant-side ASV scanning требует отдельного
  письменного согласования с Westpac до подписания анкеты.
- Testing URL допускается для Westpac review.
- Payment остается выключенным до UAT credentials и проверки callback flow.

## Operations

- Source of truth: GitHub repository, branch `main`.
- Website runtime отделен от ERP stack.
- Website deploy не должен менять или включать backup ERP.
- После frontend/runtime изменения обязательны соответствующие unit, build,
  smoke и visual checks.
