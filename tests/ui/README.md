# UI tests

Browser regression is implemented by `scripts/visual-smoke.mjs`.

```bash
VISUAL_BASE_URL=https://testing.greenleafpacific.com npm run visual:smoke
```

The suite captures `.screenshots/`, checks 390px and 1440px viewports, browser
runtime errors, horizontal overflow, images, account isolation of storefront
content, and key route behavior.
