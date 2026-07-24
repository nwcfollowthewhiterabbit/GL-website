const startedAt = Date.now();
const counters = new Map();
const durations = new Map();

function metricKey(name, labels = {}) {
  const serialized = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)
    .join(",");
  return serialized ? `${name}{${serialized}}` : name;
}

function increment(name, labels, value = 1) {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + value);
}

function normalizePath(pathValue) {
  return String(pathValue || "")
    .split("?")[0]
    .replace(/\/(?:GLQ|QTN|SINV|SO)-[A-Za-z0-9._-]+/g, "/:document")
    .replace(/\/[a-f0-9]{24,}/gi, "/:id");
}

function requestPath(req) {
  if (req.route?.path) return `${req.baseUrl || ""}${req.route.path}`;
  return normalizePath(req.path);
}

export function requestMetrics(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const labels = {
      method: req.method,
      path: requestPath(req),
      status: res.statusCode
    };
    increment("gl_http_requests_total", labels);
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const key = metricKey("gl_http_request_duration_seconds", {
      method: req.method,
      path: requestPath(req)
    });
    const current = durations.get(key) || { count: 0, sum: 0 };
    durations.set(key, { count: current.count + 1, sum: current.sum + seconds });
  });
  next();
}

export function recordPaymentOutcome(outcome, effect) {
  increment("gl_payment_notifications_total", {
    outcome: outcome || "unknown",
    effect: effect || "unknown"
  });
}

export function logEvent(level, event, fields = {}) {
  const redact = (value, key = "") => {
    if (/secret|password|token|api.?key|authorization/i.test(key)) return "[REDACTED]";
    if (Array.isArray(value)) return value.map((item) => redact(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
    }
    return value;
  };
  const safeFields = redact(fields);
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields
  }));
}

export function metricsText() {
  const lines = [
    "# HELP gl_process_uptime_seconds API process uptime.",
    "# TYPE gl_process_uptime_seconds gauge",
    `gl_process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
    "# TYPE gl_http_requests_total counter"
  ];
  for (const [key, value] of [...counters.entries()].sort()) lines.push(`${key} ${value}`);
  lines.push("# TYPE gl_http_request_duration_seconds summary");
  for (const [key, value] of [...durations.entries()].sort()) {
    const brace = key.indexOf("{");
    const name = brace === -1 ? key : key.slice(0, brace);
    const labels = brace === -1 ? "" : key.slice(brace);
    lines.push(`${name}_count${labels} ${value.count}`);
    lines.push(`${name}_sum${labels} ${value.sum.toFixed(6)}`);
  }
  return `${lines.join("\n")}\n`;
}
