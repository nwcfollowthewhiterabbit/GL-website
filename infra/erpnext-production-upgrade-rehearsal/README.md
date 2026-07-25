# ERPNext production upgrade rehearsal

This stack restores a SQL-only production backup into an isolated Docker
network. It must never point at the production database, sites volume, or
Docker network.

Safety properties:

- the SQL backup is mounted read-only into the backend only;
- ERP is only exposed on a localhost port;
- the Docker network is internal and cannot deliver email or call integrations;
- scheduler and worker services are intentionally absent;
- production files and attachments are not restored;
- v15 and v16 use separate custom-app source directories.

The image also carries two compatibility provisions required by the exact
production app sources:

- `WooCommerce==3.0.0`, matching the production Python dependency;
- a `knowledge_base.__version__` fallback for the legacy app, so Bench
  inventory commands remain usable.

The rehearsal sequence is:

1. Build the v15 image with the production custom apps and current v15 HRMS.
2. Create an empty site, restore `database.sql.gz`, disable scheduler and set
   maintenance mode.
3. Run `bench migrate` and record every compatibility failure.
4. Build the v16 image with current v16 HRMS, then run `bench migrate` again.
5. Install `greenleaf_website`, validate the website database contract and run
   the website runtime tests against the migrated clone.

The SQL backup contains production business data and must remain mode `0600`
under a mode `0700` directory. It is not a repository artifact.
