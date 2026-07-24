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
| Local storefront | `http://localhost:8080` |
| Public health | `/health` |
| Account route | `/account` |
| Payment configuration | `/api/payments/config` |
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
