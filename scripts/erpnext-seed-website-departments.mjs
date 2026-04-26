import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpPool } from "../api/erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials } from "../api/erpnext-rest.mjs";
import { websiteCategories } from "../src/data/websiteCategoriesSeed.mjs";

const doctypeFixturePath = fileURLToPath(new URL("../erpnext/fixtures/website_department_doctypes.json", import.meta.url));

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

async function ensureRuntimeTables() {
  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Department\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      department_id varchar(140) DEFAULT NULL,
      label varchar(140) DEFAULT NULL,
      description text,
      enabled int(1) NOT NULL DEFAULT 1,
      featured int(1) NOT NULL DEFAULT 0,
      sort_order int(11) NOT NULL DEFAULT 0,
      PRIMARY KEY (name),
      UNIQUE KEY department_id (department_id),
      KEY sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await getErpPool().query(`
    CREATE TABLE IF NOT EXISTS \`tabWebsite Department Item Group\` (
      name varchar(140) NOT NULL,
      creation datetime(6) DEFAULT NULL,
      modified datetime(6) DEFAULT NULL,
      modified_by varchar(140) DEFAULT NULL,
      owner varchar(140) DEFAULT NULL,
      docstatus int(1) NOT NULL DEFAULT 0,
      idx int(8) NOT NULL DEFAULT 0,
      parent varchar(140) DEFAULT NULL,
      parentfield varchar(140) DEFAULT NULL,
      parenttype varchar(140) DEFAULT NULL,
      item_group varchar(140) DEFAULT NULL,
      sort_order int(11) NOT NULL DEFAULT 0,
      PRIMARY KEY (name),
      KEY parent (parent),
      KEY item_group (item_group)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureDoctypeMetadata() {
  const fixtures = JSON.parse(await readFile(doctypeFixturePath, "utf8"));
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (const fixture of fixtures) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabDocType\`
          (name, creation, modified, modified_by, owner, docstatus, idx, module, custom, istable, editable_grid,
           autoname, title_field, sort_field, sort_order, allow_import, quick_entry)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, 0, :module, 1, :istable, 1,
           :autoname, :titleField, :sortField, :sortOrder, 1, 0)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          module = VALUES(module),
          custom = VALUES(custom),
          istable = VALUES(istable),
          autoname = VALUES(autoname),
          title_field = VALUES(title_field),
          sort_field = VALUES(sort_field),
          sort_order = VALUES(sort_order)
      `,
      {
        name: fixture.name,
        now,
        module: fixture.module || "Greenleaf",
        istable: Number(fixture.istable || 0),
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
          inListView: ["department_id", "label", "enabled", "item_group"].includes(field.fieldname) ? 1 : 0
        }
      );
    }

    if (!fixture.istable) {
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
  }

  console.log(`Website department DocType metadata ensured. DocTypes: ${fixtures.length}.`);
}

async function doctypeExists(name) {
  if (!(await tableExists("tabDocType"))) return false;
  const [rows] = await getErpPool().execute("SELECT name FROM `tabDocType` WHERE name = :name LIMIT 1", { name });
  return Boolean(rows[0]);
}

async function tryCreateDoctypes() {
  if (!hasErpnextRestCredentials()) {
    console.log("skip DocType REST creation: ERPNext REST credentials are not configured");
    return;
  }

  const fixtures = JSON.parse(await readFile(doctypeFixturePath, "utf8"));
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

async function seedDepartments() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  let departmentCount = 0;
  let mappingCount = 0;

  for (const [departmentIndex, category] of websiteCategories.entries()) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabWebsite Department\`
          (name, creation, modified, modified_by, owner, docstatus, idx, department_id, label, description, enabled, featured, sort_order)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :departmentId, :label, :description, 1, :featured, :sortOrder)
        ON DUPLICATE KEY UPDATE
          modified = VALUES(modified),
          department_id = VALUES(department_id),
          label = VALUES(label),
          description = VALUES(description),
          enabled = VALUES(enabled),
          featured = VALUES(featured),
          sort_order = VALUES(sort_order)
      `,
      {
        name: category.id,
        now,
        idx: departmentIndex + 1,
        departmentId: category.id,
        label: category.label,
        description: category.description,
        featured: category.featured ? 1 : 0,
        sortOrder: (departmentIndex + 1) * 10
      }
    );
    departmentCount += 1;

    await getErpPool().execute("DELETE FROM `tabWebsite Department Item Group` WHERE parent = :parent", { parent: category.id });

    for (const [mappingIndex, itemGroup] of category.itemGroups.entries()) {
      await getErpPool().execute(
        `
          INSERT INTO \`tabWebsite Department Item Group\`
            (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype, item_group, sort_order)
          VALUES
            (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :parent, 'item_groups', 'Website Department', :itemGroup, :sortOrder)
        `,
        {
          name: `${category.id}-${mappingIndex + 1}`,
          now,
          idx: mappingIndex + 1,
          parent: category.id,
          itemGroup,
          sortOrder: (mappingIndex + 1) * 10
        }
      );
      mappingCount += 1;
    }
  }

  console.log(`Website departments seeded. Departments: ${departmentCount}. Item group mappings: ${mappingCount}.`);
}

async function main() {
  await tryCreateDoctypes();
  await ensureRuntimeTables();
  await ensureDoctypeMetadata();
  await seedDepartments();
}

main()
  .catch((error) => {
    console.error(`Failed to seed website departments: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors after failed connection attempts.
    }
  });
