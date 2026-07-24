import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.ACCOUNT_DEV_LOGIN = "true";
process.env.ACCOUNT_SESSION_SECRET = "test-account-session-secret-at-least-32-characters";

const {
  ACCOUNT_SESSION_COOKIE,
  getAccountSession,
  isAccountLoginAvailable,
  startAccountLogin,
  verifyAccountLogin
} = await import("../api/account-service.mjs");

assert.equal(isAccountLoginAvailable(), true);

const started = await startAccountLogin("buyer@example.com");
assert.equal(started.ok, true);
assert.match(started.devCode, /^\d{6}$/);

const rejected = verifyAccountLogin("buyer@example.com", "000000");
assert.equal(rejected.ok, false);
assert.equal(rejected.error, "invalid_code");

const verified = verifyAccountLogin("buyer@example.com", started.devCode);
assert.equal(verified.ok, true);
assert.ok(verified.token);

const session = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(verified.token)}` }
});
assert.equal(session.email, "buyer@example.com");

const tampered = getAccountSession({
  headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(`${verified.token}x`)}` }
});
assert.equal(tampered, null);

const reused = verifyAccountLogin("buyer@example.com", started.devCode);
assert.equal(reused.ok, false);
assert.equal(reused.error, "code_expired");

process.env.ACCOUNT_DEV_LOGIN = "false";
process.env.ACCOUNT_TEST_LOGIN_ENABLED = "true";
process.env.ACCOUNT_TEST_LOGIN_EMAIL = "customer-demo@example.com";
process.env.ACCOUNT_TEST_LOGIN_CODE = "12345678";
assert.equal(isAccountLoginAvailable(), true);

process.env.ACCOUNT_TEST_LOGIN_CODE = "123";
assert.equal(isAccountLoginAvailable(), false);

console.log("Account authentication tests passed.");
