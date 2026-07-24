# Контроль доступа

| Роль | Публичный catalog | Свои документы | Чужие документы | Admin API | ERP content |
|---|---:|---:|---:|---:|---:|
| Anonymous | да | нет | нет | нет | нет |
| Customer | да | да | нет | нет | нет |
| Website administrator | да | по admin process | по admin process | да | разрешенные DocTypes |
| Integration service | API only | scoped operations | только необходимый integration scope | service token | минимальные ERP permissions |
| Deployment operator | read-only public checks | нет | нет | нет | не изменяет ERP |

## Customer authentication

- Существующим ERP Customer password назначается через защищенный admin API.
- Хранится только `scrypt` hash и salt.
- Login error не подтверждает существование email.
- Session подписана отдельным secret, содержит credential version и передается
  secure cookie.
- Password reset, disable и enable увеличивают credential version; все ранее
  выданные cookie после этого отклоняются.
- Email Customer должен совпасть с разрешенной Contact/Customer link.

## Customer lifecycle

- `POST /api/admin/customer-access/link` связывает существующего Customer с
  Contact/User, но не создает пароль.
- `POST /api/admin/customer-access/password` устанавливает или сбрасывает пароль,
  включает доступ и отзывает старые сессии.
- `POST /api/admin/customer-access/disable` выключает User/credential и отзывает
  старые сессии.
- `POST /api/admin/customer-access/enable` повторно включает существующий
  credential без смены пароля и также отзывает старые сессии.
- Все admin endpoints защищены `ADMIN_API_TOKEN` и rate limit.
- Self-registration и self-service password recovery не активируются до
  согласования email verification/delivery процесса.

## Backend enforcement

UI не является границей доступа. Проверки повторяются для:

- account session endpoint;
- quotation/order/invoice list;
- document detail by name;
- admin and sync endpoints;
- payment session creation;
- ERP write operations.

Прямой URL или измененный request не должен расширять customer scope.
