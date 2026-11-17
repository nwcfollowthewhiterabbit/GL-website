import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { siteProfile, robotsText, sitemapXml, nginxForProfile } from "./site-profile.mjs";
import { quoteTransactionDate } from "../api/quote-service.mjs";

const testing = siteProfile({});
assert.equal(testing.publicSiteUrl, "https://testing.greenleafpacific.com");
assert.equal(testing.indexingEnabled, false);
assert.match(robotsText(testing), /Disallow: \/\n/);
assert.match(sitemapXml(testing), /https:\/\/testing\.greenleafpacific\.com\/how-we-operate/);

const production = siteProfile({ PUBLIC_SITE_URL: "https://greenleafpacific.com/", SITE_INDEXING_ENABLED: "true" });
assert.equal(production.publicSiteUrl, "https://greenleafpacific.com");
assert.equal(production.indexingEnabled, true);
assert.match(robotsText(production), /Disallow: \/api\//);
assert.match(robotsText(production), /Sitemap: https:\/\/greenleafpacific\.com\/sitemap.xml/);
assert.doesNotMatch(robotsText(production), /Disallow: \/\n/);
assert.doesNotMatch(sitemapXml(production), /testing\./);
const nginx = await readFile(new URL("../nginx.conf", import.meta.url), "utf8");
assert.match(nginxForProfile(nginx, production), /X-Robots-Tag "index, follow"/);
assert.match(nginxForProfile(nginx, testing), /X-Robots-Tag "noindex, nofollow, noarchive"/);
for (const origin of ["javascript:alert(1)", "https://greenleafpacific.com/path", "https://greenleafpacific.com/?x=1"]) {
  assert.throws(() => siteProfile({ PUBLIC_SITE_URL: origin }));
}
const userInfoUrl = new URL("https://greenleafpacific.com");
userInfoUrl.username = "invalid-user-info";
assert.throws(() => siteProfile({ PUBLIC_SITE_URL: userInfoUrl.href }));
assert.throws(() => siteProfile({ SITE_INDEXING_ENABLED: "true" }));
assert.throws(() => siteProfile({ PUBLIC_SITE_URL: "http://greenleafpacific.com", SITE_INDEXING_ENABLED: "true" }));
assert.throws(() => siteProfile({ SITE_INDEXING_ENABLED: "yes" }));

assert.equal(quoteTransactionDate(new Date("2026-11-17T11:59:59Z"), "Pacific/Fiji"), "2026-11-17");
assert.equal(quoteTransactionDate(new Date("2026-11-17T12:00:00Z"), "Pacific/Fiji"), "2026-11-18");
assert.equal(quoteTransactionDate(new Date("2028-02-28T12:00:00Z"), "Pacific/Fiji"), "2028-02-29");
assert.equal(quoteTransactionDate(new Date("2026-11-17T12:00:00Z"), "UTC"), "2026-11-17");
assert.throws(() => quoteTransactionDate(new Date(), "Invalid/TimeZone"));
console.log("Production/testing site profiles and ERP local-date boundaries passed.");
