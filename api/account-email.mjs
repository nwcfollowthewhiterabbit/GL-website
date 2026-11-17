import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function accountEmailConfiguration(env = process.env) {
  const transport = env.ACCOUNT_EMAIL_TRANSPORT || "sendgrid";
  if (transport === "outbox") {
    const directory = String(env.ACCOUNT_EMAIL_OUTBOX || "");
    return { transport, directory, ready: env.ACCOUNT_ENVIRONMENT === "test" && path.isAbsolute(directory) };
  }
  const from = String(env.ACCOUNT_EMAIL_FROM || "").trim();
  return {
    transport,
    from,
    ready: transport === "sendgrid" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && Boolean(env.SENDGRID_API_KEY)
  };
}

export async function deliverAccountEmail({ email, purpose, url }, { env = process.env, fetchImpl = fetch } = {}) {
  const config = accountEmailConfiguration(env);
  if (!config.ready) throw new Error("account_email_unavailable");
  const registration = purpose === "register";
  const subject = registration ? "Verify your Green Leaf Pacific account" : "Reset your Green Leaf Pacific password";
  const text = [
    registration ? "Confirm your email to create your Green Leaf Pacific customer account." : "Choose a new password for your Green Leaf Pacific customer account.",
    "", url, "", "This link expires in 30 minutes and can be used once.",
    "If you did not request this email, ignore it. Your account has not been changed.",
    "", "Green Leaf Pacific"
  ].join("\n");
  if (config.transport === "outbox") {
    // Explicit isolated-test transport only. Files contain secrets and belong in a protected mount, never Git/evidence.
    await mkdir(config.directory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(config.directory, `${crypto.randomUUID()}.json`), JSON.stringify({ email, purpose, subject, text, url }), { mode: 0o600, flag: "wx" });
    return;
  }
  const response = await fetchImpl("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: config.from, name: "Green Leaf Pacific" },
      subject,
      content: [{ type: "text/plain", value: text }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } }
    })
  });
  if (response.status !== 202) throw new Error("account_email_delivery_failed");
}
