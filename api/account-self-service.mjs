import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { getErpPool, getErpDbConfig } from "./erpnext-db.mjs";
import { createDoc } from "./erpnext-rest.mjs";
import { assertWebsiteMigrationsApplied } from "./migrations/runner.mjs";
import { createAccountSessionToken, hashWebsitePassword, isAccountLoginAvailable, normalizeAccountEmail, sameAccountEmail, resolveCustomerAccessByEmail } from "./account-service.mjs";
import { accountEmailConfiguration, deliverAccountEmail } from "./account-email.mjs";
import { logEvent } from "./observability.mjs";
import { legacySyncRules } from "./legacy-sync-rules.mjs";

const TABLE = "tabWebsite Account Challenge";
const CREDENTIALS = "tabWebsite Customer Credential";
const TOKEN_TTL = 30 * 60 * 1000;
const REQUEST_WINDOW = 60 * 60 * 1000;
const REQUEST_COOLDOWN = 60 * 1000;
const GENERIC_MESSAGE = "If this email is eligible, an email with the next steps will arrive shortly. Check your spam folder too.";
const clean = (value) => String(value || "").trim();
const normalizeEmail = normalizeAccountEmail;
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sqlDate = (value) => new Date(value).toISOString().slice(0, 23).replace("T", " ");
const time = (value) => value ? new Date(value).getTime() : 0;
const invalidToken = () => ({ ok: false, error: "invalid_or_expired_token" });

export function accountSelfServiceConfig(env = process.env) {
  let validOrigin = false;
  try {
    const origin = new URL(env.STORE_PUBLIC_URL);
    validOrigin = !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash &&
      (origin.protocol === "https:" || (env.ACCOUNT_ENVIRONMENT === "test" && origin.protocol === "http:"));
  } catch { /* Fail closed for invalid origin. */ }
  const loginEnabled = env === process.env ? isAccountLoginAvailable() : env.ACCOUNT_LOGIN_ENABLED === "true" && String(env.ACCOUNT_SESSION_SECRET || "").length >= 32;
  const ready = loginEnabled && env.ACCOUNT_SELF_SERVICE_ENABLED === "true" && validOrigin && accountEmailConfiguration(env).ready;
  return { loginEnabled, registrationEnabled: ready, passwordResetEnabled: ready };
}

export function accountChallengeUsable(challenge, purpose, tokenHash, now = Date.now()) {
  return Boolean(challenge && challenge.purpose === purpose && challenge.token_hash === tokenHash &&
    !challenge.consumed_at && time(challenge.expires_at) > now);
}

export function accountRequestThrottled(challenge, now = Date.now()) {
  if (!challenge) return false;
  return now - time(challenge.last_requested_at) < REQUEST_COOLDOWN ||
    (now - time(challenge.window_started_at) < REQUEST_WINDOW && Number(challenge.request_count) >= 5);
}

function tokenColumns() {
  return "name, email, purpose, token_hash, credential_version, request_count, " +
    ["expires_at", "consumed_at", "last_requested_at", "window_started_at"].map((field) => `DATE_FORMAT(${field}, '%Y-%m-%dT%H:%i:%s.%fZ') AS ${field}`).join(", ");
}

