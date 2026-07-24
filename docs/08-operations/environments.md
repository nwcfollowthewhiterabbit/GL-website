# Окружения

## Local

- Storefront: `http://localhost:8080`
- API health: `http://localhost:8080/health`
- Runtime: local Docker Compose
- Environment: untracked `.env`

## Testing

- URL: `https://testing.greenleafpacific.com`
- SSH alias: `cloud`
- Repository:
  `/home/csrss/stacks/testing.greenleafpacific.com`
- Branch: `main`
- Web container: `testinggreenleafpacificcom_web_1`
- API container: `testinggreenleafpacificcom_api_1`
- Indexing: disabled
- Windcave: disabled until UAT credentials

## Production

Не настроено в рамках текущего этапа. Testing identifiers нельзя
автоматически считать production configuration.

## Разделение runtime

Website stack является target сайта. ERPNext containers, database и files не
входят в website deploy или website backup.
