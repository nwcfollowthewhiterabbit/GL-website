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
- При выходе API отзывает конкретную сессию в общей для экземпляров API таблице. Другие браузеры сохраняют свои сессии. При недоступности хранилища клиент получает ошибку и может повторить выход.
- Password reset, disable и enable увеличивают credential version; все ранее
  выданные cookie после этого отклоняются.
- Email должен совпасть с Customer или связанным Contact. Отдельный Frappe
  Website User поддерживается, но не требуется для Customer, созданного через
  backend.

## Customer lifecycle

- `POST /api/admin/customer-access/link` проверяет существующую связь email с
  Customer/Contact, но не создает ERP-записи и пароль.
- `POST /api/admin/customer-access/password` устанавливает или сбрасывает пароль,
  включает доступ и отзывает старые сессии.
- `POST /api/admin/customer-access/disable` выключает website credential и
  отзывает старые сессии, не изменяя ERP User.
- `POST /api/admin/customer-access/enable` повторно включает существующий
  credential без смены пароля и также отзывает старые сессии.
- Все admin endpoints защищены `ADMIN_API_TOKEN` и rate limit.
- Self-registration и recovery используют email-first single-use challenge.
  Registration не перезаписывает credential; reset не включает disabled access.
  Password вводится только после mailbox link. Challenge хранит SHA-256 token,
  срок и использованность; reset связан с версией credential.
  IP и durable per-email throttles ограничивают отправку. SendGrid sender —
  существующий Sales Team; секрет доступен только backend через protected env.
  Isolated test outbox допускается только при explicit test environment.
- Активный ERP System User может подтвердить почту и создать отдельный website
  credential. Регистрация/reset не меняют ERP User, `__Auth` или роли; доступ
  остаётся ограничен проверенными Customer/Contact links. Отключённый ERP User
  и отключённый website credential не получают доступ через self-service.
- Quote creation требует verified session и использует Customer credential,
  а не присланное браузером имя Customer. Изменённый email отклоняется.

Credential и payment event tables создаются не request-кодом, а
`api/migrations/runner.mjs`. Migration ids/checksums записываются в
`tabGL Website Schema Migration`; изменившаяся уже примененная migration
блокирует API startup.

## Backend enforcement

UI не является границей доступа. Проверки повторяются для:

- account session endpoint;
- quotation/order/invoice list;
- document detail by name;
- admin and sync endpoints;
- payment session creation;
- ERP write operations.

Прямой URL или измененный request не должен расширять customer scope.

## ERP Website Control Center

ERP System Manager может выполнять только list/link/disable через
`greenleaf_website.control_center.customer_access`. Proxy проверяет роль и POST
для изменений, использует отдельный внутренний API URL и server-only admin token.
В boot нет token или внутреннего URL. Site config не принимает arbitrary path,
query, userinfo или redirect. Браузер не обращается к protected website admin
API напрямую. Остальные ERP роли управляют content только через штатные формы и
DocType permissions; видимость Page не добавляет им customer-admin права.
