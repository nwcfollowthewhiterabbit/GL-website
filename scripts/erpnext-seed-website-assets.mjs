import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpPool } from "../api/erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials } from "../api/erpnext-rest.mjs";
import { getCatalogProducts } from "../api/catalog-service.mjs";
import { websiteCatalogDownloads } from "../src/data/catalogDownloadsSeed.mjs";
import { websiteManufacturers } from "../src/data/manufacturersSeed.mjs";

const fixturePaths = [
  fileURLToPath(new URL("../erpnext/fixtures/website_catalog_doctype.json", import.meta.url)),
  fileURLToPath(new URL("../erpnext/fixtures/website_manufacturer_doctype.json", import.meta.url)),
  fileURLToPath(new URL("../erpnext/fixtures/website_featured_product_doctype.json", import.meta.url))
];

async function tableExists(tableName) {
  const [rows] = await getErpPool().execute(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
      LIMIT 1
    `,
    { tableName }
  );
  return Boolean(rows[0]);
}

async function doctypeExists(name) {
  if (!(await tableExists("tabDocType"))) return false;
  const [rows] = await getErpPool().execute("SELECT name FROM `tabDocType` WHERE name = :name LIMIT 1", { name });
  return Boolean(rows[0]);
}

async function loadFixtures() {
  const fixtures = [];
  for (const path of fixturePaths) {
    fixtures.push(...JSON.parse(await readFile(path, "utf8")));
  }
  return fixtures;
}

async function ensureRuntimeTables() {
  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Catalog\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      catalog_id varchar(140) DEFAULT NULL,
      title varchar(140) DEFAULT NULL,
      description text,
      source_label varchar(140) DEFAULT NULL,
      file_url varchar(500) DEFAULT NULL,
      cover_image varchar(500) DEFAULT NULL,
      enabled int(1) NOT NULL DEFAULT 1,
      sort_order int(11) NOT NULL DEFAULT 0,
      PRIMARY KEY (name),
      UNIQUE KEY catalog_id (catalog_id),
      KEY sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Manufacturer\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      manufacturer_id varchar(140) DEFAULT NULL,
      manufacturer_name varchar(140) DEFAULT NULL,
      logo varchar(500) DEFAULT NULL,
      url varchar(500) DEFAULT NULL,
      enabled int(1) NOT NULL DEFAULT 1,
      sort_order int(11) NOT NULL DEFAULT 0,
      PRIMARY KEY (name),
      UNIQUE KEY manufacturer_id (manufacturer_id),
      KEY sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Featured Product\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      item_code varchar(140) DEFAULT NULL,
      display_name varchar(140) DEFAULT NULL,
      enabled int(1) NOT NULL DEFAULT 1,
      sort_order int(11) NOT NULL DEFAULT 0,
      note text,
      PRIMARY KEY (name),
      UNIQUE KEY item_code (item_code),
      KEY sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function tryCreateDoctypes(fixtures) {
  if (!hasErpnextRestCredentials()) {
    console.log("skip Website asset DocType REST creation: ERPNext REST credentials are not configured");
    return;
  }

  for (const fixture of fixtures) {
    if (await doctypeExists(fixture.name)) {
      console.log(`skip DocType ${fixture.name}`);
      continue;
    }

    try {
      await createDoc("DocType", fixture);
      console.log(`create DocType ${fixture.name}`);
    } catch (error) {
      console.log(`skip DocType ${fixture.name} REST creation: ${String(error.message || error).slice(0, 180)}`);
    }
  }
}

async function ensureDoctypeMetadata(fixtures) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (const fixture of fixtures) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabDocType\`
          (name, creation, modified, modified_by, owner, docstatus, idx, module, custom, istable, editable_grid,
           autoname, title_field, sort_field, sort_order, allow_import, quick_entry)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, 0, :module, 1, 0, 1,
           :autoname, :titleField, :sortField, :sortOrder, 1, 0)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          module = VALUES(module),
          custom = VALUES(custom),
          autoname = VALUES(autoname),
          title_field = VALUES(title_field),
          sort_field = VALUES(sort_field),
          sort_order = VALUES(sort_order)
      `,
      {
        name: fixture.name,
        now,
        module: fixture.module || "Greenleaf",
        autoname: fixture.autoname || "",
        titleField: fixture.title_field || "",
        sortField: fixture.sort_field || "modified",
        sortOrder: fixture.sort_order || "DESC"
      }
    );

    for (const [index, field] of fixture.fields.entries()) {
      await getErpPool().execute(
        `
          INSERT INTO \`tabDocField\`
            (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype,
             fieldname, label, fieldtype, options, reqd, \`unique\`, \`default\`, description, in_list_view)
          VALUES
            (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :parent, 'fields', 'DocType',
             :fieldname, :label, :fieldtype, :options, :reqd, :uniqueValue, :defaultValue, :description, :inListView)
          ON DUPLICATE KEY UPDATE
            modified = VALUES(modified),
            idx = VALUES(idx),
            label = VALUES(label),
            fieldtype = VALUES(fieldtype),
            options = VALUES(options),
            reqd = VALUES(reqd),
            \`unique\` = VALUES(\`unique\`),
            \`default\` = VALUES(\`default\`),
            description = VALUES(description),
            in_list_view = VALUES(in_list_view)
        `,
        {
          name: `${fixture.name}-${field.fieldname}`,
          now,
          idx: index + 1,
          parent: fixture.name,
          fieldname: field.fieldname,
          label: field.label || field.fieldname,
          fieldtype: field.fieldtype || "Data",
          options: field.options || "",
          reqd: Number(field.reqd || 0),
          uniqueValue: Number(field.unique || 0),
          defaultValue: field.default === undefined ? "" : String(field.default),
          description: field.description || "",
          inListView: ["title", "manufacturer_name", "item_code", "display_name", "enabled", "sort_order"].includes(field.fieldname) ? 1 : 0
        }
      );
    }

    await getErpPool().execute(
      `
        INSERT INTO \`tabDocPerm\`
          (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype,
           permlevel, role, \`read\`, \`write\`, \`create\`, \`delete\`, report, export, print, email, share)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, 1, :parent, 'permissions', 'DocType',
           0, 'System Manager', 1, 1, 1, 1, 1, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          role = VALUES(role),
          \`read\` = VALUES(\`read\`),
          \`write\` = VALUES(\`write\`),
          \`create\` = VALUES(\`create\`),
          \`delete\` = VALUES(\`delete\`)
      `,
      { name: `${fixture.name}-System Manager-0`, now, parent: fixture.name }
    );
  }

  console.log(`Website asset DocType metadata ensured. DocTypes: ${fixtures.length}.`);
}

