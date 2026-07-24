# Infrastructure

Infrastructure is intentionally minimal and repository-native:

- `docker-compose.yml`
- `Dockerfile`
- `Dockerfile.api`
- `nginx.conf`
- `.env.example`

Testing host provisioning and ERP infrastructure are not managed by this
repository. Future infrastructure automation must preserve the website/ERP
ownership boundary and must not embed environment values.
