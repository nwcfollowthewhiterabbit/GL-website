import { readFile, writeFile, mkdir } from "node:fs/promises";
import { siteProfile, robotsText, sitemapXml, nginxForProfile } from "./site-profile.mjs";

const profile = siteProfile();
const [shell, nginx] = await Promise.all([
  readFile("dist/index.html", "utf8"), readFile("nginx.conf", "utf8")
]);
const indexedShell = shell.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/gi, "")
  .replace("</head>", `<meta name="robots" content="${profile.robots}"><meta name="storefront-origin" content="${profile.publicSiteUrl}"></head>`);
await mkdir("dist/catalog", { recursive: true });
await Promise.all([
  writeFile("dist/catalog/index.html", indexedShell.replace("</head>", `<link rel="canonical" href="${profile.publicSiteUrl}/catalog"></head>`)),
  writeFile("dist/index.html", indexedShell),
  writeFile("dist/robots.txt", robotsText(profile)),
  writeFile("dist/sitemap.xml", sitemapXml(profile)),
  writeFile("nginx.generated.conf", nginxForProfile(nginx, profile))
]);
console.log(`Site profile: ${profile.publicSiteUrl}; indexing ${profile.indexingEnabled ? "enabled" : "disabled"}`);
