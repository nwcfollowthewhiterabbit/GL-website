import crypto from "node:crypto";
import { rateLimit } from "express-rate-limit";

function allowedOrigins() {
  return new Set(
    [process.env.STORE_PUBLIC_URL, ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",")]
      .map((value) => String(value || "").trim().replace(/\/+$/, ""))
      .filter(Boolean)
  );
}

export const corsOptions = {
  methods: ["GET", "HEAD", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins().has(origin.replace(/\/+$/, "")));
  }
};

function limiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: message }
  });
}

export const accountLoginLimiter = limiter(8, "account_login_rate_limited");
export const quoteRequestLimiter = limiter(20, "quote_request_rate_limited");
export const paymentNotificationLimiter = limiter(60, "payment_notification_rate_limited");
export const paymentSessionLimiter = limiter(10, "payment_session_rate_limited");
export const adminLimiter = limiter(60, "admin_rate_limited");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdminToken(req, res, next) {
  const configuredToken = String(process.env.ADMIN_API_TOKEN || "").trim();
  if (configuredToken.length < 32) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const authorization = String(req.headers.authorization || "");
  const suppliedToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!safeEqual(configuredToken, suppliedToken)) {
    res.status(401).json({ error: "admin_authentication_required" });
    return;
  }

  next();
}
