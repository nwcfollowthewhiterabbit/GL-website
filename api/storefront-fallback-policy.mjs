const MODES = new Set(["allow", "warn", "deny"]);

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

export function getStorefrontFallbackMode(value = process.env.STOREFRONT_FALLBACK_MODE) {
  const mode = clean(value) || "warn";
  return MODES.has(mode) ? mode : "warn";
}

export function storefrontSourceStatus(sourceValue) {
  const source = clean(sourceValue);
  if (source.startsWith("erp_") && !source.endsWith("_empty")) return "erp";
  if (source.includes("empty")) return "empty";
  return "fallback";
}

export function applyStorefrontFallbackPolicy(resource, resourceName, modeValue) {
  const mode = getStorefrontFallbackMode(modeValue);
  const status = storefrontSourceStatus(resource?.source);
  if (mode === "deny" && status !== "erp") {
    const error = new Error(`ERP storefront resource ${resourceName} is unavailable`);
    error.code = "storefront_fallback_denied";
    error.resource = resourceName;
    error.source = resource?.source || "unknown";
    throw error;
  }

  return {
    ...resource,
    fallback: {
      mode,
      status,
      degraded: status !== "erp"
    }
  };
}

export function createStorefrontDiagnostics(resources, modeValue) {
  const mode = getStorefrontFallbackMode(modeValue);
  const entries = Object.fromEntries(
    Object.entries(resources).map(([name, resource]) => {
      const status = storefrontSourceStatus(resource?.source);
      return [
        name,
        {
          source: resource?.source || "unavailable",
          status,
          degraded: status !== "erp"
        }
      ];
    })
  );

  return {
    mode,
    healthy: Object.values(entries).every((entry) => !entry.degraded),
    resources: entries
  };
}
