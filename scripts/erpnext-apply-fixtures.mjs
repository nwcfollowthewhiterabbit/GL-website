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

    await createDoc("Custom Field", field);
    console.log(`create ${field.dt}.${field.fieldname}`);
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
