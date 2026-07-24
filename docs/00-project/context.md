# Контекст проекта

## Паспорт

- Проект: `Green Leaf Pacific Website`
- Репозиторий: `nwcfollowthewhiterabbit/GL-website`
- Основная ветка: `main`
- Этап: testing и готовность к Windcave UAT
- Пользовательский интерфейс: английский
- Внутренняя документация: русский
- Владелец приемки: Green Leaf Pacific project team

## Задача

Сайт должен дать B2B-клиенту Green Leaf Pacific понятный каталог, оформление
запроса/заказа и доступ к своим документам, сохраняя ERPNext операционным
источником товаров, цен, остатков, клиентов и продаж.

Платежи должны проходить через Windcave Hosted Payment Page: сайт не собирает и
не хранит реквизиты карт.

## Компоненты

- React/Vite storefront;
- Node.js integration API;
- Nginx;
- Docker Compose;
- ERPNext как источник каталога и клиентских документов;
- Windcave HPP как подтвержденный Westpac платежный провайдер;
- testing runtime на `testing.greenleafpacific.com`.

## Роли

- **Customer**: просматривает каталог и только свои quotations, orders и
  invoices.
- **Sales / website administrator**: управляет каталогом и storefront content
  через ERPNext, назначает доступ существующим клиентам.
- **Integration service**: читает разрешенные данные ERPNext и создает
  поддерживаемые документы.
- **Deployment operator**: публикует проверенный commit в отдельный website
  stack на testing-сервере.

## Ограничения

- Не изменять ERP runtime в рамках обычного website deploy.
- Не включать индексацию до отдельного решения о запуске.
- Не включать Windcave до UAT credentials и проверки платежного golden path.
- Не хранить environment values и cardholder data в Git или логах.
- Внешний вид testing-сайта является визуальным baseline, если задача явно не
  меняет дизайн.

## Критерий ценности этапа

Проверенный на mobile и desktop testing-сайт показывает актуальный ERP-каталог,
создает корректный draft quotation, изолирует документы клиента и готов принять
Windcave UAT credentials без изменения архитектуры card-data flow.
