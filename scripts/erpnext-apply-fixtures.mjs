import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpPool } from "../api/erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials } from "../api/erpnext-rest.mjs";

const fixturePath = fileURLToPath(new URL("../erpnext/fixtures/custom_fields.json", import.meta.url));

async function customFieldExists(field) {
  const [rows] = await getErpPool().execute(
    "SELECT name FROM `tabCustom Field` WHERE dt = :dt AND fieldname = :fieldname LIMIT 1",
    { dt: field.dt, fieldname: field.fieldname }
  );
  return Boolean(rows[0]);
}

function sqlColumnType(fieldtype) {
  if (fieldtype === "Check") return "int(1)";
  if (fieldtype === "Int") return "int(11)";
  if (fieldtype === "Long Text") return "longtext";
  if (fieldtype === "Small Text" || fieldtype === "Text" || fieldtype === "Text Editor") return "text";
  if (fieldtype === "Datetime") return "datetime(6)";
  return "varchar(140)";
}

async function columnExists(field) {
  const [rows] = await getErpPool().execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
        AND COLUMN_NAME = :fieldname
      LIMIT 1
    `,
    { tableName: `tab${field.dt}`, fieldname: field.fieldname }
  );
  return Boolean(rows[0]);
}

async function createCustomFieldByDatabasePatch(field) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const name = `${field.dt}-${field.fieldname}`;
  const [idxRows] = await getErpPool().execute(
    "SELECT IFNULL(MAX(idx), 0) + 1 AS next_idx FROM `tabCustom Field` WHERE dt = :dt",
    { dt: field.dt }
  );

  await getErpPool().execute(
    `
      INSERT INTO \`tabCustom Field\`
        (name, owner, creation, modified, modified_by, docstatus, idx, dt, fieldname, label, fieldtype,
         insert_after, options, \`default\`, description, read_only, no_copy, \`unique\`)
      VALUES
        (:name, 'Administrator', :now, :now, 'Administrator', 0, :idx, :dt, :fieldname, :label, :fieldtype,
         :insert_after, :options, :default_value, :description, :read_only, :no_copy, :unique_value)
    `,
    {
      name,
      now,
      idx: Number(idxRows[0]?.next_idx || 1),
      dt: field.dt,
      fieldname: field.fieldname,
      label: field.label || field.fieldname,
      fieldtype: field.fieldtype,
      insert_after: field.insert_after || "",
      options: field.options || "",
      default_value: field.default === undefined ? "" : String(field.default),
      description: field.description || "",
      read_only: Number(field.read_only || 0),
      no_copy: Number(field.no_copy || 0),
      unique_value: Number(field.unique || 0)
    }
  );

  if (!(await columnExists(field))) {
    await getErpPool().query(`ALTER TABLE \`tab${field.dt}\` ADD COLUMN \`${field.fieldname}\` ${sqlColumnType(field.fieldtype)}`);
  }
}

async function main() {
  if (!hasErpnextRestCredentials()) {
    throw new Error("ERPNEXT_API_KEY and ERPNEXT_API_SECRET are required to apply fixtures.");
  }

  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  let created = 0;
  let skipped = 0;

  for (const field of fixtures) {
    if (await customFieldExists(field)) {
      console.log(`skip ${field.dt}.${field.fieldname}`);
      skipped += 1;
      continue;
    }

    try {
      await createDoc("Custom Field", field);
      console.log(`create ${field.dt}.${field.fieldname}`);
    } catch (error) {
      if (!String(error.message || "").includes("In List View")) {
        throw error;
      }

      await createCustomFieldByDatabasePatch(field);
      console.log(`create ${field.dt}.${field.fieldname} via db patch`);
    }
    created += 1;
  }

  console.log(`Custom field fixtures applied. Created: ${created}. Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(`Failed to apply ERPNext fixtures: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors after failed connection attempts.
    }
  });
