# Перенос слоя сайта на текущую ERP

Владелец 2026-11-17 разрешил проверку на свежей копии production, затем перенос
ERP-слоя и запуск нового сайта при успешной приёмке. Это отдельная ERP-операция:
обычные website backup/deploy по-прежнему не включают ERP базу и файлы.

## Что переносится

`erpnext/app/greenleaf_website` устанавливается штатно в текущий v16 image.
Скрипт `scripts/erpnext-preserve-website.py` переносит только шесть родительских
Website DocType и их дочерние связи; пакет определяет семь DocType и 19 полей.
Документы Customer/Quotation, пользователи, секреты, credential/payment tables,
DB grants и ERP файлы в этот экспорт не входят. Для них нужны отдельные backup,
изолированная конфигурация и создание таблиц штатным website migration runner.
Тестовые логины и документы в production не импортируются.

Скрипт сохраняет все явно заданные website-поля Item/Item Group, включая `0` и
пустую строку. Исходный `NULL` означает отсутствие переопределения: значение
на свежей базе наследует штатный default. Количество таких NULL фиксируется.
Никакие другие поля существующих Item/Item Group не изменяются; modified не
перезаписывается и внешние document hooks не запускаются для этой узкой операции.

## Последовательность

Сначала сохранить и проверить отдельный protected backup старой testing,
production DB/files и конфигурации. Затем создать новый изолированный стенд на
текущем production image. До запуска workers отключить почту, scheduled reports,
WooCommerce и другие внешние интеграции. Не восстанавливать v16 DB в v14 runtime.

Все команды ниже выполняются bench Python внутри точно проверенного backend.
`--expect-database-host` — значение `SELECT @@hostname`, а не одинаковое у этих
стендов имя site. `--schema-root` указывает на каталог `erpnext` этого release.
Каждому запуску нужен новый output path; существующий файл не перезаписывается.

1. На старой testing выполнить `--action export --output /protected/bundle.json`.
   Экспорт read-only, файл mode 0600. Проверить checksum и числа записей.
2. На новом target выполнить `--action schema --output /protected/schema.json`.
   Любой конфликт блокирует native install. Затем установить reviewed app через
   `bench --site <site> install-app greenleaf_website` и `bench --site <site> migrate`.
   Не запускать synthetic bootstrap и старые seed-скрипты.
3. Выполнить план (это default action):

```text
python scripts/erpnext-preserve-website.py --site <site> --sites-path <sites> \
  --schema-root <release>/erpnext --expect-database-host <db-hostname> \
  --bundle /protected/bundle.json \
  --mapping <release>/erpnext/migrations/20261117-category-mapping.json \
  --output /protected/plan.json
```

4. Проверить отсутствие conflicts/missing_links. Для согласованного плана добавить
   `--action apply --expect-plan-sha256 <plan.sha256>` и новый output path.
   Apply заново строит план под блокировками строк и проверяет hash до записи.
   Отсутствующие Website документы создаются native insert; совпавшие пропускаются;
   отличающиеся не заменяются. Любая ошибка до commit откатывает транзакцию.
   Prepared receipt не означает commit; требуется отдельный `.committed.json`
   и последующая read-only проверка.
5. Повторный plan должен содержать только equal records, ноль insert/field_updates,
   conflicts и missing_links. Проверить сайт и customer-scoped сценарии отдельно.

Коррекция категорий записана в `20261117-category-mapping.json`: plural Furniture
and fitouts соответствует действующей Furniture and fitout с прежними дочерними
группами; отсутствующая и в старой testing Commercial kitchen equipment удаляется
только из меню. Kitchen уже покрывает этот раздел. 64 связи превращаются в 63;
ни один ERP Item Group не создаётся и не удаляется.

## Website Control Center

На каждом ERP site задаются отдельно:

- `website_public_url`: HTTPS origin публичного сайта;
- `website_api_url`: внутренний origin API, например `http://website-api:3001`;
- `website_admin_api_token`: тот же защищённый server-only token, что у website API.

В boot передаётся только публичный URL и доступность customer panel. Customer
panel доступна System Manager и обращается к узкому ERP server proxy; bearer
credential не передаётся браузеру. Proxy допускает только list/link/disable,
POST для изменений и не следует redirect. Обычные Website content формы
продолжают использовать native ERP permissions. Без конфигурации нет fallback
на testing/localhost; соответствующие действия скрыты или отключены.

Production переносит тот же проверенный release и согласованный website overlay.
Сначала конфигурация/миграции/права, затем приёмка и переключение routes. Payments
остаются выключены. Откат отключает новый writer и возвращает прежний route/image,
но не затирает новые ERP business documents полной старой базой.
