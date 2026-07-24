import crypto from "node:crypto";
import { getErpPool } from "../erpnext-db.mjs";
import { migration as credentialsMigration } from "./001-website-customer-credentials.mjs";
import { migration as paymentEventMigration } from "./002-website-payment-event.mjs";

const migrations = [credentialsMigration, paymentEventMigration];
let migrationRun;
let migrationCheck;

function checksum(migration) {
  return crypto.createHash("sha256").update(JSON.stringify(migration.statements)).digest("hex");
}

async function applyMigrations() {
  const pool = getErpPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS \`tabGL Website Schema Migration\` (
      migration_id varchar(140) NOT NULL,
      checksum varchar(64) NOT NULL,
      applied_at datetime(6) NOT NULL,
      PRIMARY KEY (migration_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const connection = await pool.getConnection();
  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK('gl_website_schema_migrations', 30) AS acquired");
    if (Number(lockRows[0]?.acquired || 0) !== 1) throw new Error("website migration lock unavailable");

    for (const migration of migrations) {
      const expectedChecksum = checksum(migration);
      const [rows] = await connection.execute(
        "SELECT checksum FROM `tabGL Website Schema Migration` WHERE migration_id = :id LIMIT 1",
        { id: migration.id }
      );
      if (rows[0]) {
        if (rows[0].checksum !== expectedChecksum) {
          throw new Error(`website migration checksum mismatch: ${migration.id}`);
        }
        continue;
      }

      for (const statement of migration.statements) {
        await connection.execute(statement);
      }
      await connection.execute(
        `
          INSERT INTO \`tabGL Website Schema Migration\` (migration_id, checksum, applied_at)
          VALUES (:id, :checksum, :appliedAt)
        `,
        {
          id: migration.id,
          checksum: expectedChecksum,
          appliedAt: new Date().toISOString().slice(0, 19).replace("T", " ")
        }
      );
    }
  } finally {
    await connection.query("SELECT RELEASE_LOCK('gl_website_schema_migrations')").catch(() => undefined);
    connection.release();
  }
  return migrations.map((migration) => migration.id);
}

export function runWebsiteMigrations() {
  if (!migrationRun) {
    migrationRun = applyMigrations().catch((error) => {
      migrationRun = null;
      throw error;
    });
  }
  return migrationRun;
}

async function checkMigrations() {
  const pool = getErpPool();
  let rows;
  try {
    [rows] = await pool.execute(
      "SELECT migration_id, checksum FROM `tabGL Website Schema Migration`"
    );
  } catch (error) {
    const wrapped = new Error("Website schema is not initialized; run npm run erpnext:migrate-website");
    wrapped.code = "website_schema_not_initialized";
    wrapped.cause = error;
    throw wrapped;
  }

  const applied = new Map(rows.map((row) => [row.migration_id, row.checksum]));
  for (const migration of migrations) {
    const actual = applied.get(migration.id);
    if (!actual) {
      const error = new Error(`Website migration is not applied: ${migration.id}`);
      error.code = "website_migration_missing";
      throw error;
    }
    if (actual !== checksum(migration)) {
      const error = new Error(`Website migration checksum mismatch: ${migration.id}`);
      error.code = "website_migration_checksum_mismatch";
      throw error;
    }
  }
  return migrations.map((migration) => migration.id);
}

export function assertWebsiteMigrationsApplied() {
  if (!migrationCheck) {
    migrationCheck = checkMigrations().catch((error) => {
      migrationCheck = null;
      throw error;
    });
  }
  return migrationCheck;
}

export function websiteMigrationIds() {
  return migrations.map((migration) => migration.id);
}
