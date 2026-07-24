import "dotenv/config";

const internalUrl = String(process.env.MONITOR_INTERNAL_URL || "http://api:3000").replace(/\/+$/, "");
const intervalMs = Math.max(30, Number(process.env.MONITOR_INTERVAL_SECONDS || 60)) * 1000;
const webhookUrl = String(process.env.ALERT_WEBHOOK_URL || "").trim();
const webhookToken = String(process.env.ALERT_WEBHOOK_BEARER_TOKEN || "").trim();
const runOnce = process.argv.includes("--once");
let previousFingerprint = "";

function log(level, event, fields = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }));
}

async function readJson(path) {
  const response = await fetch(`${internalUrl}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function deliverAlert(alert) {
  if (!webhookUrl) {
    log("error", "runtime_alert", alert);
    return;
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
    },
    body: JSON.stringify({ service: "green-leaf-testing-website", ...alert }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`alert webhook returned HTTP ${response.status}`);
}

export async function checkRuntime() {
  const failures = [];
  try {
    const health = await readJson("/health");
    if (health.ok !== true) failures.push("api_health_failed");
  } catch (error) {
    failures.push(error.message);
  }
  try {
    const diagnostics = await readJson("/api/storefront/diagnostics");
    if (diagnostics.healthy !== true) failures.push("storefront_content_degraded");
  } catch (error) {
    failures.push(error.message);
  }
  try {
    const payment = await readJson("/api/payments/config");
    if (payment.enabled && payment.status !== "ready_for_uat") failures.push("payment_configuration_inconsistent");
  } catch (error) {
    failures.push(error.message);
  }

  const fingerprint = failures.sort().join("|");
  if (failures.length && fingerprint !== previousFingerprint) {
    await deliverAlert({ severity: "critical", failures });
  } else if (!failures.length && previousFingerprint) {
    await deliverAlert({ severity: "recovery", failures: [] });
  }
  previousFingerprint = fingerprint;
  log(failures.length ? "error" : "info", "runtime_monitor_check", {
    ok: failures.length === 0,
    failureCount: failures.length
  });
  return failures;
}

do {
  await checkRuntime().catch((error) => log("error", "runtime_monitor_error", { message: error.message }));
  if (runOnce) break;
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
} while (true);
