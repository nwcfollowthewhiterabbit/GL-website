import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { howWeOperateContent } from "../src/data/editorialContent.mjs";

const publicSiteUrl = (process.env.PUBLIC_SITE_URL || "https://testing.greenleafpacific.com").replace(/\/+$/, "");
const shellPath = path.resolve("dist/index.html");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function structuredData(route) {
  const common = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `${publicSiteUrl}${route.path}`,
    name: route.title,
    description: route.description,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "Green Leaf Ltd",
      alternateName: "Green Leaf Pacific",
      url: publicSiteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${publicSiteUrl}/legacy/greenleaf-logo.png`
      }
    }
  };

  if (route.path === howWeOperateContent.canonicalPath) {
    common.primaryImageOfPage = {
      "@type": "ImageObject",
      url: `${publicSiteUrl}/assets/greenleaf-operations-hero.jpg`,
      caption: "A completed Green Leaf hospitality joinery project in operation"
    };
  }

  return common;
}

function injectHead(shell, route) {
  const canonicalUrl = `${publicSiteUrl}${route.path}`;
  const schema = JSON.stringify(structuredData(route)).replaceAll("<", "\\u003c");
  const metadata = [
    `<meta name="description" content="${escapeHtml(route.description)}">`,
    '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Green Leaf Pacific">`,
    `<meta property="og:title" content="${escapeHtml(route.title)}">`,
    `<meta property="og:description" content="${escapeHtml(route.description)}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:image" content="${publicSiteUrl}/assets/greenleaf-operations-hero.jpg">`,
    `<script type="application/ld+json">${schema}</script>`
  ].join("");

  return shell
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(route.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, "")
    .replace("</head>", `${metadata}</head>`);
}

const routes = [
  {
    path: howWeOperateContent.canonicalPath,
    route: { view: "how-we-operate" },
    title: howWeOperateContent.title,
    description: howWeOperateContent.description
  },
  {
    path: "/about-us",
    route: { view: "about" },
    title: "About Green Leaf Pacific",
    description:
      "Learn about Green Leaf Pacific, its hospitality supply operations in Fiji and the connected systems supporting customers from quotation to after-sales service."
  }
];

const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "error",
  plugins: [react()],
  server: {
    middlewareMode: true,
    watch: null
  }
});

try {
  const [{ App }, shell] = await Promise.all([
    vite.ssrLoadModule("/src/App.tsx"),
    readFile(shellPath, "utf8")
  ]);

  for (const route of routes) {
    const rendered = renderToString(React.createElement(App, { initialRoute: route.route }));
    const html = injectHead(shell, route).replace('<div id="root"></div>', `<div id="root">${rendered}</div>`);
    const outputDirectory = path.resolve("dist", route.path.slice(1));
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, "index.html"), html);
    console.log(`Server-rendered ${route.path}`);
  }
} finally {
  await vite.close();
}
