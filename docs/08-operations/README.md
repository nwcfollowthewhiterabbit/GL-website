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

Repository foundation установлен, но runtime adapters остаются fail-closed.
Это сознательно блокирует автоматическое утверждение production readiness до
реализации contract-tested website backup, deploy, restore и validation.
