import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.ACCOUNT_LOGIN_ENABLED = "true";
process.env.ACCOUNT_SESSION_SECRET = "test-account-session-secret-at-least-32-characters";

const {
  ACCOUNT_SESSION_COOKIE,
  accountSessionCookieOptions,
  createAccountSessionToken,
  getAccountSession,
  isAccountSessionCurrent,
  isAccountLoginAvailable,
  isProvisionedWebsiteCustomerAccess
} = await import("../api/account-service.mjs");

assert.equal(isAccountLoginAvailable(), true);
assert.equal(accountSessionCookieOptions({ headers: { "x-forwarded-proto": "https" } }).secure, true);

const token = createAccountSessionToken("buyer@example.com", 3);

const session = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(token)}` }
});
assert.equal(session.email, "buyer@example.com");
assert.equal(session.credentialVersion, 3);
assert.equal(
  isAccountSessionCurrent(session, { enabled: 1, user_enabled: 1, session_version: 3 }),
  true
);
assert.equal(
  isAccountSessionCurrent(session, { enabled: 1, user_enabled: 1, session_version: 4 }),
  false
);
assert.equal(
  isAccountSessionCurrent(session, { enabled: 0, user_enabled: 1, session_version: 3 }),
  false
);

const provisionedAccess = {
  email: "buyer@example.com",
  user: {
    enabled: true,
    userType: "Website User",
    roles: ["Website Customer"]
  },
  customerNames: ["CUSTOMER-0001"],
  customers: [{ name: "CUSTOMER-0001", email: "" }],
  contacts: [{ user: "buyer@example.com" }]
};
assert.equal(isProvisionedWebsiteCustomerAccess(provisionedAccess, "CUSTOMER-0001"), true);
assert.equal(
  isProvisionedWebsiteCustomerAccess(
    { ...provisionedAccess, user: { ...provisionedAccess.user, roles: ["System Manager"] } },
    "CUSTOMER-0001"
  ),
  false
);

const backendCustomerAccess = {
  email: "buyer@example.com",
  user: null,
  customerNames: ["CUSTOMER-0001"],
  customers: [{ name: "CUSTOMER-0001", email: "buyer@example.com" }],
  contacts: []
};
assert.equal(
  isProvisionedWebsiteCustomerAccess(backendCustomerAccess, "CUSTOMER-0001"),
  true
);
assert.equal(
  isProvisionedWebsiteCustomerAccess(
    {
      ...backendCustomerAccess,
      customers: [{ name: "CUSTOMER-0001", email: "other@example.com" }]
    },
    "CUSTOMER-0001"
  ),
  false
);

const backendContactAccess = {
  ...backendCustomerAccess,
  customers: [{ name: "CUSTOMER-0001", email: "" }],
  contacts: [{ email: "buyer@example.com", user: "" }]
};
assert.equal(
  isProvisionedWebsiteCustomerAccess(backendContactAccess, "CUSTOMER-0001"),
  true
);
assert.equal(
  isProvisionedWebsiteCustomerAccess({ ...provisionedAccess, contacts: [{ user: "" }] }, "CUSTOMER-0001"),
  false
);

const tampered = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(`${token}x`)}` }
});
assert.equal(tampered, null);

process.env.ACCOUNT_LOGIN_ENABLED = "false";
assert.equal(isAccountLoginAvailable(), false);

console.log("Account authentication tests passed.");
