# Операционные имена

| Объект | Значение |
|---|---|
| Repository | `nwcfollowthewhiterabbit/GL-website` |
| Release branch | `main` |
| Testing URL | `https://testing.greenleafpacific.com` |
| SSH alias | `cloud` |
| Remote repository path | `/home/csrss/stacks/testing.greenleafpacific.com` |
| Web container | `testinggreenleafpacificcom_web_1` |
| API container | `testinggreenleafpacificcom_api_1` |
| Monitor container | `testinggreenleafpacificcom_monitor_1` |
| Local storefront | `http://localhost:8080` |
| Public health | `/health` |
| Account route | `/account` |
| Payment configuration | `/api/payments/config` |
| Protected metrics | `/api/admin/metrics` |
| GitHub CI workflow | `CI` |
| Manual release workflow | `Release readiness` |

## Read-only checks

```bash
git status --short --branch
git rev-parse HEAD
git ls-remote --exit-code origin refs/heads/main
ssh cloud 'git -C /home/csrss/stacks/testing.greenleafpacific.com status --short --branch'
ssh cloud 'docker ps --filter name=testinggreenleafpacificcom'
curl -fsS https://testing.greenleafpacific.com/health
gh run list --workflow CI --commit <SHA> --limit 1
```

Команды не должны выводить `.env`, cookies или provider credentials.

## Runtime operations

```bash
python3 scripts/backup.py --execute --evidence /secure/path/backup.json
python3 scripts/deploy_existing_instance.py --execute \
  --expected-sha <FULL_SHA> --evidence /secure/path/deploy.json
python3 scripts/validate_instance.py --execute --evidence /secure/path/instance.json
python3 scripts/validate_domain.py --execute --evidence /secure/path/domain.json
python3 scripts/validate_mvp_e2e.py --execute --evidence /secure/path/mvp.json
python3 scripts/validate_ui_e2e.py --execute --evidence /secure/path/ui.json
```
