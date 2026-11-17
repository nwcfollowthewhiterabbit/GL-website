# Текущий scope

- Этап: новый сайт только на testing domain, подключённый к production ERP.
- Последнее уточнение владельца: 2026-11-17.
- Основной `greenleafpacific.com` остаётся прежним OpenCart сайтом.
- `testing.greenleafpacific.com` — новый ERP-backed сайт, noindex, реальные production ERP данные.
- `testing.erp.greenleafpacific.com` — отдельная свежая изолированная ERP-копия для тестового бота.

## Разрешённый сценарий

Каталог, поиск, актуальные цены/остатки/изображения, basket → draft Quotation и
customer account работают на testing website. Его integration
обращается к production ERP; слово testing в hostname не означает sandbox данных.
Production ERP Website Control Center управляет этим новым сайтом.

Native integration создаёт Customer/Contact и draft Quotation, но не получает
Submit/Cancel, создание Sales Invoice/Payment Entry или финансовое проведение.
Новый запрос владельца 2026-11-17 включает самостоятельную регистрацию с
подтверждением email, восстановление пароля, basket → запрос котировки и
кабинет со статусами и полной постраничной историей. Реализация активируется
после проверки релиза на этом же testing hostname. Основной домен не меняется.
Payments и payment ERP writes остаются выключенными.
Персонализированные цены не реализованы; baseline — Standard Selling/FJD.
Просматривать каталог и собирать корзину можно без входа; отправка требует
подтверждённой учётной записи. Запрос создаёт только draft Quotation; Sales Order
оформляет sales в ERP, после чего клиент видит его и текущий статус в кабинете.

Website ERP app/content overlay установлен отдельно в production и свежую
изолированную копию. Это не замена ERP core. Старые testing документы/credentials
и OpenCart orders в production ERP не импортировались.

Основной домен был временно переключён во время выполнения и возвращён по
уточнению владельца. История и финальная проверка целевых адресов записаны в
[release record](../08-operations/releases/2026-11-17-testing-site-production-erp.md).
Повторное переключение основного домена требует отдельного прямого разрешения.

## Отдельные будущие этапы

- Windcave UAT credentials, payable-document/amount contract, 3-D Secure и callback tests;
  затем отдельная приёмка перед payment activation.
- Перенос legacy deploy/backup/restore adapters на новые stack bindings.
- Controlled restore drill и настройка внешнего alert recipient.
- Dependency maintenance для оставшихся audit advisories.
- ERP/EPS guard для Customer deletion: правило New может срабатывать через on_change;
  cleanup этого запуска удаляет только точные synthetic side effects.
