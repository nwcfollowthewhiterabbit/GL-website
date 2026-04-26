const DEFAULT_ERP_BASE_URL = "http://erp-greenleafpacific-local-frontend-1:8080";

export function hasErpnextRestCredentials() {
  return Boolean(process.env.ERPNEXT_API_KEY && process.env.ERPNEXT_API_SECRET);
}

function baseUrl() {
  return (process.env.ERPNEXT_BASE_URL || DEFAULT_ERP_BASE_URL).replace(/\/+$/, "");
}

function headers() {
  const header = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (process.env.ERPNEXT_SITE_NAME) {
    header["X-Frappe-Site-Name"] = process.env.ERPNEXT_SITE_NAME;
  }

  if (hasErpnextRestCredentials()) {
    header.Authorization = `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`;
  }

  return header;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message = payload.exception || payload.exc || payload._server_messages || payload.message || text;
    throw new Error(`ERPNext REST ${response.status}: ${message}`);
  }

  return payload;
}

export async function listDoc(doctype, { filters = [], fields = ["name"], limit = 20 } = {}) {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: String(limit)
  });
  const payload = await request(`/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`);
  return payload.data || [];
}

export async function createDoc(doctype, doc) {
  const payload = await request(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: "POST",
    body: JSON.stringify(doc)
  });
  return payload.data;
}
