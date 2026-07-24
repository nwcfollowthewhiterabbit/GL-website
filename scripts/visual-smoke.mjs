import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

const baseUrl = (process.env.VISUAL_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const baseHostname = new URL(baseUrl).hostname;
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
  const page = pages.find((item) => item.type === "page" && new URL(item.url).hostname === baseHostname);
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
      heading: document.querySelector(".policy-page__header h1, .policy-page__not-found h1, h1")
        ?.textContent?.trim() || "",
      productCards: document.querySelectorAll(".product-card").length,
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

async function waitForSelector(send, selector, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`
    });
    if (result.result.result.value) return;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

async function scrollToSelector(send, selector) {
  const result = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const top = element.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`
  });
  assert(result.result.result.value, `Unable to find ${selector}`);
  await wait(500);
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
    await waitForSelector(page.send, ".product-card");

    await scrollToSelector(page.send, "#catalog");
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
    assert(mobile.productCards > 0 && desktop.productCards > 0, "Catalog has no product cards");

    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".product-card .primary-button")?.click()`
    });
    await waitForSelector(page.send, ".quote-drawer.is-open");
    const basketMobile = await captureViewport(page.send, "basket-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const basketDesktop = await captureViewport(page.send, "basket-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    const basketFields = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        hasLocation: Boolean(document.querySelector('input[placeholder="Delivery location"]')),
        hasFlow: Boolean(document.querySelector(".order-flow-note")),
        hasPaymentTrust: Boolean(document.querySelector(".quote-form .payment-trust"))
      })`
    });
    assert(basketFields.result.result.value.hasLocation, "Order basket is missing delivery location");
    assert(basketFields.result.result.value.hasFlow, "Order basket is missing fulfillment guidance");
    assert(basketFields.result.result.value.hasPaymentTrust, "Order basket is missing Windcave payment information");

    await page.send("Page.navigate", { url: `${baseUrl}/account?visual-smoke=1` });
    await waitForSelector(page.send, ".account-page");
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

    await page.send("Page.navigate", { url: `${baseUrl}/privacy?visual-smoke=1` });
    await waitForSelector(page.send, ".policy-page");
    const policyMobile = await captureViewport(page.send, "policy-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const policyDesktop = await captureViewport(page.send, "policy-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    assert(policyMobile.heading === "Privacy policy", "Privacy page heading is missing");
    assert(policyDesktop.heading === "Privacy policy", "Privacy page heading is missing");

    await page.send("Page.navigate", { url: `${baseUrl}/payment-security?visual-smoke=1` });
    await waitForSelector(page.send, ".policy-page .payment-trust");
    const paymentMobile = await captureViewport(page.send, "payment-security-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const paymentDesktop = await captureViewport(page.send, "payment-security-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    assert(paymentMobile.heading === "Payment and security information", "Payment page heading is missing");
    assert(paymentDesktop.heading === "Payment and security information", "Payment page heading is missing");

    await page.send("Page.navigate", { url: `${baseUrl}/how-we-operate?visual-smoke=1` });
    await waitForSelector(page.send, ".operations-page");
    const operationsMobile = await captureViewport(page.send, "how-we-operate-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const mobileOperationsState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const process = document.querySelector(".operations-process");
        const hero = document.querySelector(".operations-hero__image");
        return {
          h1Count: document.querySelectorAll(".operations-page h1").length,
          processSteps: document.querySelectorAll(".operations-process li").length,
          processColumns: process ? getComputedStyle(process).gridTemplateColumns : "",
          heroLoaded: Boolean(hero?.naturalWidth),
          rabbitAttribution: document.querySelector(".operations-attribution a")?.getAttribute("href") || "",
          footerRabbitLink: Boolean(document.querySelector(".footer a[href*='rabbitsystems.net']"))
        };
      })()`
    });
    const operationsDesktop = await captureViewport(page.send, "how-we-operate-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    const desktopProcess = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `getComputedStyle(document.querySelector(".operations-process")).gridTemplateColumns`
    });
    const operationsState = mobileOperationsState.result.result.value;
    assert(operationsMobile.heading === "One connected operation behind every Green Leaf order", "Operations H1 is missing");
    assert(operationsDesktop.heading === "One connected operation behind every Green Leaf order", "Operations H1 is missing");
    assert(operationsState.h1Count === 1, "Operations page must contain exactly one H1");
    assert(operationsState.processSteps === 8, "Operations process is incomplete");
    assert(operationsState.processColumns.split(" ").length === 1, "Operations process is not vertical on mobile");
    assert(desktopProcess.result.result.value.split(" ").length === 8, "Operations process is not horizontal on desktop");
    assert(operationsState.heroLoaded, "Operations hero image did not load");
    assert(operationsState.rabbitAttribution.includes("/cases/ecommerce-erp-sync"), "Rabbit Systems attribution is incorrect");
    assert(!operationsState.footerRabbitLink, "Rabbit Systems must not be linked from the global footer");

    await page.send("Page.navigate", { url: `${baseUrl}/about-us?visual-smoke=1` });
    await waitForSelector(page.send, ".about-page");
    const aboutMobile = await captureViewport(page.send, "about-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    const aboutDesktop = await captureViewport(page.send, "about-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    const aboutLink = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `document.querySelector(".about-page a[href='/how-we-operate']")?.getAttribute("href") || ""`
    });
    assert(aboutLink.result.result.value === "/how-we-operate", "About Us contextual link is missing");

    page.close();
    console.log("Visual smoke checks passed");
    console.log(`- Mobile width: ${mobile.innerWidth}, scroll width: ${mobile.scrollWidth}`);
    console.log(`- Desktop width: ${desktop.innerWidth}, scroll width: ${desktop.scrollWidth}`);
    console.log(`- Basket mobile width: ${basketMobile.innerWidth}, scroll width: ${basketMobile.scrollWidth}`);
    console.log(`- Basket desktop width: ${basketDesktop.innerWidth}, scroll width: ${basketDesktop.scrollWidth}`);
    console.log(`- Account mobile width: ${accountMobile.innerWidth}, scroll width: ${accountMobile.scrollWidth}`);
    console.log(`- Account desktop width: ${accountDesktop.innerWidth}, scroll width: ${accountDesktop.scrollWidth}`);
    console.log(`- Policy mobile width: ${policyMobile.innerWidth}, scroll width: ${policyMobile.scrollWidth}`);
    console.log(`- Policy desktop width: ${policyDesktop.innerWidth}, scroll width: ${policyDesktop.scrollWidth}`);
    console.log(`- Payment mobile width: ${paymentMobile.innerWidth}, scroll width: ${paymentMobile.scrollWidth}`);
    console.log(`- Payment desktop width: ${paymentDesktop.innerWidth}, scroll width: ${paymentDesktop.scrollWidth}`);
    console.log(`- Operations mobile width: ${operationsMobile.innerWidth}, scroll width: ${operationsMobile.scrollWidth}`);
    console.log(`- Operations desktop width: ${operationsDesktop.innerWidth}, scroll width: ${operationsDesktop.scrollWidth}`);
    console.log(`- About mobile width: ${aboutMobile.innerWidth}, scroll width: ${aboutMobile.scrollWidth}`);
    console.log(`- About desktop width: ${aboutDesktop.innerWidth}, scroll width: ${aboutDesktop.scrollWidth}`);
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
