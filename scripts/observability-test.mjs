import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  logEvent,
  metricsText,
  recordPaymentOutcome,
  requestMetrics
} from "../api/observability.mjs";

const response = new EventEmitter();
response.statusCode = 202;
let nextCalled = false;
requestMetrics(
  { method: "POST", path: "/api/payments/notification" },
  response,
  () => {
    nextCalled = true;
  }
);
response.emit("finish");
recordPaymentOutcome("approved", "reused");

assert.equal(nextCalled, true);
const metrics = metricsText();
assert.match(metrics, /gl_process_uptime_seconds \d+/);
assert.match(metrics, /gl_http_requests_total\{method="POST",path="\/api\/payments\/notification",status="202"\} 1/);
assert.match(metrics, /gl_http_request_duration_seconds_count\{method="POST",path="\/api\/payments\/notification"\} 1/);
assert.match(metrics, /gl_payment_notifications_total\{effect="reused",outcome="approved"\} 1/);
assert.doesNotMatch(metrics, /\}_count/);

const originalLog = console.log;
let logged = "";
console.log = (value) => {
  logged = String(value);
};
try {
  logEvent("error", "redaction_test", {
    apiKey: "top-secret",
    nested: { authorization: "Bearer secret", safe: "visible" }
  });
} finally {
  console.log = originalLog;
}
const parsed = JSON.parse(logged);
assert.equal(parsed.apiKey, "[REDACTED]");
assert.equal(parsed.nested.authorization, "[REDACTED]");
assert.equal(parsed.nested.safe, "visible");
assert.doesNotMatch(logged, /top-secret|Bearer secret/);

console.log("Observability tests passed.");
