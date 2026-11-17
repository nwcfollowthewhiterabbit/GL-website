# Эксплуатация

Новый публичный testing website с production ERP и private rehearsal/testing ERP
работают в отдельных Compose projects. Основной сайт остаётся OpenCart. ERPNext — отдельная operational dependency; обычный website deploy/backup
не включает ERP migrate, business data или files. Website ERP overlay прошёл
отдельную authorisation и native migration при запуске 2026-11-17.

## Документы

- [Окружения](environments.md)
- [Deployment](deployment.md)
- [Backup и restore](backup-and-restore.md)
- [Операционные имена](operational-names.md)
- [Наблюдаемость](observability.md)
- [Incident runbook](incident-runbook.md)
- [Release checklist](release-checklist.md)
- [Release log](releases.md)
- [Website ERP overlay](website-overlay-preservation.md)

## Automation state

У обоих активных stacks есть monitor service с локальными structured logs.
External alert webhook не настроен. Legacy runtime adapters по-прежнему связаны
со старым сохранённым testing target; они не управляют новыми active stacks.
Porting adapters и controlled restore drill остаются отдельными работами.