export function createAccountChallengeStore(pool = getErpPool()) {
  return {
    async withEmailLock(email, operation) {
      const { connectionLimit, waitForConnections, ...connectionConfig } = getErpDbConfig();
      const connection = await mysql.createConnection(connectionConfig);
      const lock = `glaccount:${digest(email).slice(0, 48)}`;
      let acquired = false;
      try {
        const [rows] = await connection.execute("SELECT GET_LOCK(:lock, 10) AS acquired", { lock });
        acquired = Number(rows[0]?.acquired) === 1;
        if (!acquired) throw new Error("account_request_busy");
        return await operation();
      } finally {
        if (acquired) await connection.execute("SELECT RELEASE_LOCK(:lock)", { lock }).catch(() => undefined);
        await connection.end();
      }
    },
    async credential(email) {
      const [rows] = await pool.execute(`SELECT customer, email, enabled, session_version FROM \`${CREDENTIALS}\` WHERE BINARY LOWER(email) = BINARY :email LIMIT 1`, { email });
      return rows[0] && sameAccountEmail(rows[0].email, email) ? rows[0] : null;
    },
    async challenge(email, purpose) {
      const [rows] = await pool.execute(`SELECT ${tokenColumns()} FROM \`${TABLE}\` WHERE name = :name LIMIT 1`, { name: digest(`${purpose}:${email}`) });
      return rows[0] || null;
    },
    async token(tokenHash) {
      const [rows] = await pool.execute(`SELECT ${tokenColumns()} FROM \`${TABLE}\` WHERE token_hash = :tokenHash LIMIT 1`, { tokenHash });
      return rows[0] || null;
    },
    async issue({ email, purpose, tokenHash, credentialVersion, now, previous }) {
      const resetWindow = !previous || now - time(previous.window_started_at) >= REQUEST_WINDOW;
      await pool.execute(`INSERT INTO \`${TABLE}\`
        (name,email,purpose,token_hash,expires_at,consumed_at,credential_version,last_requested_at,window_started_at,request_count)
        VALUES (:name,:email,:purpose,:tokenHash,:expires,NULL,:version,:now,:window,:count)
        ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at),consumed_at=NULL,
        credential_version=VALUES(credential_version),last_requested_at=VALUES(last_requested_at),
        window_started_at=VALUES(window_started_at),request_count=VALUES(request_count)`, {
        name: digest(`${purpose}:${email}`), email, purpose, tokenHash, expires: sqlDate(now + TOKEN_TTL),
        version: credentialVersion, now: sqlDate(now), window: resetWindow ? sqlDate(now) : sqlDate(time(previous.window_started_at)),
        count: resetWindow ? 1 : Number(previous.request_count) + 1
      });
    },
    async invalidate(tokenHash, now) {
      await pool.execute(`UPDATE \`${TABLE}\` SET consumed_at=:now,token_hash=NULL WHERE token_hash=:tokenHash`, { now: sqlDate(now), tokenHash });
    },
    async finish(challenge, { customer, passwordHash, now }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(`SELECT ${tokenColumns()} FROM \`${TABLE}\` WHERE name=:name FOR UPDATE`, { name: challenge.name });
        if (!accountChallengeUsable(rows[0], challenge.purpose, challenge.token_hash, now)) {
          await connection.rollback();
          return invalidToken();
        }
        if (challenge.purpose === "register") {
          await connection.execute(`INSERT INTO \`${CREDENTIALS}\`
            (name,creation,modified,modified_by,owner,docstatus,idx,customer,email,password_hash,enabled,session_version)
            VALUES (:name,:now,:now,'Administrator','Administrator',0,0,:customer,:email,:passwordHash,1,1)`, {
            name: `website-credential-${digest(challenge.email).slice(0, 32)}`, now: sqlDate(now), customer, email: challenge.email, passwordHash
          });
        } else {
          const [updated] = await connection.execute(`UPDATE \`${CREDENTIALS}\` SET password_hash=:passwordHash,modified=:now,
            session_version=session_version+1 WHERE BINARY LOWER(email)=BINARY :email AND enabled=1 AND session_version=:version`, {
            email: challenge.email, passwordHash, now: sqlDate(now), version: challenge.credential_version
          });
          if (updated.affectedRows !== 1) {
            await connection.rollback();
            return invalidToken();
          }
        }
        await connection.execute(`UPDATE \`${TABLE}\` SET consumed_at=:now,token_hash=NULL WHERE name=:name`, { now: sqlDate(now), name: challenge.name });
        await connection.commit();
        return { ok: true };
      } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") return { ok: false, error: "account_already_exists" };
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

export function createAccountSelfService({
  store,
  deliver = deliverAccountEmail,
  resolveAccess = resolveCustomerAccessByEmail,
  createCustomer = (data) => createDoc("Customer", data),
  hashPassword = hashWebsitePassword,
  config = accountSelfServiceConfig,
  now = Date.now,
  origin = () => process.env.STORE_PUBLIC_URL,
  onDeliveryError = () => logEvent("error", "account_email_delivery_failed", { code: "account_email_delivery_failed" })
} = {}) {
  const getStore = () => store || createAccountChallengeStore();
  return {
    async request(purpose, emailValue) {
      if (!["register", "reset"].includes(purpose)) return { ok: false, error: "invalid_request" };
      if (!config().registrationEnabled) return { ok: false, error: "self_service_unavailable" };
      const email = normalizeEmail(emailValue);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 140) return { ok: false, error: "invalid_email" };
      const db = getStore();
      return db.withEmailLock(email, async () => {
        const previous = await db.challenge(email, purpose);
        if (accountRequestThrottled(previous, now())) return { ok: true, message: GENERIC_MESSAGE };
        const credential = await db.credential(email);
        const eligible = purpose === "register" ? !credential : credential && Number(credential.enabled) === 1;
        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = digest(token);
        await db.issue({ email, purpose, tokenHash, credentialVersion: Number(credential?.session_version || 0), now: now(), previous });
        if (eligible) {
          const access = await resolveAccess(email);
          if (!access.user || (access.user.enabled && (purpose !== "register" || access.user.userType !== "System User"))) {
            const url = new URL("/account", origin());
            url.hash = `${purpose}=${token}`;
            try {
              await deliver({ email, purpose, url: url.toString() });
            } catch {
              await db.invalidate(tokenHash, now());
              onDeliveryError();
            }
          } else {
            await db.invalidate(tokenHash, now());
          }
        } else {
          await db.invalidate(tokenHash, now());
        }
        return { ok: true, message: GENERIC_MESSAGE };
      });
    },
    async complete(purpose, payload = {}) {
      if (!config().registrationEnabled) return { ok: false, error: "self_service_unavailable" };
      const token = clean(payload.token);
      if (!["register", "reset"].includes(purpose) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return invalidToken();
      const password = String(payload.password || "");
      if (password.length < 10 || password.length > 128) return { ok: false, error: "password_length_invalid", minLength: 10, maxLength: 128 };
      const company = clean(payload.company);
      const contact = clean(payload.contact || [payload.firstName, payload.lastName].filter(Boolean).join(" "));
      const phone = clean(payload.phone);
      if (purpose === "register" && (!company || !contact || !phone || company.length > 140 || contact.length > 140 || phone.length > 50)) {
        return { ok: false, error: "customer_details_required" };
      }
      const db = getStore();
      const tokenHash = digest(token);
      const initial = await db.token(tokenHash);
      if (!accountChallengeUsable(initial, purpose, tokenHash, now())) return invalidToken();
      return db.withEmailLock(initial.email, async () => {
        const challenge = await db.token(tokenHash);
        if (!accountChallengeUsable(challenge, purpose, tokenHash, now())) return invalidToken();
        const credential = await db.credential(challenge.email);
        if (purpose === "register" && credential) return { ok: false, error: "account_already_exists" };
        if (purpose === "reset" && (!credential || Number(credential.enabled) !== 1 || Number(credential.session_version) !== Number(challenge.credential_version))) return invalidToken();
        const access = await resolveAccess(challenge.email);
        if (access.user && (!access.user.enabled || (purpose === "register" && access.user.userType === "System User"))) return { ok: false, error: "customer_access_unavailable" };
        let customer = purpose === "reset" ? credential.customer : access.customerNames?.[0];
        // Never accept Customer IDs or email from the completing browser. The verified token is the identity.
        if (!customer && purpose === "register") {
          const created = await createCustomer({
            customer_name: company,
            customer_group: process.env.ERP_CUSTOMER_GROUP || legacySyncRules.quote.defaults.customerGroup,
            territory: process.env.ERP_TERRITORY || legacySyncRules.quote.defaults.territory,
            customer_type: "Company",
            email_id: challenge.email,
            mobile_no: phone,
            website_origin: "greenleaf-storefront"
          });
          customer = created.name;
        }
        if (!customer) return { ok: false, error: "customer_access_unavailable" };
        const result = await db.finish(challenge, { customer, passwordHash: await hashPassword(password), now: now() });
        if (!result.ok) return result;
        return purpose === "register"
          ? { ok: true, email: challenge.email, sessionToken: createAccountSessionToken(challenge.email, 1) }
          : { ok: true };
      });
    }
  };
}

const service = createAccountSelfService();
export async function requestAccountEmail(purpose, email) {
  await assertWebsiteMigrationsApplied();
  return service.request(purpose, email);
}
export async function completeAccountEmail(purpose, payload) {
  await assertWebsiteMigrationsApplied();
  return service.complete(purpose, payload);
}
