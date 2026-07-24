# Текущий scope

- Этап: testing и payment UAT readiness
- Последнее обновление: 2026-07-24
- Владелец приемки: Green Leaf Pacific project team

## Входит в текущий этап

- ERPNext-backed каталог, поиск, цены, остатки и изображения.
- Basket -> draft ERPNext Quotation.
- Личный кабинет с password login и customer-scoped документами.
- ERP-managed storefront content.
- Westpac/Windcave website compliance и подготовка HPP.
- Неиндексируемое testing-окружение.
- Воспроизводимые repository, CI, smoke и browser checks.

## Реализовано и проверено

- Production build, account tests и Windcave adapter tests.
- Smoke checks публичных API, security headers и защищенных маршрутов.
- Visual smoke на ширинах 390 и 1440 px.
- Тестовый Customer видит связанные quotations и sales order.
- Password хранится как `scrypt` hash; сессия использует signed `HttpOnly`,
  `Secure`, `SameSite=Lax` cookie.
- Card-entry flow изолирован в Windcave HPP; payment activation выключен.

## Текущие блокеры платежного этапа

- Windcave UAT username и API key.
- Подтверждение ERPNext документа и итоговой суммы для HPP session.
- UAT 3-D Secure и callback/notification test.
- Решение по refund process и записи Payment Entry.

## Вне текущего этапа

- Production payment activation.
- Самостоятельная регистрация клиента.
- Замена или модернизация ERPNext.
- Backup ERP данных в рамках website release.

## Критерии перехода

1. UAT credentials установлены только в server environment.
2. HPP session создается из разрешенного payable ERP document.
3. Approved, declined, cancelled и повторный callback проверены.
4. ERPNext получает один подтвержденный payment result без дублей.
5. Smoke и visual checks проходят для точного deployed commit.
6. Green Leaf Pacific принимает пользовательский сценарий.

## Остаточный риск

Runtime adapters foundation пока остаются в состоянии `scaffold`; автоматический
release gate намеренно не считает backup/deploy/restore настроенными.
