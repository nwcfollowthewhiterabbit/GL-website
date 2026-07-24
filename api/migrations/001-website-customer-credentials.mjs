export const migration = {
  id: "001-website-customer-credentials",
  statements: [
    `
      CREATE TABLE IF NOT EXISTS \`tabWebsite Customer Credential\` (
        name varchar(140) NOT NULL,
        creation datetime(6) DEFAULT NULL,
        modified datetime(6) DEFAULT NULL,
        modified_by varchar(140) DEFAULT NULL,
        owner varchar(140) DEFAULT NULL,
        docstatus int(1) NOT NULL DEFAULT 0,
        idx int(8) NOT NULL DEFAULT 0,
        customer varchar(140) NOT NULL,
        email varchar(140) NOT NULL,
        password_hash text NOT NULL,
        enabled int(1) NOT NULL DEFAULT 1,
        session_version int(8) NOT NULL DEFAULT 1,
        last_login datetime(6) DEFAULT NULL,
        PRIMARY KEY (name),
        UNIQUE KEY website_customer_credential_email (email),
        KEY website_customer_credential_customer (customer)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      ALTER TABLE \`tabWebsite Customer Credential\`
      ADD COLUMN IF NOT EXISTS session_version int(8) NOT NULL DEFAULT 1
    `
  ]
};
