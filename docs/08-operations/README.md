# Эксплуатация

Testing website работает в отдельном Docker Compose stack. ERPNext является
external operational dependency и не входит в website deploy/backup.

## Документы

- [Окружения](environments.md)
- [Deployment](deployment.md)
- [Backup и restore](backup-and-restore.md)
- [Операционные имена](operational-names.md)
- [Наблюдаемость](observability.md)
- [Incident runbook](incident-runbook.md)
- [Release checklist](release-checklist.md)
- [Release log](releases.md)

## Automation state

Testing runtime adapters настроены и остаются fail-closed по target, SHA,
backup и confirmation preconditions. Production target не настроен.
