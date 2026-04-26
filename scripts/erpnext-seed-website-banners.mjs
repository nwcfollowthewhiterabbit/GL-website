import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpPool } from "../api/erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials } from "../api/erpnext-rest.mjs";
import { heroBanners } from "../src/data/heroBannersSeed.mjs";

const doctypeFixturePath = fileURLToPath(new URL("../erpnext/fixtures/website_banner_doctype.json", import.meta.url));

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

async function ensureRuntimeTable() {
  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Banner\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      banner_id varchar(140) DEFAULT NULL,
      label varchar(140) DEFAULT NULL,
      title varchar(140) DEFAULT NULL,
      copy text,
      image varchar(500) DEFAULT NULL,
      href varchar(500) DEFAULT NULL,
      open_in_new_tab int(1) NOT NULL DEFAULT 0,
      enabled int(1) NOT NULL DEFAULT 1,
      sort_order int(11) NOT NULL DEFAULT 0,
      PRIMARY KEY (name),
      UNIQUE KEY banner_id (banner_id),
      KEY sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function tryCreateDoctype() {
  if (!hasErpnextRestCredentials()) {
    console.log("skip Website Banner DocType REST creation: ERPNext REST credentials are not configured");
    return;
  }

  const [fixture] = JSON.parse(await readFile(doctypeFixturePath, "utf8"));
  if (await doctypeExists(fixture.name)) {
    console.log(`skip DocType ${fixture.name}`);
    return;
  }

  try {
    await createDoc("DocType", fixture);
    console.log(`create DocType ${fixture.name}`);
  } catch (error) {
    console.log(`skip DocType ${fixture.name} REST creation: ${String(error.message || error).slice(0, 180)}`);
  }
}

async function ensureDoctypeMetadata() {
  const [fixture] = JSON.parse(await readFile(doctypeFixturePath, "utf8"));
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

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
        inListView: ["label", "title", "enabled", "sort_order"].includes(field.fieldname) ? 1 : 0
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

  console.log("Website Banner DocType metadata ensured.");
}

async function seedBanners() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (const [index, banner] of heroBanners.entries()) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabWebsite Banner\`
          (name, creation, modified, modified_by, owner, docstatus, idx, banner_id, label, title, copy,
           image, href, open_in_new_tab, enabled, sort_order)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :bannerId, :label, :title, :copy,
           :image, :href, :openInNewTab, 1, :sortOrder)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          banner_id = VALUES(banner_id),
          label = VALUES(label),
          title = VALUES(title),
          copy = VALUES(copy),
          image = VALUES(image),
          href = VALUES(href),
          open_in_new_tab = VALUES(open_in_new_tab),
          enabled = VALUES(enabled),
          sort_order = VALUES(sort_order)
      `,
      {
        name: banner.id,
        now,
        idx: index + 1,
        bannerId: banner.id,
        label: banner.label,
        title: banner.title,
        copy: banner.copy,
        image: banner.image,
        href: banner.href,
        openInNewTab: banner.openInNewTab ? 1 : 0,
        sortOrder: (index + 1) * 10
      }
    );
  }

  console.log(`Website banners seeded. Banners: ${heroBanners.length}.`);
}

async function main() {
  await tryCreateDoctype();
  await ensureRuntimeTable();
  await ensureDoctypeMetadata();
  await seedBanners();
}

main()
  .catch((error) => {
    console.error(`Failed to seed website banners: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors after failed connection attempts.
    }
  });
