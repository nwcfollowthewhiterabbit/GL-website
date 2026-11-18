export const migration = {
  id: "004-website-session-revocation",
  statements: [
    `CREATE TABLE IF NOT EXISTS \`tabWebsite Session Revocation\` (
      token_digest binary(32) NOT NULL,
      expires_at_ms bigint unsigned NOT NULL,
      PRIMARY KEY (token_digest),
      KEY website_revocation_expiry (expires_at_ms)
    ) ENGINE=InnoDB`
  ]
};
