# ERPNext v16 Website Compatibility Stand

This compose project is an isolated, non-production ERPNext v16 target for the
Green Leaf website integration. It contains only Frappe and ERPNext.

It intentionally excludes:

- production or testing ERP database copies;
- customer, user, order, invoice and payment records;
- uploaded public and private files;
- POS Awesome, HRMS, WooCommerce Connector, Knowledge Base and the legacy
  `greenleaf` app.

The portable integration scope is declared in
`erpnext/website-layer.json`. Test records must use the
`GL-WEB-E2E-` prefix and contain synthetic contact details.

## Start

Create `.env` from `.env.example` with independently generated passwords, then:

```bash
cp -R ../../erpnext/app/greenleaf_website ./greenleaf_website
docker-compose build
docker-compose up -d
docker-compose logs create-site
curl -H 'Host: erp-v16.greenleafpacific.test' http://127.0.0.1:8193/api/method/ping
```

The port is bound to localhost and must not be published directly.

`create-site` installs ERPNext and `greenleaf_website`, runs `bench migrate`,
completes the synthetic FJD company setup, and creates one synthetic
Item/Price/Customer plus the least-privilege integration user. API keys and the
website DB user are generated separately as runtime secrets.

The separate website compatibility compose project joins
`gl-erp-v16_default` and resolves ERP services through the `erp-v16` and
`erp-v16-db` aliases. The live testing website remains connected to v14 until
the v16 contract suite passes.

## Reset

This stand contains synthetic data only. To rebuild it:

```bash
docker-compose down --volumes
docker-compose up -d
```
