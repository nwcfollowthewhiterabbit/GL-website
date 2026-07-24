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
  isAccountLoginAvailable
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

const tampered = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(`${token}x`)}` }
});
assert.equal(tampered, null);

process.env.ACCOUNT_LOGIN_ENABLED = "false";
assert.equal(isAccountLoginAvailable(), false);

console.log("Account authentication tests passed.");
