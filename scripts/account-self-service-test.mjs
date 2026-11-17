import assert from "node:assert/strict";
import crypto from "node:crypto";
import { accountChallengeUsable, accountSelfServiceConfig, createAccountSelfService } from "../api/account-self-service.mjs";
import { accountEmailConfiguration, deliverAccountEmail } from "../api/account-email.mjs";

process.env.ACCOUNT_SESSION_SECRET = "test-self-service-secret-at-least-32-characters";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const config = () => ({ loginEnabled: true, registrationEnabled: true, passwordResetEnabled: true });
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function fixture() {
  let clock = Date.UTC(2026, 10, 17, 16);
  let access = { user: null, customerNames: [], customers: [], contacts: [] };
  const rows = new Map();
  const credentials = new Map();
  const deliveries = [];
  const customers = [];
  let deliveryFails = false;
  let tail = Promise.resolve();
  const store = {
    withEmailLock(_email, operation) {
      const result = tail.then(operation);
      tail = result.catch(() => undefined);
      return result;
    },
    async credential(email) { return credentials.get(email) || null; },
    async challenge(email, purpose) { return rows.get(`${purpose}:${email}`) || null; },
    async token(tokenHash) { return [...rows.values()].find((row) => row.token_hash === tokenHash) || null; },
    async issue({ email, purpose, tokenHash, credentialVersion, now, previous }) {
      const sameWindow = previous && now - new Date(previous.window_started_at).getTime() < 3600000;
      rows.set(`${purpose}:${email}`, {
        name: `${purpose}:${email}`, email, purpose, token_hash: tokenHash, credential_version: credentialVersion,
        expires_at: new Date(now + 1800000).toISOString(), consumed_at: null,
        last_requested_at: new Date(now).toISOString(),
        window_started_at: sameWindow ? previous.window_started_at : new Date(now).toISOString(),
        request_count: sameWindow ? previous.request_count + 1 : 1
      });
    },
    async invalidate(tokenHash, now) {
      const row = await this.token(tokenHash);
      if (row) { row.token_hash = null; row.consumed_at = new Date(now).toISOString(); }
    },
    async finish(challenge, { customer, passwordHash, now }) {
      const current = rows.get(challenge.name);
      if (!accountChallengeUsable(current, challenge.purpose, challenge.token_hash, now)) return { ok: false, error: "invalid_or_expired_token" };
      if (challenge.purpose === "register") {
        if (credentials.has(challenge.email)) return { ok: false, error: "account_already_exists" };
        credentials.set(challenge.email, { customer, email: challenge.email, enabled: 1, session_version: 1, password_hash: passwordHash });
      } else {
        const credential = credentials.get(challenge.email);
        if (!credential || credential.enabled !== 1 || credential.session_version !== challenge.credential_version) return { ok: false, error: "invalid_or_expired_token" };
        credential.password_hash = passwordHash;
        credential.session_version += 1;
      }
      await this.invalidate(challenge.token_hash, now);
      return { ok: true };
    }
  };
  const service = createAccountSelfService({
    store, config, now: () => clock, origin: () => "https://testing.greenleafpacific.com",
    resolveAccess: async () => access,
    createCustomer: async (data) => { customers.push(data); return { name: `CUSTOMER-${customers.length}` }; },
    hashPassword: async (password) => `hashed:${hash(password)}`,
    deliver: async (message) => { if (deliveryFails) throw new Error("failure-with-sensitive-provider-details"); deliveries.push(message); },
    onDeliveryError: () => undefined
  });
  const token = () => new URL(deliveries.at(-1).url).hash.split("=")[1];
  const details = () => ({ token: token(), password: "Long-test-password", company: "GL-WEB-E2E Company", contact: "Test Buyer", phone: "+6791234567" });
  return { service, store, rows, credentials, deliveries, customers, token, details,
    advance: (ms) => { clock += ms; }, access: (value) => { access = value; }, failDelivery: () => { deliveryFails = true; } };
}

