import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

const baseUrl = (process.env.VISUAL_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const chromePath =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profileDir = "/tmp/gl-visual-smoke-chrome";
const debuggingPort = Number(process.env.CHROME_DEBUG_PORT || 9223);
const outputDir = ".screenshots";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(url, options) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, options);
      return await response.json();
    } catch {
      await wait(100);
    }
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${url}`);
}

async function connectToPage(url) {
  await fetch(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  }).catch(() => null);

  await wait(500);
  const pages = await getJson(`http://127.0.0.1:${debuggingPort}/json`);
  const page = pages.find((item) => item.type === "page" && item.url.includes("localhost"));
  assert(page?.webSocketDebuggerUrl, "Unable to find a Chrome page target for the storefront");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let messageId = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  function send(method, params = {}) {
    messageId += 1;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve) => pending.set(messageId, resolve));
  }

  await send("Page.enable");
  await send("Runtime.enable");

  return { send, close: () => ws.close() };
}

async function captureViewport(send, name, viewport) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  await wait(1600);

  const metrics = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      productImages: [...document.querySelectorAll(".product-card__image img")]
        .slice(0, 4)
        .map((img) => ({ src: img.getAttribute("src"), naturalWidth: img.naturalWidth }))
    }))()`
  });
  const value = metrics.result.result.value;
  assert(value.scrollWidth <= value.innerWidth + 1, `${name} has horizontal overflow`);
  assert(
    value.productImages.length === 0 || value.productImages.every((image) => image.naturalWidth > 0),
    `${name} has unloaded product images`
  );

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(screenshot.result.data, "base64"));

  return value;
}

async function main() {
  await rm(profileDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 120 });
  await mkdir(outputDir, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-extensions",
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${debuggingPort}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  try {
    await getJson(`http://127.0.0.1:${debuggingPort}/json/version`);
    const page = await connectToPage(`${baseUrl}/catalog?visual-smoke=1`);
    await wait(2600);

    const mobile = await captureViewport(page.send, "catalog-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const desktop = await captureViewport(page.send, "catalog-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    await page.send("Page.navigate", { url: `${baseUrl}/account?visual-smoke=1` });
    await wait(1800);
    const accountMobile = await captureViewport(page.send, "account-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const accountDesktop = await captureViewport(page.send, "account-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });

    page.close();
    console.log("Visual smoke checks passed");
    console.log(`- Mobile width: ${mobile.innerWidth}, scroll width: ${mobile.scrollWidth}`);
    console.log(`- Desktop width: ${desktop.innerWidth}, scroll width: ${desktop.scrollWidth}`);
    console.log(`- Account mobile width: ${accountMobile.innerWidth}, scroll width: ${accountMobile.scrollWidth}`);
    console.log(`- Account desktop width: ${accountDesktop.innerWidth}, scroll width: ${accountDesktop.scrollWidth}`);
    console.log(`- Screenshots written to ${outputDir}/`);
  } finally {
    chrome.kill("SIGTERM");
    await rm(profileDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 120 }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`Visual smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
