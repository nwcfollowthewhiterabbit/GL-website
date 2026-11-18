const DEFAULT_SITE_URL = "https://testing.greenleafpacific.com";

export const SITEMAP_PATHS = [
  "/catalog", "/about-us", "/how-we-operate", "/privacy", "/terms",
  "/shipping", "/returns", "/payment-security"
];

export function siteProfile(environment = process.env) {
  const value = String(environment.PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim();
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !["", "/"].includes(url.pathname) || url.search || url.hash) {
    throw new Error("PUBLIC_SITE_URL must be a public HTTP(S) origin without credentials or a path");
  }
  const indexingValue = String(environment.SITE_INDEXING_ENABLED || "false");
  if (!["true", "false"].includes(indexingValue)) {
    throw new Error("SITE_INDEXING_ENABLED must be true or false");
  }
  const indexingEnabled = indexingValue === "true";
  if (indexingEnabled && (url.protocol !== "https:" || /(^|[.-])(testing|staging|localhost)([.-]|$)/i.test(url.hostname))) {
    throw new Error("Search indexing is only permitted for an explicit production HTTPS origin");
  }
  return { publicSiteUrl: url.origin, indexingEnabled,
    robots: indexingEnabled ? "index, follow" : "noindex, nofollow, noarchive" };
}

export function robotsText(profile) {
  return profile.indexingEnabled
    ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nSitemap: ${profile.publicSiteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
}

export function sitemapXml(profile, productPaths = []) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...SITEMAP_PATHS, ...productPaths].map((path) => `  <url><loc>${profile.publicSiteUrl}${path}</loc></url>`).join("\n") +
    "\n</urlset>\n";
}

export function nginxForProfile(template, profile) {
  const pattern = /^  add_header X-Robots-Tag .*$/gm;
  if ((template.match(pattern) || []).length !== 1) {
    throw new Error("Expected exactly one nginx indexing header");
  }
  return template.replaceAll("__PUBLIC_SITE_URL__", profile.publicSiteUrl).replace(pattern, `  add_header X-Robots-Tag "${profile.robots}" always;`);
}
