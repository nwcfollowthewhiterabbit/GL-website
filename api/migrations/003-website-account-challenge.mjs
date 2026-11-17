export const migration = {
  id: "003-website-account-challenge",
  statements: [
    `CREATE TABLE IF NOT EXISTS \`tabWebsite Account Challenge\` (
      name varchar(64) NOT NULL,
      email varchar(140) NOT NULL,
      purpose varchar(16) NOT NULL,
      token_hash varchar(64) DEFAULT NULL,
      expires_at datetime(6) DEFAULT NULL,
      consumed_at datetime(6) DEFAULT NULL,
      credential_version int NOT NULL DEFAULT 0,
      last_requested_at datetime(6) NOT NULL,
      window_started_at datetime(6) NOT NULL,
      request_count int NOT NULL DEFAULT 1,
      PRIMARY KEY (name),
      UNIQUE KEY website_account_challenge_token (token_hash),
      KEY website_account_challenge_email (email, purpose)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ]
};
