# Контракт deploy

## Первый экземпляр

- Read-only проверками доказать отсутствие на точном target экземпляра, данных,
  конфигурации, пользовательских файлов и иного состояния.
- При доказанной пустоте отметить backup
  `N/A — target proven empty` и сохранить ссылку на evidence проверки.
- Отказаться от работы при любом существующем или неясном состоянии; такой
  target обслуживается только сценарием update с проверенным backup.
- Использовать чистый source commit и immutable artifact/digest.
- Выполнить install/migrate/setup и обязательные проверки.
- В passed evidence сохранить ссылку на результат проверки пустого target,
  отметку backup `N/A`, release artifact и проверенный rollback-путь.

## Обновление

- До первой мутации автоматически создать и проверить backup.
- Записать previous release, новый artifact и rollback reference.
- Остановиться при ошибке backup, migrate, setup или validation.
- Проверить идемпотентный повтор setup/migrate.

Оба сценария проверяют точное имя target и внешний endpoint. Перезапуск runtime
не считается deploy.
