import assert from "node:assert/strict";

const baseUrl = (process.env.ERP_RUNTIME_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const email = process.env.ACCOUNT_TEST_LOGIN_EMAIL || "gl-web-e2e@example.invalid";
const password = process.env.ACCOUNT_TEST_PASSWORD || "";

assert.ok(password.length >= 10, "ACCOUNT_TEST_PASSWORD is required");

const login = await fetch(`${baseUrl}/api/account/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
const loginBody = await login.json();
assert.ok(login.ok, `Account login failed: ${JSON.stringify(loginBody)}`);
assert.equal(loginBody.email, email);

const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("gl_account_session="), "Account session cookie is missing");

const session = await fetch(`${baseUrl}/api/account/session`, {
  headers: { Cookie: cookie }
});
const sessionBody = await session.json();
assert.ok(session.ok, `Account session failed: ${JSON.stringify(sessionBody)}`);
assert.equal(sessionBody.account?.email, email);
assert.ok(sessionBody.account?.profile?.name);
assert.ok(sessionBody.account?.quotes?.length > 0);
assert.ok(sessionBody.account?.orders?.length > 0);

const foreignDetail = await fetch(`${baseUrl}/api/account/orders/GL-WEB-E2E-NOT-OWNED`, {
  headers: { Cookie: cookie }
});
assert.equal(foreignDetail.status, 404);

console.log("ERPNext customer account runtime contract passed.");
