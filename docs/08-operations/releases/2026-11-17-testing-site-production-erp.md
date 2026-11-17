# 2026-11-17 — Новый testing website → production ERP и изолированная v16 testing

Историческая запись первоначального подключения. Позднейшее требование
регистрации и customer quotation release описано [отдельно](2026-11-17-customer-quotation-release.md);
статусы self-registration и runtime pins ниже относятся к этому первоначальному запуску.

- Финальный scope: новый сайт только на testing.greenleafpacific.com, подключённый к production ERP; noindex/payments off.
- Основной greenleafpacific.com возвращён прежнему OpenCart по уточнению владельца.
- Решение: GO для исправленного testing-only target; final readiness и read-only browser passed.
- Владелец релиза: Green Leaf Pacific; выполнение по прямому разрешению владельца после staging acceptance.
- Владелец приёмки: Green Leaf Pacific project team.
- Source repository/branch: `nwcfollowthewhiterabbit/GL-website`, `main`.
- Website source: `dc3de1f58a1a5a74ebdf2572783a0917ef365921`.
- API/ERP source: `a80129165fb7e839d2eda362121947159eca4677`; API, ERP package, importer и ERP recipe Git objects идентичны в website commit.
- GitHub CI: [website run 44102793620](https://github.com/nwcfollowthewhiterabbit/GL-website/actions/runs/44102793620), [ERP release run 44097776297](https://github.com/nwcfollowthewhiterabbit/GL-website/actions/runs/44097776297), success.
- Последующая запись эксплуатационных фактов — docs-only; runtime images связаны с указанными source commits.

## Immutable artifacts и targets

| Artifact | Image SHA256 |
|---|---|
| Временный main-domain web artifact (не финальный public target) | `4974bb4d6e5264061c5a6fa24b1e68c4e37e35be53fa0962cd76375ba412fca3` |
| Финальный новый website / private rehearsal web (testing profile) | `8e4cb63b063871a2ef982a2e9fb183f7ec16bf10ef7afb788d00dfffa1952690` |
| API и monitor | `a8b0a5521c4ceb2787108008ddcb6556165e52eea2e97ef454fdc936fc1df74b` |
| ERP website overlay | `e57484298a13c99e527cf488c16893264dde2af85e7773f62ebd29de2e04478f` |

Новый testing website с production ERP: `cloud:/home/csrss/stacks/greenleaf-website-20261117`, project
`gl-website-production-20261117`. Private rehearsal / изолированная testing ERP: `cloud:/home/csrss/stacks/gl-website-stage-20261117`,
project `gl-web-stage-20261117`. Production ERP остаётся в `erp-next-20261005`,
project `gl-cutover-20261005`; все шесть code services используют точный ERP image.
Полные operational names и public aliases — в [environments](../environments.md).

## Backup, migration и сохранение данных

Protected prelaunch production/old-testing DB/files/config backups находятся в
`cloud:/home/csrss/backups/website-launch-20261117/`. На свежем isolated target
выполнено восстановление текущей production copy. Старые testing source/data
сохранены. Website overlay экспортирован read-only с физическим DB-host guard;
повторный экспорт перед production не обнаружил изменений содержимого/схемы.

В export hash входит время экспорта. После нормализации только `exported_at`
повторный bundle точно совпал с исходным
`ba6370968d415514898e6528951596622737b9f41197b639fa2421d737f128cb`.
Сырые timestamp/hash полей не выдаются за изменение content.

Перед native production mutation под `/run/greenleaf-stack-backup.lock` выполнены
maintenance/drain и новый verified logical DB dump + config preimage. Проверены
полный gzip CRC, ожидаемые CREATE TABLE schemas и dump completion marker; старые
backup sets не pruning-ились. Protected receipts:
`cloud:/home/csrss/stacks/erp-next-20261005/website-overlay-20261117T143114Z/`.

Native app install/migrate добавил 7 Website DocType и 19 custom fields. CAS import
создал 60 parent content rows и 63 child mappings; повторный план дал 60 equal,
0 insert/field updates/conflicts/missing links. Перенос не включал старые Customer,
Quotation, credentials или financial documents. Business counts и исходные
mail/report/notification/webhook/job flags до reopening совпали; maintenance/pause
восстановлены. Существующие Item/Item Group бизнес-поля не изменялись.

ERP runtime archive сохранён для нового immutable image, production backup producer
pins/guards согласованы с этим image. Проверка archive и восстановление staging
не объявляются отдельным production disaster-recovery drill.

## Проверки артефакта и ERP; исторический main-domain pass

- Required repository/readiness checks и 64 Python tests passed; exact website source также прошёл typecheck, integration contracts, production/testing profile tests и production build.
- На fresh v16 staging: 127 API checks и 47 published asset checks passed; native created-document values проверены. Проверены точные request IDs, конфликтующий replay, concurrent requests, отсутствие Customer при invalid SKU, gzip JSON rejection и права пользователей.
- Public testing: 49 readiness checks, mobile layout и test bot API auth passed.
- Production private origin: 46 readiness/TLS checks passed.
- Public production: 50 readiness checks и 10 account HTTPS checks passed.
- Реальный public browser: desktop/mobile390px, product→basket, quantity total, staff-provisioned account login, просмотр только своего draft quotation, Secure/HttpOnly/SameSite=Lax cookie и logout→401/cookie removal passed. Этот browser pass не создавал новых business documents.
- Production controlled canary проверил draft Quotation, Fiji transaction date `2026-11-18`, FJD236.16 и отказ доверять подставленной клиентом цене0.01; financial documents/outgoing test mail/Notification Logs не создавались.
- Native Website Control Center: System Manager list allowed; ordinary System User и Guest denied. Boot extension содержит только public URL и access flag, без private API URL/admin token.
- Service user's четыре Notification Settings flags выключены в stage/prod, без изменения глобальных уведомлений; exact staging energy-point side effects удалены.
- Controlled production canary cleanup committed15:07:40UTC: exact Quotation/Customer/Contact/credential removed; one synthetic Energy Point Log created by Customer deletion was removed afterwards. Financial document counts unchanged; controlled email recipients0. Evidence: acceptance/production-canary-cleanup.json.

## Временное переключение основного домена, TLS и исправление scope

В ходе выполнения основной домен был временно переключён. Apex A был изменён только с прежнего origin на новый cloud origin; Cloudflare proxy
и TTL auto сохранены, `www` CNAME не менялся. В этот временный период apex/health возвращали200,
`www` делал path/query-preserving308 на apex. Эти проверки — история временного
маршрута, а не утверждение о финальном основном сайте. Другие hosts Caddy не изменялись.

Старый OpenCart origin перед временным переключением получил scoped503/no-store, сохранив
автоматический ACME; freeze затем отменён точным rollback. Old-site counts при freeze не изменились. Его файлы/DB и
точные Caddy preimages сохранены; OpenCart orders в ERP не импортировались.

Во время временного main-domain cutover cloud Let's Encrypt lineage успешно обновлена; certificate
покрывает apex+www до `2027-02-15 13:59:43 UTC`. Проверены public и direct-origin
TLS, соответствие активного SNI certificate lineage, успешный реальный renewal
с deploy-hook reload и enabled/active existing timer. Временные импортированные
сертификаты были заменены штатной cloud lineage. После возврата apex DNS на старый
origin эта проверка НЕ доказывает возможность дальнейшего cloud renewal основного
домена: авторитетный main origin снова прежний Caddy с сохранённым automatic HTTPS.
Testing hostname использует свой прежний Caddy automatic HTTPS.

## Timeline UTC

| Время | Результат | Evidence |
|---|---|---|
| 14:10:25 | Fresh staging native overlay verified | staging ERP receipts/manifest.json |
| 14:25:08 | Exact UI source CI success | GitHub run44102793620 |
| 14:30:49 | Old testing content re-export unchanged | website-overlay-prelaunch-recheck-receipt.json |
| 14:42:05 | Native production overlay complete, six exact images/HTTP healthy | production overlay complete.json |
| 14:45:40 | Production backup image guards/pins updated | backup-prep/after-production-installed-receipt.json |
| 14:48:55 | Reserved production service notifications muted | website-service-notifications-muted.json |
| 14:55:17 | Production native proxy permissions/boot check passed | website-production-proxy-permission-check.json |
| 14:56:21 | Old origin scoped503 freeze | old-origin-freeze evidence |
| 14:56:48 | Public DNS readback confirms new apex origin | dns-cutover.json |
| 14:59:49 | Public/direct TLS and normal automatic renewal verified | tls-cutover final proofs |
| 15:03:14 | Historical temporary-main account/mobile/browser pass | public-production/browser.json |
| 15:07:40 | Exact production canary cleanup committed | acceptance/production-canary-cleanup.json |
| 15:10:37 | Main DNS restored to old origin after owner correction | owner-scope-correction evidence |
| 15:11:34 | Public apex+www verified old OpenCart200 with valid TLS | owner-scope-correction/public-oldsite-restored.json |
| 15:12:53 | Testing website route now points to production-ERP website stack | testing-production-crm-applied.json |
| 15:13:30 | Clone preview blank; production ERP preview points to testing website | scope-correction/boot-verification.json |
| 15:14:50 | Corrected testing-origin readiness49/49 passed | corrected-testing/readiness.json |
| 15:21:45 | Corrected testing browser/no-write pass; main OpenCart independently verified | corrected-testing/browser.json; main-oldsite.json |

## Evidence locations

Sanitized orchestration evidence is retained in the workspace
`output/website-launch-20261117/`: `release-package/`, `acceptance/staging/`,
`acceptance/public-production/` (historical), `acceptance/corrected-testing/`,
`owner-scope-correction/`, `tls-cutover/`, `old-origin-freeze/`,
`backup-prep/` and `dns-cutover.json`. Protected target-native receipts are retained
beside the corresponding server operation. Credentials, cookies, private keys,
site config contents and environment values are not part of this release record.

## Финальная маршрутизация и ограничения

Основной домен был временно переключён с14:56:47 до15:10:36UTC; это действие
отменено по уточнению владельца. Readback15:10:37 подтвердил возврат apex A на
`139.99.155.122`; public apex иwww снова отдают прежний OpenCart200. Cloud main
routes также возвращены к исходному backend. Основной сайт не является новым
website target.

С15:12:53 новый сайт опубликован только на `https://testing.greenleafpacific.com`
через loopback18594 с testing web image/noindex, testing STORE_PUBLIC_URL/CORS и
production ERP integration. Изолированная ERP-копия/bot остаётся отдельно;
её public preview URL очищен, чтобы не создавать впечатления, что изменения в
копии редактируют новый сайт с production данными. Private rehearsal API сохранён.
Final corrected-origin acceptance: 49/49 GET/OPTIONS readiness checks passed
15:14:50UTC; read-only real-browser testing pass completed15:21:45UTC. Проверены
HTTPS catalog/search, mobile390×844, detail→basket с закрытием modal, FJD236.16,
qty2=472.32, отсутствие overflow, noindex/nofollow/noarchive, testing editorial
canonical/sitemap. Basket очищен, browser session закрыта; submit, account login
и новые business writes в этом final browser pass не выполнялись. Положительные
account/quotation proofs выше относятся к тому же неизменному API/ERP до смены
origin, а не к новому login на исправленном hostname. Parent повторно проверил
физический production DB target API15:15UTC.

Main/www отдельно проверены real Chromium: HTTP200, secure context, OpenCart
markers, без React root. Final evidence: acceptance/corrected-testing/readiness.json,
browser.json и main-oldsite.json.

## Граница rollback

Payments, payment ERP writes и self-registration выключены; baseline pricing
использует Standard Selling/FJD, personalized pricing не реализован. Monitors
проверяют HTTP diagnostics каждые60 секунд и пишут local bounded logs10MB×3;
внешний alert webhook/recipient не настроен. Legacy runtime adapters ещё направлены
на сохранённый старый testing stack, не на новые active stacks. Остаточные dependency
audit advisories и отдельный controlled restore drill остаются maintenance work.
Favicon404 и blocked optional Cloudflare analytics beacon не влияют на storefront.

Для нового website rollback останавливается его writer и меняется только явно
проверенный testing route/image; основной домен уже восстановлен и его DNS не
нужно менять. Не возвращать старый testing writer автоматически: у него другой
ERP target и сохранённая старая база. Временный main-domain cutover уже отменён
точным DNS/old-Caddy rollback, проверенным public OpenCart200.
Additive ERP app/schema/image и новые ERP business writes сохраняются. Не
восстанавливать старую DB после новых записей. До возобновления старого writer
сверить появившиеся заявки; новый runtime/receipts/backup не удалять.
