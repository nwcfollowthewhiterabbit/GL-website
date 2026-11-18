// Isolated stage only. Requires protected outbox transport; never follows links to a different origin.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = new URL(process.env.CUSTOMER_E2E_BASE_URL || "http://127.0.0.1:18494");
const outbox = process.env.ACCOUNT_EMAIL_OUTBOX || "";
const receiptPath = process.env.CUSTOMER_E2E_RECEIPT || "";
const browserFixture = process.env.CUSTOMER_E2E_BROWSER_FIXTURE || "";
const repositoryRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
if (browserFixture) {
  assert.ok(path.isAbsolute(browserFixture), "Browser fixture requires absolute protected path");
  assert.ok(!path.resolve(browserFixture).startsWith(`${repositoryRoot}${path.sep}`), "Secret browser fixture must stay outside source repository");
}
assert.equal(process.env.ACCOUNT_ENVIRONMENT, "test", "Explicit isolated test environment required");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Only loopback test targets allowed");
assert.ok(path.isAbsolute(outbox) && path.isAbsolute(receiptPath), "Private absolute outbox and receipt paths required");
const runId = process.env.CUSTOMER_E2E_RUN_ID || `GL-WEB-E2E-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
assert.match(runId, /^GL-WEB-E2E-[A-Za-z0-9-]{1,60}$/);
const receipt = { runId, baseUrl: base.origin, startedAt: new Date().toISOString(), checks: [], owned: { accounts: [], quotations: [] }, cleanupRequired: true };
const password = crypto.randomBytes(24).toString("base64url");
const replacementPassword = crypto.randomBytes(24).toString("base64url");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quoteName = (body) => typeof body.quotation === "string" ? body.quotation : body.quotation?.name;

function check(name, condition) {
  receipt.checks.push({ name, passed: Boolean(condition) });
  assert.ok(condition, name);
}
async function call(route, { cookie, body, expected = 200 } = {}) {
  const response = await fetch(new URL(route, base), {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  check(`${route}: HTTP ${expected}`, response.status === expected);
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
}
async function emailToken(email, purpose) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const messages = [];
    for (const filename of await readdir(outbox)) {
      if (!filename.endsWith(".json")) continue;
      const message = JSON.parse(await readFile(path.join(outbox, filename), "utf8"));
      if (message.email === email && message.purpose === purpose) messages.push(message);
    }
    if (messages.length) {
      const url = new URL(messages.at(-1).url);
      check(`Email ${purpose}: fragment purpose`, url.hash.startsWith(`#${purpose}=`));
      return url.hash.slice(purpose.length + 2);
    }
    await sleep(200);
  }
  throw new Error(`Captured ${purpose} email was not delivered`);
}
async function register(label) {
  const email = `${runId.toLowerCase()}-${label}@example.invalid`;
  const company = `${runId} ${label}`;
  const account = { email, company };
  receipt.owned.accounts.push(account);
  const requested = await call("/api/account/register/request", { body: { email } });
  check("Registration request generic success", requested.data.ok && !requested.data.token);
  const token = await emailToken(email, "register");
  const completed = await call("/api/account/register/complete", { body: { token, password, company, contact: "Synthetic E2E Buyer", phone: "+6790000000" } });
  check("Registration establishes cookie", completed.data.ok && completed.cookie?.startsWith("gl_account_session="));
  const cookieHeader = completed.headers.get("set-cookie") || "";
  check("Secure HttpOnly SameSite cookie", /Secure/i.test(cookieHeader) && /HttpOnly/i.test(cookieHeader) && /SameSite=Lax/i.test(cookieHeader));
  const session = await call("/api/account/session", { cookie: completed.cookie });
  check("Verified account identity", session.data.account?.email === email);
  check("Account responses not cached", session.headers.get("cache-control")?.includes("no-store"));
  account.customer = session.data.account?.profile?.name;
  check("Registered Customer linked", Boolean(account.customer));
  await call("/api/account/register/complete", { body: { token, password, company, contact: "Synthetic E2E Buyer", phone: "+6790000000" }, expected: 400 });
  const login = await call("/api/account/login", { body: { email, password } });
  return { ...account, cookie: login.cookie };
}
try {
  const features = await call("/api/account/config");
  check("Registration and reset enabled", features.data.registrationEnabled && features.data.passwordResetEnabled);
  const payments = await call("/api/payments/config");
  check("Online payments disabled", payments.data.enabled === false);
  const catalog = await call("/api/catalog/products?page=1&pageSize=1");
  const { sku, uom, packingUnit } = catalog.data.products?.[0] || {};
  const qty = Math.max(1, Number(packingUnit || 1));
  check("Real ERP catalog SKU available", Boolean(sku && uom));
  receipt.sku = sku;
  await call("/api/quote-requests", { body: { lines: [{ sku, qty: 1 }] }, expected: 401 });
  const first = await register("a");
  const second = await register("b");
  const payload = (account, suffix) => ({
    id: `${runId}-${suffix}`,
    customer: { company: account.company, contact: "Synthetic E2E Buyer", email: account.email, phone: "+6790000000", location: "Isolated E2E test only" },
    lines: [{ sku, uom, qty }],
    notes: `${runId}: synthetic quotation, do not fulfill or send`
  });
  const created = await call("/api/quote-requests", { cookie: first.cookie, body: payload(first, "q1"), expected: 201 });
  const name = quoteName(created.data);
  check("Draft quotation created", Boolean(name) && created.data.mode === "created");
  receipt.owned.quotations.push(name);
  const replay = await call("/api/quote-requests", { cookie: first.cookie, body: payload(first, "q1") });
  check("Quote retry returns existing reference", quoteName(replay.data) === name && replay.data.mode === "idempotent");
  await call("/api/quote-requests", { cookie: first.cookie, body: { ...payload(first, "q2"), customer: payload(second, "q2").customer }, expected: 422 });
  const bad = payload(first, "bad"); bad.lines.push({ sku: `${runId}-NO-SUCH-SKU`, qty: 1 });
  const invalid = await call("/api/quote-requests", { cookie: first.cookie, body: bad, expected: 422 });
  check("Invalid basket has no quotation", !invalid.data.quotation);
  const detail = await call(`/api/account/quotes/${encodeURIComponent(name)}`, { cookie: first.cookie });
  check("Own quotation status and lines visible", detail.data.quote?.status === "Draft" && detail.data.quote?.lines?.[0]?.itemCode === sku);
  const line = detail.data.quote.lines[0];
  check("Stored selling unit and quantity match the basket", line.uom === uom && Number(line.qty) === qty);
  check("Draft status and quote receipts keep ERP amounts private",
    !("grandTotal" in detail.data.quote) && !("rate" in line) && !("amount" in line) &&
    [created, replay].every(({ data }) => !("rate" in data.validLines[0]) && !("grand_total" in data.quotation)));
  await call(`/api/account/quotes/${encodeURIComponent(name)}`, { cookie: second.cookie, expected: 404 });
  const foreign = await call("/api/quote-requests", { cookie: second.cookie, body: payload(second, "q3"), expected: 201 });
  const foreignName = quoteName(foreign.data);
  receipt.owned.quotations.push(foreignName);
  await call(`/api/account/quotes/${encodeURIComponent(foreignName)}`, { cookie: first.cookie, expected: 404 });
  const history = await call("/api/account/quotes?limit=1&offset=0", { cookie: first.cookie });
  check("History contains own quote only", history.data.quotes?.length === 1 && history.data.quotes[0].name === name && history.data.hasMore === false);
  const next = await call("/api/account/quotes?limit=1&offset=1", { cookie: first.cookie });
  check("History offset honored", next.data.quotes?.length === 0);
  for (const kind of ["orders", "invoices"]) {
    const result = await call(`/api/account/${kind}?limit=1&offset=0`, { cookie: first.cookie });
    check(`${kind} scoped history available`, Array.isArray(result.data[kind]));
  }
  await call("/api/account/password-reset/request", { body: { email: first.email } });
  const resetToken = await emailToken(first.email, "reset");
  await call("/api/account/password-reset/complete", { body: { token: resetToken, password: replacementPassword } });
  await call("/api/account/session", { cookie: first.cookie, expected: 401 });
  await call("/api/account/login", { body: { email: first.email, password }, expected: 401 });
  const newLogin = await call("/api/account/login", { body: { email: first.email, password: replacementPassword } });
  const restored = await call("/api/account/session", { cookie: newLogin.cookie });
  check("Reset retains customer and quotation history", restored.data.account?.profile?.name === first.customer && restored.data.account?.quotes?.some((quote) => quote.name === name));
  await call("/api/account/password-reset/complete", { body: { token: resetToken, password }, expected: 400 });
  const logout = await call("/api/account/logout", { cookie: newLogin.cookie, body: {} });
  check("Logout expires cookie", /Expires=Thu, 01 Jan 1970/i.test(logout.headers.get("set-cookie") || ""));
  if (browserFixture) {
    await writeFile(browserFixture, JSON.stringify({ runId, baseUrl: base.origin, email: first.email, password: replacementPassword, customer: first.customer, quotation: name }) + "\n", { mode: 0o600, flag: "wx" });
    receipt.browserFixture = browserFixture;
  }
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error.message).slice(0, 500);
  process.exitCode = 1;
} finally {
  receipt.completedAt = new Date().toISOString();
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ passed: receipt.passed, runId, checks: receipt.checks.length, receipt: receiptPath, cleanupRequired: true }));
}
