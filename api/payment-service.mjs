const PAYMENT_PROVIDER = "windcave";
const PAYMENT_INTEGRATION = "hosted_payment_page";
const PAYMENT_CURRENCY = "FJD";
const PAYMENT_LINK_VALIDITY_DAYS = 30;
const SUPPORTED_CARD_BRANDS = ["visa", "mastercard", "american_express"];

function clean(value) {
  return String(value || "").trim();
}

function envFlag(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function paymentEnvironment(apiBaseUrl) {
  return apiBaseUrl.includes("uat.windcave.com") ? "uat" : "production";
}

function paymentCredentials() {
  return {
    apiBaseUrl: clean(process.env.PAYMENT_API_BASE_URL).replace(/\/+$/, ""),
    username: clean(process.env.PAYMENT_API_USERNAME),
    apiKey: clean(process.env.PAYMENT_API_KEY),
    publicUrl: clean(process.env.STORE_PUBLIC_URL).replace(/\/+$/, "")
  };
}

export function getPaymentConfig() {
  const credentials = paymentCredentials();
  const configured = Boolean(
    credentials.apiBaseUrl && credentials.username && credentials.apiKey && credentials.publicUrl
  );
  const activationRequested = envFlag(process.env.PAYMENT_ENABLED);

  return {
    provider: PAYMENT_PROVIDER,
    providerName: "Windcave",
    integration: PAYMENT_INTEGRATION,
    currency: PAYMENT_CURRENCY,
    cardBrands: SUPPORTED_CARD_BRANDS,
    cardDataHandledBy: "windcave",
    pciQuestionnaire: "SAQ A",
    paymentLinkValidityDays: PAYMENT_LINK_VALIDITY_DAYS,
    environment: paymentEnvironment(credentials.apiBaseUrl),
    configured,
    enabled: activationRequested && configured,
    status: activationRequested
      ? configured
        ? "ready_for_uat"
        : "configuration_incomplete"
      : "awaiting_uat_credentials"
  };
}

function requirePaymentCredentials() {
  const config = getPaymentConfig();
  const credentials = paymentCredentials();
  if (!config.enabled) {
    const error = new Error("Windcave HPP is not enabled or fully configured");
    error.code = "windcave_not_ready";
    throw error;
  }
  return { config, credentials };
}

function paymentAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("A positive server-calculated payment amount is required");
    error.code = "invalid_payment_amount";
    throw error;
  }
  return amount.toFixed(2);
}

function paymentReference(value) {
  const reference = clean(value).replace(/[^a-zA-Z0-9._/-]+/g, "-").slice(0, 64);
  if (!reference) {
    const error = new Error("A trusted ERP payment reference is required");
    error.code = "invalid_payment_reference";
    throw error;
  }
  return reference;
}

function windcaveHeaders(username, apiKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`
  };
}

async function readWindcaveResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(`Windcave returned ${response.status}`);
    error.code = "windcave_request_failed";
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export async function createWindcaveHostedSession(payment, fetchImpl = fetch) {
  const { config, credentials } = requirePaymentCredentials();
  const reference = paymentReference(payment.reference);
  const amount = paymentAmount(payment.amount);
  const expires = new Date(Date.now() + config.paymentLinkValidityDays * 24 * 60 * 60 * 1000).toISOString();
  const callbackBase = `${credentials.publicUrl}/payment`;
  const requestBody = {
    type: "purchase",
    amount,
    currency: PAYMENT_CURRENCY,
    merchantReference: reference,
    callbackUrls: {
      approved: `${callbackBase}/approved`,
      declined: `${callbackBase}/declined`,
      cancelled: `${callbackBase}/cancelled`
    },
    notificationUrl: `${credentials.publicUrl}/api/payments/notification`,
    methods: ["card"],
    expires
  };

  const email = clean(payment.customer?.email).toLowerCase();
  const phoneNumber = clean(payment.customer?.phone);
  if (email || phoneNumber) {
    requestBody.customer = {
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {})
    };
  }

  const response = await fetchImpl(`${credentials.apiBaseUrl}/sessions`, {
    method: "POST",
    headers: windcaveHeaders(credentials.username, credentials.apiKey),
    body: JSON.stringify(requestBody)
  });
  const data = await readWindcaveResponse(response);
  const hppUrl = data.links?.find((link) => link.rel === "hpp")?.href;
  const queryUrl = data.links?.find((link) => link.rel === "self")?.href;

  if (!data.id || !hppUrl || !queryUrl) {
    const error = new Error("Windcave did not return a complete HPP session");
    error.code = "invalid_windcave_session";
    throw error;
  }

  return {
    provider: PAYMENT_PROVIDER,
    id: data.id,
    state: data.state || "init",
    hppUrl,
    queryUrl,
    reference,
    amount,
    currency: PAYMENT_CURRENCY,
    expires
  };
}

export async function queryWindcaveHostedSession(sessionId, fetchImpl = fetch) {
  const { credentials } = requirePaymentCredentials();
  const id = clean(sessionId);
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    const error = new Error("Invalid Windcave session id");
    error.code = "invalid_windcave_session_id";
    throw error;
  }

  const response = await fetchImpl(`${credentials.apiBaseUrl}/sessions/${encodeURIComponent(id)}`, {
    headers: windcaveHeaders(credentials.username, credentials.apiKey)
  });
  const data = await readWindcaveResponse(response);
  const transaction = Array.isArray(data.transactions) ? data.transactions[0] : null;

  return {
    provider: PAYMENT_PROVIDER,
    id: data.id || id,
    state: data.state || "unknown",
    reference: data.merchantReference || "",
    amount: data.amount || "",
    currency: data.currency || "",
    authorised: transaction?.authorised === true,
    transactionId: transaction?.id || "",
    responseCode: transaction?.reCo || "",
    responseText: transaction?.responseText || ""
  };
}
