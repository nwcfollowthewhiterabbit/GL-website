# Incident runbook

## Первые действия

1. Не менять ERP data.
2. Зафиксировать время, URL, commit SHA и container status.
3. Проверить `/health`, web/api containers и последние API logs.
4. Выполнить targeted smoke без вывода secrets.
5. Если regression связан с новым release, выбрать последний проверенный website
   commit и выполнить controlled rollback.

## Классы

- **Site unavailable**: web/api status, Nginx, health, host resources.
- **Catalog/account data unavailable**: ERP connectivity and permissions; не
  изменять ERP до подтверждения причины.
- **Customer data exposure**: немедленно отключить account login, сохранить
  evidence, не публиковать персональные данные.
- **Payment uncertainty**: отключить payment creation, проверить provider result
  server-side; не повторять ERP effect вручную без reconciliation.

## Завершение

Incident закрывается после исправления source-of-truth, public validation и
краткой записи причины, impact, fix и prevention. Testing contact owner:
Green Leaf Pacific project team.
