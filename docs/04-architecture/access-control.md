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
- Session подписана отдельным secret и передается secure cookie.
- Email Customer должен совпасть с разрешенной Contact/Customer link.

## Backend enforcement

UI не является границей доступа. Проверки повторяются для:

- account session endpoint;
- quotation/order/invoice list;
- document detail by name;
- admin and sync endpoints;
- payment session creation;
- ERP write operations.

Прямой URL или измененный request не должен расширять customer scope.
