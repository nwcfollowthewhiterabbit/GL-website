export const migration = {
  id: "002-website-payment-event",
  statements: [
    `
      CREATE TABLE IF NOT EXISTS \`tabWebsite Payment Event\` (
        name varchar(140) NOT NULL,
        creation datetime(6) NOT NULL,
        modified datetime(6) NOT NULL,
        request_id varchar(140) NOT NULL,
        provider varchar(40) NOT NULL,
        provider_session_id varchar(140) DEFAULT NULL,
        provider_transaction_id varchar(140) DEFAULT NULL,
        hpp_url text DEFAULT NULL,
        expires_at datetime(6) DEFAULT NULL,
        payable_doctype varchar(140) NOT NULL,
        payable_name varchar(140) NOT NULL,
        customer varchar(140) NOT NULL,
        customer_email varchar(140) NOT NULL,
        company varchar(140) NOT NULL,
        grand_total decimal(18,6) NOT NULL,
        original_outstanding_amount decimal(18,6) NOT NULL,
        amount decimal(18,6) NOT NULL,
        currency varchar(10) NOT NULL,
        status varchar(40) NOT NULL,
        effect_status varchar(40) NOT NULL DEFAULT 'pending',
        payment_entry varchar(140) DEFAULT NULL,
        callback_count int(8) NOT NULL DEFAULT 0,
        provider_payload_hash varchar(64) DEFAULT NULL,
        last_error text DEFAULT NULL,
        PRIMARY KEY (name),
        UNIQUE KEY website_payment_request_id (request_id),
        UNIQUE KEY website_payment_provider_session (provider_session_id),
        UNIQUE KEY website_payment_provider_transaction (provider_transaction_id),
        KEY website_payment_payable (payable_doctype, payable_name),
        KEY website_payment_customer (customer)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  ]
};