{
  const f = fixture();
  const result = await f.service.request("register", "  BUYER@example.com ");
  check(result.ok && f.deliveries.length === 1, "Registration request sends one verification email");
  check(f.credentials.size === 0 && f.customers.length === 0, "Unverified requests create no credentials or Customer");
  check(!JSON.stringify([...f.rows.values()]).includes(f.token()), "Only token hash is stored");
  check(!JSON.stringify(result).includes(f.token()), "Token is never returned through the public response");
  check(f.deliveries[0].url.startsWith("https://testing.greenleafpacific.com/account#register="), "Token is carried only in URL fragment");
  const registered = await f.service.complete("register", f.details());
  check(registered.ok && registered.email === "buyer@example.com" && registered.sessionToken, "Verified registration creates session");
  check(f.customers.length === 1 && f.credentials.size === 1, "Verified registration creates one Customer and credential");
  check(f.customers[0].email_id === "buyer@example.com", "Customer identity comes from verified token");
  check(!JSON.stringify([...f.credentials.values()]).includes("Long-test-password"), "Password is hashed before persistence");
  check((await f.service.complete("register", f.details())).error === "invalid_or_expired_token", "Consumed link cannot be replayed");
}
{
  const f = fixture();
  await f.service.request("register", "buyer@example.com");
  const details = f.details();
  const [a,b] = await Promise.all([f.service.complete("register", details), f.service.complete("register", details)]);
  check([a,b].filter((result) => result.ok).length === 1 && f.customers.length === 1, "Concurrent completion creates one Customer");
}
{
  const f = fixture();
  f.access({ user: null, customerNames: ["EXISTING-CONTACT-CUSTOMER"], contacts: [{ email: "buyer@example.com" }] });
  await f.service.request("register", "buyer@example.com");
  await f.service.complete("register", { ...f.details(), email: "other@example.com", customer: "FOREIGN-CUSTOMER" });
  check(f.credentials.get("buyer@example.com").customer === "EXISTING-CONTACT-CUSTOMER" && !f.customers.length, "Existing verified Contact customer reused, forged browser identity ignored");
}
{
  const f = fixture();
  await f.service.request("register", "buyer@example.com");
  const original = f.details();
  const invalid = await f.service.complete("register", { ...original, password: "short" });
  check(invalid.error === "password_length_invalid" && !f.customers.length, "Invalid registration never creates ERP data");
  check((await f.service.complete("reset", original)).error === "invalid_or_expired_token", "Token purpose cannot be swapped");
  f.advance(1800001);
  check((await f.service.complete("register", original)).error === "invalid_or_expired_token", "Expired token fails closed");
}
{
  const f = fixture();
  const responses = [];
  responses.push(await f.service.request("register", "buyer@example.com"));
  const old = f.details();
  responses.push(await f.service.request("register", "buyer@example.com"));
  check(f.deliveries.length === 1, "Per-email cooldown suppresses immediate resend");
  for (let n=0;n<5;n++) { f.advance(61000); responses.push(await f.service.request("register", "buyer@example.com")); }
  check(f.deliveries.length === 5, "Durable per-email hourly limit caps emails");
  check(responses.every((result) => JSON.stringify(result) === JSON.stringify(responses[0])), "Throttling keeps response generic");
  check((await f.service.complete("register", old)).error === "invalid_or_expired_token", "Resend invalidates older token");
}
{
  const f = fixture();
  await f.service.request("register", "buyer@example.com");
  f.credentials.set("buyer@example.com", { customer: "EXISTING", enabled: 0, session_version: 9, password_hash: "unchanged" });
  check((await f.service.complete("register", f.details())).error === "account_already_exists", "Registration never replaces existing disabled credential");
  check(f.credentials.get("buyer@example.com").password_hash === "unchanged", "Existing hash preserved");
  const before = f.deliveries.length;
  const reset = await f.service.request("reset", "buyer@example.com");
  check(reset.ok && f.deliveries.length === before, "Disabled credential reset request is generic and sends nothing");
}
{
  const f = fixture();
  f.credentials.set("buyer@example.com", { customer: "EXISTING", enabled: 1, session_version: 3, password_hash: "old-hash" });
  await f.service.request("reset", "buyer@example.com");
  const result = await f.service.complete("reset", { token: f.token(), password: "New-long-password" });
  check(result.ok && !result.sessionToken, "Reset completes without silently signing in");
  check(f.credentials.get("buyer@example.com").session_version === 4, "Reset revokes previous sessions");
  check((await f.service.complete("reset", { token: f.token(), password: "Another-password" })).error === "invalid_or_expired_token", "Reset token single-use");
}
for (const mutation of ["disabled", "version"]) {
  const f = fixture();
  const credential = { customer: "EXISTING", enabled: 1, session_version: 3, password_hash: "old-hash" };
  f.credentials.set("buyer@example.com", credential);
  await f.service.request("reset", "buyer@example.com");
  if (mutation === "disabled") credential.enabled = 0; else credential.session_version = 4;
  check((await f.service.complete("reset", { token: f.token(), password: "New-long-password" })).error === "invalid_or_expired_token", `Reset cannot override admin ${mutation} change`);
  check(credential.password_hash === "old-hash", "Admin credential state preserved");
}
for (const user of [{ enabled: false, userType: "Website User" }, { enabled: false, userType: "System User" }]) {
  const f = fixture();
  await f.service.request("register", "buyer@example.com");
  f.access({ user, customerNames: ["EXISTING"] });
  check((await f.service.complete("register", f.details())).error === "customer_access_unavailable" && !f.credentials.size, "Disabled ERP users cannot self-register regardless of user type");
}
for (const customerNames of [[], ["EXISTING-CUSTOMER"]]) {
  const f = fixture();
  const user = Object.freeze({ enabled: true, userType: "System User", roles: Object.freeze(["Employee"]), name: "buyer@example.com" });
  const userBefore = JSON.stringify(user);
  f.access({ user, customerNames });
  await f.service.request("register", "buyer@example.com");
  check(f.deliveries.length === 1, "Enabled ERP users receive independent website verification");
  const result = await f.service.complete("register", f.details());
  check(result.ok && f.credentials.get("buyer@example.com")?.enabled === 1, "Enabled ERP user can create separate website credential after mailbox proof");
  check(f.customers.length === (customerNames.length ? 0 : 1), "Existing ERP customer is reused, otherwise only Customer is created");
  check(JSON.stringify(user) === userBefore, "Website registration does not modify ERP User or roles");
}
{
  const f = fixture();
  f.credentials.set("buyer@example.com", { customer: "EXISTING", enabled: 1, session_version: 3, password_hash: "old-hash" });
  await f.service.request("reset", "buyer@example.com");
  f.access({ user: { enabled: false }, customerNames: ["EXISTING"] });
  check((await f.service.complete("reset", { token: f.token(), password: "New-long-password" })).error === "customer_access_unavailable", "Disabled ERP user cannot reset");
}
{
  const f = fixture();
  f.failDelivery();
  const result = await f.service.request("register", "buyer@example.com");
  check(result.ok && [...f.rows.values()][0].token_hash === null, "Delivery failure revokes link and preserves generic response");
  check((await f.service.request("reset", "unknown@example.com")).message === result.message, "Unknown reset email does not disclose account existence");
}
{
  const env = { ACCOUNT_LOGIN_ENABLED: "true", ACCOUNT_SESSION_SECRET: "a".repeat(32), ACCOUNT_SELF_SERVICE_ENABLED: "true", STORE_PUBLIC_URL: "https://testing.greenleafpacific.com", ACCOUNT_EMAIL_FROM: "sales@example.com", SENDGRID_API_KEY: "test-only-key" };
  check(accountSelfServiceConfig(env).registrationEnabled, "Configured HTTPS SendGrid enables self-service");
  check(!accountSelfServiceConfig({ ...env, STORE_PUBLIC_URL: "https://evil.example/path" }).registrationEnabled, "Origin with path rejected");
  check(!accountEmailConfiguration({ ...env, ACCOUNT_EMAIL_TRANSPORT: "outbox", ACCOUNT_EMAIL_OUTBOX: "/private/outbox" }).ready, "Production cannot use capture without explicit test environment");
  check(accountEmailConfiguration({ ACCOUNT_EMAIL_TRANSPORT: "outbox", ACCOUNT_ENVIRONMENT: "test", ACCOUNT_EMAIL_OUTBOX: "/private/outbox" }).ready, "Explicit private test outbox enabled");
  let sent;
  await deliverAccountEmail({ email: "buyer@example.com", purpose: "register", url: "https://testing.greenleafpacific.com/account#register=test" }, {
    env, fetchImpl: async (url, options) => { sent = { url, options }; return { status: 202 }; }
  });
  const body = JSON.parse(sent.options.body);
  check(sent.url === "https://api.sendgrid.com/v3/mail/send" && body.tracking_settings.click_tracking.enable === false, "Email only uses fixed SendGrid URL and disables link tracking");
  await assert.rejects(deliverAccountEmail({ email: "buyer@example.com", purpose: "reset", url: "https://testing.greenleafpacific.com/account#reset=test" }, { env, fetchImpl: async () => ({ status: 401 }) }), /account_email_delivery_failed/);
  checks += 1;
}
console.log(`Account self-service tests passed (${checks} checks).`);
