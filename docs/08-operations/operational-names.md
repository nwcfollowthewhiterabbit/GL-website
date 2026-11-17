# Операционные имена

Проверено 2026-11-17 20:24 UTC; [customer quotation release и evidence](releases/2026-11-17-customer-quotation-release.md). Первоначальное подключение сайта к ERP сохранено в [историческом release record](releases/2026-11-17-testing-site-production-erp.md).

| Объект | Значение |
|---|---|
| Repository / branch | `nwcfollowthewhiterabbit/GL-website` / `main` |
| SSH alias | `cloud` |
| Source checkout | `/home/csrss/releases/gl-website-20261117-source` |
| New website project (production ERP) | `gl-website-production-20261117` |
| New website root | `/home/csrss/stacks/greenleaf-website-20261117` |
| Main website (unchanged OpenCart) | `https://greenleafpacific.com` |
| Isolated rehearsal / testing ERP project | `gl-web-stage-20261117` |
| Isolated rehearsal root | `/home/csrss/stacks/gl-website-stage-20261117` |
| New website public URL | `https://testing.greenleafpacific.com` |
| Testing ERP URL | `https://testing.erp.greenleafpacific.com` |
| Website services | `api`, `web`, `monitor` |
| Public health / account | `/health` / `/account` |
| Payment configuration | `/api/payments/config` |
| ERP content administration | `/app/website-control-center` |
| Protected metrics | `/api/admin/metrics` |
| GitHub workflows | `CI`, `Release readiness` |

## Read-only checks

```bash
git status --short --branch
git rev-parse HEAD
git ls-remote --exit-code origin refs/heads/main
ssh cloud 'git -C /home/csrss/releases/gl-website-20261117-source status --short --branch'
ssh cloud 'docker ps --filter label=com.docker.compose.project=gl-website-production-20261117'
ssh cloud 'docker ps --filter label=com.docker.compose.project=gl-web-stage-20261117'
curl -fsS https://testing.greenleafpacific.com/health
gh run list --workflow CI --commit <SHA> --limit 1
```

Не выводить `.env`, cookie, site_config или provider credentials.
Старые `testinggreenleafpacificcom_*` — сохранённый legacy runtime, а не текущий
публичный testing target. Перед любой write operation прочитать
[deployment](deployment.md) и проверить точный project/image/target.
