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
  const runtimeErrors = [];

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(message.params?.exceptionDetails?.text || "Uncaught runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      runtimeErrors.push(
        message.params.args
          ?.map((argument) => argument.value || argument.description || "")
          .filter(Boolean)
          .join(" ") || "Console error"
      );
    }
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
  await send("Network.enable");
  await send("Network.clearBrowserCache");
  await send("Network.setCacheDisabled", { cacheDisabled: true });

  return { send, runtimeErrors, close: () => ws.close() };
}

async function captureViewport(send, name, viewport, readySelector = "") {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  if (readySelector) await waitForStableSelector(send, readySelector);
  await wait(readySelector ? 200 : 1600);

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

async function waitForMissingSelector(send, selector, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `!document.querySelector(${JSON.stringify(selector)})`
    });
    if (result.result.result.value) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${selector} to close`);
}

async function waitForStableSelector(send, selector, timeoutMs = 20000, stableMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`
    });
    if (result.result.result.value) {
      stableSince ||= Date.now();
      if (Date.now() - stableSince >= stableMs) return;
    } else {
      stableSince = 0;
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for stable ${selector}`);
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
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (!localStorage.getItem("green-leaf-theme")) localStorage.setItem("green-leaf-theme", "light");`
    });
    await page.send("Page.navigate", { url: `${baseUrl}/catalog?visual-smoke=1` });
    await waitForSelector(page.send, ".product-card");

    await scrollToSelector(page.send, "#catalog");
    const mobile = await captureViewport(page.send, "catalog-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    }, ".product-card");
    const desktop = await captureViewport(page.send, "catalog-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    }, ".product-card");
    assert(mobile.productCards > 0 && desktop.productCards > 0, "Catalog has no product cards");
    const catalogueDownloadState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        section: Boolean(document.querySelector(".catalog-downloads")),
        links: document.querySelectorAll('a[href="/catalog#catalogs"]').length
      })`
    });
    assert(!catalogueDownloadState.result.result.value.section, "Supplier catalogue download block is still visible");
    assert(catalogueDownloadState.result.result.value.links === 0, "Navigation still links to the removed catalogue block");

    const initialTheme = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        theme: document.documentElement.dataset.theme,
        pressed: document.querySelector(".nav__theme-button")?.getAttribute("aria-pressed")
      })`
    });
    assert(initialTheme.result.result.value.theme === "light", "Visual smoke did not start in light theme");
    assert(initialTheme.result.result.value.pressed === "false", "Theme control does not reflect light theme");
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".nav__theme-button")?.click()`
    });
    await wait(250);
    const darkTheme = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        theme: document.documentElement.dataset.theme,
        stored: localStorage.getItem("green-leaf-theme"),
        pressed: document.querySelector(".nav__theme-button")?.getAttribute("aria-pressed"),
        bodyBackground: getComputedStyle(document.body).backgroundColor
      })`
    });
    assert(darkTheme.result.result.value.theme === "dark", "Theme control did not activate dark theme");
    assert(darkTheme.result.result.value.stored === "dark", "Dark theme preference was not persisted");
    assert(darkTheme.result.result.value.pressed === "true", "Theme control does not reflect dark theme");
    assert(darkTheme.result.result.value.bodyBackground !== "rgb(246, 247, 243)", "Dark theme kept the light page background");
    await page.send("Page.reload", { ignoreCache: true });
    await waitForSelector(page.send, ".product-card");
    const persistedTheme = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `document.documentElement.dataset.theme`
    });
    assert(persistedTheme.result.result.value === "dark", "Dark theme preference did not survive reload");
    await scrollToSelector(page.send, "#catalog");
    const darkMobile = await captureViewport(page.send, "catalog-dark-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    }, ".product-card");
    const darkDesktop = await captureViewport(page.send, "catalog-dark-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    }, ".product-card");
    assert(darkMobile.productCards > 0 && darkDesktop.productCards > 0, "Dark catalog has no product cards");
    await scrollToSelector(page.send, ".recommended-section");
    await waitForStableSelector(page.send, ".recommended-product img");
    const darkRecommendedState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const image = document.querySelector(".recommended-product img");
        if (!image) return null;
        const style = getComputedStyle(image);
        return {
          cards: document.querySelectorAll(".recommended-product").length,
          blendMode: style.mixBlendMode,
          backgroundColor: style.backgroundColor,
          imageLoaded: image.naturalWidth > 0
        };
      })()`
    });
    assert(darkRecommendedState.result.result.value?.cards > 0, "Dark recommended section has no product cards");
    assert(darkRecommendedState.result.result.value?.blendMode === "normal", "Dark recommended product images are still multiplied into the card background");
    assert(darkRecommendedState.result.result.value?.imageLoaded, "Dark recommended product image did not load");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true
    });
    await scrollToSelector(page.send, ".recommended-section");
    const darkRecommendedMobile = await captureViewport(page.send, "recommended-dark-mobile", {
      width: 390,
      height: 900,
      mobile: true
    }, ".recommended-product img");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await scrollToSelector(page.send, ".recommended-section");
    const darkRecommendedDesktop = await captureViewport(page.send, "recommended-dark-desktop", {
      width: 1440,
      height: 900,
      mobile: false
    }, ".recommended-product img");
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".nav__theme-button")?.click()`
    });
    await wait(250);

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

    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const originalFetch = window.fetch.bind(window);
        const json = (value) => new Response(JSON.stringify(value), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        window.fetch = (input, options) => {
          const url = typeof input === "string" ? input : input.url;
          if (url === "/api/storefront/customer-corner") {
            return Promise.resolve(json({
              source: "visual_smoke",
              settings: {
                enabled: true,
                loginEnabled: true,
                showQuoteHistory: true,
                showPurchaseHistory: true,
                title: "Your Green Leaf account",
                introCopy: "Orders, quotations and invoices connected to your customer record.",
                salesEmail: "buy@greenleafpacific.com",
                salesPhone: "+679 670 2222",
                paymentNote: ""
              }
            }));
          }
          return originalFetch(input, options);
        };
      })();`
    });
    await page.send("Page.navigate", { url: `${baseUrl}/account?visual-smoke=login` });
    await waitForSelector(page.send, 'input[autocomplete="current-password"]');
    const loginState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        hasEmail: Boolean(document.querySelector('input[autocomplete="username"]')),
        hasPassword: Boolean(document.querySelector('input[autocomplete="current-password"]')),
        hasCode: Boolean(document.querySelector('input[inputmode="numeric"]')),
        signInLabel: [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Sign in"),
        buttonLabels: [...document.querySelectorAll("button")].map((button) => button.textContent?.trim()).filter(Boolean)
      })`
    });
    assert(loginState.result.result.value.hasEmail, "Customer login email field is missing");
    assert(loginState.result.result.value.hasPassword, "Customer login password field is missing");
    assert(!loginState.result.result.value.hasCode, "Customer login still requires an email code");
    assert(
      loginState.result.result.value.signInLabel,
      `Customer login action is missing (${loginState.result.result.value.buttonLabels.join(", ")})`
    );
    const accountLoginMobile = await captureViewport(page.send, "account-login-mobile", {
      width: 390,
      height: 900,
      mobile: true
    });
    const accountLoginDesktop = await captureViewport(page.send, "account-login-desktop", {
      width: 1440,
      height: 900,
      mobile: false
    });

    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const originalFetch = window.fetch.bind(window);
        const json = (value) => new Response(JSON.stringify(value), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        window.fetch = (input, options) => {
          const url = typeof input === "string" ? input : input.url;
          if (url === "/api/storefront/customer-corner") {
            return Promise.resolve(json({
              source: "visual_smoke",
              settings: {
                enabled: true,
                loginEnabled: true,
                showQuoteHistory: true,
                showPurchaseHistory: true,
                title: "Your Green Leaf account",
                introCopy: "Orders, quotations and invoices connected to your customer record.",
                salesEmail: "buy@greenleafpacific.com",
                salesPhone: "+679 670 2222",
                paymentNote: ""
              }
            }));
          }
          if (url === "/api/account/session") {
            return Promise.resolve(json({
              account: {
                email: "buyer@example.com",
                profile: {
                  name: "VISUAL-CUSTOMER",
                  customerName: "Island Resort Supplies",
                  email: "buyer@example.com",
                  phone: "+679 700 0000",
                  group: "Commercial",
                  territory: "Nadi"
                },
                orders: [{
                  name: "SO-TEST-0001",
                  customer: "Island Resort Supplies",
                  transactionDate: "2026-07-20",
                  deliveryDate: "2026-07-30",
                  grandTotal: 1240,
                  status: "To Deliver and Bill",
                  perDelivered: 0,
                  perBilled: 0,
                  creation: "2026-07-20"
                }],
                quotes: [{
                  name: "QTN-TEST-0001",
                  customer: "Island Resort Supplies",
                  transactionDate: "2026-07-18",
                  validTill: "2026-08-18",
                  grandTotal: 1240,
                  status: "Open",
                  creation: "2026-07-18",
                  marker: "Website quotation"
                }],
                invoices: [{
                  name: "ACC-SINV-TEST-0001",
                  customer: "Island Resort Supplies",
                  postingDate: "2026-07-21",
                  dueDate: "2026-08-21",
                  grandTotal: 1240,
                  outstandingAmount: 1240,
                  status: "Unpaid",
                  creation: "2026-07-21"
                }]
              }
            }));
          }
          if (url === "/api/account/orders/SO-TEST-0001") {
            return Promise.resolve(json({
              order: {
                type: "order",
                name: "SO-TEST-0001",
                customer: "Island Resort Supplies",
                transactionDate: "2026-07-20",
                deliveryDate: "2026-07-30",
                grandTotal: 1240,
                status: "To Deliver and Bill",
                perDelivered: 0,
                perBilled: 0,
                lines: [{
                  itemCode: "GL-CHAIR-01",
                  itemName: "Commercial dining chair",
                  qty: 4,
                  uom: "Nos",
                  rate: 310,
                  amount: 1240
                }]
              }
            }));
          }
          if (url === "/api/account/quotes/QTN-TEST-0001") {
            return Promise.resolve(json({
              quote: {
                type: "quote",
                name: "QTN-TEST-0001",
                customer: "Island Resort Supplies",
                transactionDate: "2026-07-18",
                validTill: "2026-08-18",
                grandTotal: 1240,
                status: "Open",
                marker: "Website quotation",
                lines: [{
                  itemCode: "GL-CHAIR-01",
                  itemName: "Commercial dining chair",
                  qty: 4,
                  uom: "Nos",
                  rate: 310,
                  amount: 1240
                }]
              }
            }));
          }
          if (url === "/api/account/invoices/ACC-SINV-TEST-0001") {
            return Promise.resolve(json({
              invoice: {
                type: "invoice",
                name: "ACC-SINV-TEST-0001",
                customer: "Island Resort Supplies",
                postingDate: "2026-07-21",
                dueDate: "2026-08-21",
                grandTotal: 1240,
                outstandingAmount: 1240,
                status: "Unpaid",
                lines: [{
                  itemCode: "GL-CHAIR-01",
                  itemName: "Commercial dining chair",
                  qty: 4,
                  uom: "Nos",
                  rate: 310,
                  amount: 1240
                }]
              }
            }));
          }
          return originalFetch(input, options);
        };
      })();`
    });
    await page.send("Page.navigate", { url: `${baseUrl}/account?visual-smoke=1` });
    await waitForSelector(page.send, ".account-tab");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true
    });
    await scrollToSelector(page.send, ".account-tabs");
    const accountMobile = await captureViewport(page.send, "account-mobile", {
      width: 390,
      height: 1200,
      mobile: true
    });
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false
    });
    await scrollToSelector(page.send, ".account-tabs");
    const accountDesktop = await captureViewport(page.send, "account-desktop", {
      width: 1440,
      height: 1200,
      mobile: false
    });
    const accountState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        customerName: document.querySelector(".account-header h1")?.textContent?.trim() || "",
        activeTab: document.querySelector(".account-tab--active")?.textContent?.trim() || "",
        orderName: document.querySelector(".account-quotes article strong")?.textContent?.trim() || "",
        orderStatus: document.querySelector(".account-status")?.textContent?.trim() || "",
        tabCount: document.querySelectorAll(".account-tab").length,
        hasStorefrontHero: Boolean(document.querySelector(".hero")),
        hasRecommendations: Boolean(document.querySelector(".recommended-section")),
        hasCatalogs: Boolean(document.querySelector(".catalog-downloads")),
        hasManufacturers: Boolean(document.querySelector(".brands-section")),
        hasServicePromotion: Boolean(document.querySelector(".service-section, .location-section, .final-cta"))
      })`
    });
    assert(accountState.result.result.value.customerName === "Island Resort Supplies", "Customer identity is not clear in the account header");
    assert(accountState.result.result.value.activeTab.startsWith("Orders"), "Orders are not the default account view");
    assert(accountState.result.result.value.orderName === "SO-TEST-0001", "Account order history did not render");
    assert(accountState.result.result.value.orderStatus === "Confirmed", "ERP order status was not translated for the customer");
    assert(accountState.result.result.value.tabCount === 3, "Account history tabs are incomplete");
    assert(!accountState.result.result.value.hasStorefrontHero, "Storefront campaign hero leaked into the customer account");
    assert(!accountState.result.result.value.hasRecommendations, "Product recommendations leaked into the customer account");
    assert(!accountState.result.result.value.hasCatalogs, "Supplier catalogues leaked into the customer account");
    assert(!accountState.result.result.value.hasManufacturers, "Manufacturer content leaked into the customer account");
    assert(!accountState.result.result.value.hasServicePromotion, "Storefront service promotion leaked into the customer account");

    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".account-quotes article button")?.click()`
    });
    await waitForSelector(page.send, ".account-detail-modal");
    const orderModalState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        name: document.querySelector("#account-document-title")?.textContent?.trim() || "",
        label: document.querySelector(".account-detail-modal__header span")?.textContent?.trim() || "",
        item: document.querySelector(".account-detail__lines article strong")?.textContent?.trim() || "",
        modal: document.querySelector(".account-detail-modal")?.getAttribute("aria-modal"),
        bodyOverflow: document.body.style.overflow,
        closeFocused: document.activeElement?.getAttribute("aria-label") === "Close document details"
      })`
    });
    assert(orderModalState.result.result.value.name === "SO-TEST-0001", "Order details did not open in the popup");
    assert(orderModalState.result.result.value.label === "Sales order details", "Order popup has the wrong document type");
    assert(orderModalState.result.result.value.item === "Commercial dining chair", "Order popup item lines are missing");
    assert(orderModalState.result.result.value.modal === "true", "Order popup is not marked as a modal dialog");
    assert(orderModalState.result.result.value.bodyOverflow === "hidden", "Page scroll was not locked behind the popup");
    assert(orderModalState.result.result.value.closeFocused, "Popup focus did not move to the close control");
    const orderModalDesktop = await captureViewport(page.send, "account-order-modal-desktop", {
      width: 1440,
      height: 900,
      mobile: false
    }, ".account-detail-modal");
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await waitForMissingSelector(page.send, ".account-detail-modal");

    await page.send("Runtime.evaluate", {
      expression: `[...document.querySelectorAll(".account-tab")].find((button) => button.textContent?.includes("Quotations"))?.click()`
    });
    await wait(150);
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".account-quotes article button")?.click()`
    });
    await waitForSelector(page.send, ".account-detail-modal");
    const quoteModalName = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `document.querySelector("#account-document-title")?.textContent?.trim() || ""`
    });
    assert(quoteModalName.result.result.value === "QTN-TEST-0001", "Quotation details did not open in the popup");
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Close document details"]')?.click()`
    });
    await waitForMissingSelector(page.send, ".account-detail-modal");

    await page.send("Runtime.evaluate", {
      expression: `[...document.querySelectorAll(".account-tab")].find((button) => button.textContent?.includes("Invoices"))?.click()`
    });
    await wait(150);
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(".account-quotes article button")?.click()`
    });
    await waitForSelector(page.send, ".account-detail-modal");
    const invoiceModalState = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        name: document.querySelector("#account-document-title")?.textContent?.trim() || "",
        label: document.querySelector(".account-detail-modal__header span")?.textContent?.trim() || "",
        outstanding: document.querySelector(".account-detail__progress span")?.textContent?.trim() || ""
      })`
    });
    assert(invoiceModalState.result.result.value.name === "ACC-SINV-TEST-0001", "Invoice details did not open in the popup");
    assert(invoiceModalState.result.result.value.label === "Invoice details", "Invoice popup has the wrong document type");
    assert(invoiceModalState.result.result.value.outstanding.includes("1,240.00 FJD"), "Invoice outstanding amount is missing");
    const invoiceModalMobile = await captureViewport(page.send, "account-invoice-modal-mobile", {
      width: 390,
      height: 900,
      mobile: true
    }, ".account-detail-modal");
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Close document details"]')?.click()`
    });
    await waitForMissingSelector(page.send, ".account-detail-modal");

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
    assert(page.runtimeErrors.length === 0, `Browser runtime errors: ${page.runtimeErrors.join(" | ")}`);

    page.close();
    console.log("Visual smoke checks passed");
    console.log(`- Mobile width: ${mobile.innerWidth}, scroll width: ${mobile.scrollWidth}`);
    console.log(`- Desktop width: ${desktop.innerWidth}, scroll width: ${desktop.scrollWidth}`);
    console.log(`- Dark mobile width: ${darkMobile.innerWidth}, scroll width: ${darkMobile.scrollWidth}`);
    console.log(`- Dark desktop width: ${darkDesktop.innerWidth}, scroll width: ${darkDesktop.scrollWidth}`);
    console.log(`- Dark recommended mobile width: ${darkRecommendedMobile.innerWidth}, scroll width: ${darkRecommendedMobile.scrollWidth}`);
    console.log(`- Dark recommended desktop width: ${darkRecommendedDesktop.innerWidth}, scroll width: ${darkRecommendedDesktop.scrollWidth}`);
    console.log(`- Basket mobile width: ${basketMobile.innerWidth}, scroll width: ${basketMobile.scrollWidth}`);
    console.log(`- Basket desktop width: ${basketDesktop.innerWidth}, scroll width: ${basketDesktop.scrollWidth}`);
    console.log(`- Account mobile width: ${accountMobile.innerWidth}, scroll width: ${accountMobile.scrollWidth}`);
    console.log(`- Account desktop width: ${accountDesktop.innerWidth}, scroll width: ${accountDesktop.scrollWidth}`);
    console.log(`- Order popup desktop width: ${orderModalDesktop.innerWidth}, scroll width: ${orderModalDesktop.scrollWidth}`);
    console.log(`- Invoice popup mobile width: ${invoiceModalMobile.innerWidth}, scroll width: ${invoiceModalMobile.scrollWidth}`);
    console.log(`- Account login mobile width: ${accountLoginMobile.innerWidth}, scroll width: ${accountLoginMobile.scrollWidth}`);
    console.log(`- Account login desktop width: ${accountLoginDesktop.innerWidth}, scroll width: ${accountLoginDesktop.scrollWidth}`);
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