async function seedCatalogs() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (const [index, catalog] of websiteCatalogDownloads.entries()) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabWebsite Catalog\`
          (name, creation, modified, modified_by, owner, docstatus, idx, catalog_id, title, description,
           source_label, file_url, cover_image, enabled, sort_order)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :catalogId, :title, :description,
           :sourceLabel, :fileUrl, :coverImage, 1, :sortOrder)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          catalog_id = VALUES(catalog_id),
          title = VALUES(title),
          description = VALUES(description),
          source_label = VALUES(source_label),
          file_url = VALUES(file_url),
          cover_image = VALUES(cover_image),
          enabled = VALUES(enabled),
          sort_order = VALUES(sort_order)
      `,
      {
        name: catalog.id,
        now,
        idx: index + 1,
        catalogId: catalog.id,
        title: catalog.title,
        description: catalog.description || "",
        sourceLabel: catalog.sourceLabel || "Catalogue",
        fileUrl: catalog.fileUrl,
        coverImage: catalog.coverImage || "",
        sortOrder: (index + 1) * 10
      }
    );
  }

  console.log(`Website catalogs seeded. Catalogs: ${websiteCatalogDownloads.length}.`);
}

async function seedManufacturers() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await getErpPool().execute("UPDATE `tabWebsite Manufacturer` SET enabled = 0");

  for (const [index, manufacturer] of websiteManufacturers.entries()) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabWebsite Manufacturer\`
          (name, creation, modified, modified_by, owner, docstatus, idx, manufacturer_id, manufacturer_name,
           logo, url, enabled, sort_order)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :manufacturerId, :manufacturerName,
           :logo, :url, 1, :sortOrder)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          manufacturer_id = VALUES(manufacturer_id),
          manufacturer_name = VALUES(manufacturer_name),
          logo = VALUES(logo),
          url = VALUES(url),
          enabled = VALUES(enabled),
          sort_order = VALUES(sort_order)
      `,
      {
        name: manufacturer.id,
        now,
        idx: index + 1,
        manufacturerId: manufacturer.id,
        manufacturerName: manufacturer.name,
        logo: manufacturer.logo,
        url: manufacturer.url || "/catalog",
        sortOrder: (index + 1) * 10
      }
    );
  }

  console.log(`Website manufacturers seeded. Manufacturers: ${websiteManufacturers.length}.`);
}

async function seedFeaturedProducts() {
  const [existing] = await getErpPool().execute("SELECT COUNT(*) AS total FROM `tabWebsite Featured Product`");
  if (Number(existing[0]?.total || 0) > 0) {
    console.log("Website featured products already exist. Seed skipped.");
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await getCatalogProducts({ pageSize: 8 });
  const products = result.products.slice(0, 8);

  for (const [index, product] of products.entries()) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabWebsite Featured Product\`
          (name, creation, modified, modified_by, owner, docstatus, idx, item_code, display_name, enabled, sort_order, note)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :itemCode, :displayName, 1, :sortOrder, :note)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          display_name = VALUES(display_name),
          enabled = VALUES(enabled),
          sort_order = VALUES(sort_order)
      `,
      {
        name: product.sku,
        now,
        idx: index + 1,
        itemCode: product.sku,
        displayName: product.name,
        sortOrder: (index + 1) * 10,
        note: "Initial seed from live ERP catalog"
      }
    );
  }

  console.log(`Website featured products seeded. Products: ${products.length}.`);
}

async function main() {
  const fixtures = await loadFixtures();
  await tryCreateDoctypes(fixtures);
  await ensureRuntimeTables();
  await ensureDoctypeMetadata(fixtures);
  await seedCatalogs();
  await seedManufacturers();
  await seedFeaturedProducts();
}

main()
  .catch((error) => {
    console.error(`Failed to seed website assets: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors after failed connection attempts.
    }
  });
