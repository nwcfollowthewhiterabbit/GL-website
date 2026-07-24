import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.ACCOUNT_LOGIN_ENABLED = "true";
process.env.ACCOUNT_SESSION_SECRET = "test-account-session-secret-at-least-32-characters";

const {
  ACCOUNT_SESSION_COOKIE,
  accountSessionCookieOptions,
  createAccountSessionToken,
  getAccountSession,
  isAccountLoginAvailable
} = await import("../api/account-service.mjs");

assert.equal(isAccountLoginAvailable(), true);
assert.equal(accountSessionCookieOptions({ headers: { "x-forwarded-proto": "https" } }).secure, true);

const token = createAccountSessionToken("buyer@example.com");

const session = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(token)}` }
});
assert.equal(session.email, "buyer@example.com");

const tampered = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(`${token}x`)}` }
});
assert.equal(tampered, null);

process.env.ACCOUNT_LOGIN_ENABLED = "false";
assert.equal(isAccountLoginAvailable(), false);

console.log("Account authentication tests passed.");
