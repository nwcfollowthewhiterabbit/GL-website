# Launch Readiness Backlog

The current visual design of `https://testing.greenleafpacific.com` is approved and is the baseline for all further work. Future changes must preserve the approved look unless a specific design change is requested.

## Operating Rules

- Treat the current testing website as the source of truth for visual behavior.
- Use ERPNext as the control panel for storefront content wherever practical.
- Keep website admin work inside ERPNext instead of creating a separate CMS.
- Before production launch, every feature below needs a staging check on desktop and mobile.
- Do not replace the approved visual design while fixing visual bugs.

## 1. Visual QA And Polish

Goal: fix small layout defects found after design approval.

Scope:

- Check desktop, tablet, and mobile breakpoints.
- Fix overlapping text, buttons, cards, navigation, product tiles, footer blocks, and banner content.
- Verify long product names, long SKU values, long category names, and missing images.
- Verify catalog filters, product detail pages, account pages, quote drawer, footer map, and navigation dropdowns.
- Add regression screenshots for the main pages after fixes.

Acceptance criteria:

- No visible overlap or clipped controls on common viewports.
- Product cards remain stable with long text and missing images.
- Header, menu, hero, catalog grid, quote drawer, and footer remain usable on mobile.

## 2. ERP-Managed Main Hero Banner

Goal: allow staff to manage the main website banner from ERPNext.

Existing direction:

- Use the `Website Banner` DocType as the source of truth.
- Website endpoint: `GET /api/storefront/banners`.
- Existing fallback remains available until ERP records are configured.

Required fields:

- Internal label.
- Banner image as final artwork. The approved direction is a ready-made image, not editable overlay text.
- Optional internal title/copy can remain for ERP staff reference, but the website should not depend on overlay text for the approved design.
- Link URL.
- Open in new tab toggle.
- Enabled toggle.
- Sort order.

Image requirements to confirm with final implementation:

- Recommended upload format: WebP or JPG.
- Recommended source size: 1920 x 720 px minimum.
- Safe crop: keep important product/content near the center 70% of the image.
- File size target: under 500 KB after optimization where possible.
- Because the approved direction is final artwork, any visible hero text must be baked into the image by the content team.

Acceptance criteria:

- Staff can add, disable, reorder, and edit hero slides in ERPNext.
- Website updates without code deployment after ERP content changes.
- Missing or broken banner images fall back cleanly.

## 3. ERP-Managed “You May Also Be Interested In” Section

Goal: allow staff to select products shown in the recommendation section and make the section scrollable.

Existing direction:

- Use `Website Featured Product` records or equivalent ERP-managed list.
- Product details still come from ERP `Item` and pricing logic.
- Existing endpoint: `GET /api/catalog/featured`.

Required behavior:

- Staff can add products by ERP item code.
- Staff can disable individual featured products.
- Staff can set sort order.
- Website shows a horizontal carousel or scrollable row.
- User can manually scroll using arrows or swipe/trackpad.
- Auto-scroll is required, with pause on hover/focus/interact so it does not fight the user.

Acceptance criteria:

- Empty or invalid featured records do not break the page.
- Products without valid storefront visibility are skipped or clearly reported.
- Section works on mobile and desktop.

## 4. ERP-Managed Catalogues And Price Lists

Goal: allow staff to add and manage catalogue/price-list downloads from ERPNext, and apply customer-specific price-list visibility/pricing rules.

Existing direction:

- Use `Website Catalog` records.
- Website endpoint: `GET /api/storefront/catalogs`.

Required fields:

- Title.
- Description.
- PDF/file URL.
- Optional cover image.
- Source label, for example `Catalogue`, `Price List`, or supplier name.
- Enabled toggle.
- Sort order.

Required behavior:

- Staff can add new price lists/catalogues without code changes.
- Staff can disable outdated files without deleting history.
- Website supports multiple files and preserves existing catalogues.
- Anonymous users see Standard Selling pricing.
- Authenticated customers use the price list that matches their customer group where such a price list exists.
- High Priority or equivalent customer groups use the matching high-priority price list.
- If no customer-group price list applies, pricing falls back to Standard Selling.

Acceptance criteria:

- New records in ERP appear on the website after refresh.
- Missing files do not break the catalogue section.
- Large PDFs are hosted through ERP files, object storage, or CDN rather than committed to git.

## 5. ERP-Managed “Product Of The Month” Section

Goal: allow staff to enable, disable, edit, and order monthly product promotions.

Recommended implementation:

- Add a new ERP DocType, for example `Website Monthly Product`.
- Reuse the same storefront product-card data pipeline as featured products.
- Support an optional section banner/image for the monthly promotion block.

Required fields:

- Item code.
- Optional display title.
- Optional promotional image override.
- Optional promotional copy. Pricing follows the same customer-specific price-list logic as the catalog: anonymous users get Standard Selling; authenticated customer groups get their matching price list when available.
- Enabled toggle.
- Sort order.
- Start date and end date, optional.

Required behavior:

- Staff can turn the whole section on/off.
- Staff can add multiple products.
- Website section can be horizontally scrollable like featured products.
- Auto-scroll is required, with manual arrows/swipe also available.

Acceptance criteria:

- Expired or disabled promotions are hidden.
- If there are no active monthly products, the section hides without leaving empty space.
- Product links open the correct product detail page or quote flow.

## 6. ERP Storefront Content And Catalog Quality Controls

Goal: give staff practical controls for what appears on the website and visibility into catalogue quality.

Required ERP controls:

- View item counts by category/item group.
- View how many products in each category have no photo.
- View products missing price, image, description, or storefront visibility settings.
- Enable or disable whole categories/item groups on the storefront.
- Enable or disable individual products on the storefront.
- Global website setting: show or hide products without images.
- Category-level override for products without images.
- Product-level visibility override.
- Product-level explicit publish block must win over category/group/default rules.
- Group/category visibility rules must apply before products are shown in catalog, search, featured rows, and monthly products.

Existing fields to use or extend:

- `Item Group.website_show_on_storefront`.
- `Item Group.website_show_products_without_images`.
- `Item.website_show_on_storefront`.
- `Item.website_featured`.
- `Item.website_sort_order`.

Required website behavior:

- Hidden categories are removed from navigation and facets.
- Hidden products are removed from catalog, search, recommendations, and monthly products.
- Products without images respect the global rule unless a category-level override is set.
- Category override can show no-photo products even when the global rule hides them, or hide them even when the global rule shows them.
- Diagnostics endpoint reports counts staff can act on.

Acceptance criteria:

- Staff can identify categories with image gaps before launch.
- Disabling a category or item in ERP removes it from website views.
- Rules are documented for staff so they understand why a product is not visible.

## 7. Multiple Product Images

Goal: support multiple photos for one product on the website product detail page.

ERPNext note:

- ERPNext `Item` has a main image field by default.
- Additional images can be handled with a custom child table or by using attached files with a defined convention.
- A custom child table is recommended because it gives staff explicit ordering, captions, and enable/disable control.

Recommended ERP model:

- Add child table `Website Product Image` on `Item`.
- Fields: image/file, alt text, sort order, enabled flag, optional caption.
- Keep the default `Item.image` as the primary fallback image.

Required website behavior:

- Product detail page shows a gallery when multiple images exist.
- User can switch images with thumbnails or arrows.
- Catalog cards continue to use the primary image.
- Missing gallery images are skipped.

Acceptance criteria:

- Product with one image behaves as it does now.
- Product with multiple images shows a stable gallery on desktop and mobile.
- Images load from ERP files through the existing file proxy or approved asset host.

## Suggested Delivery Order

1. Snapshot and commit the currently approved testing-site code to GitHub.
2. Run visual QA and fix approved-design bugs.
3. Apply ERP custom fields and storefront control DocTypes to testing ERP.
4. Implement and seed ERP-managed hero banners.
5. Implement featured products carousel and ERP management.
6. Implement catalogues/price-list management.
7. Implement product-of-the-month management.
8. Implement catalog quality dashboard and visibility controls.
9. Implement multiple product image gallery.
10. Run full smoke, visual, and ERP readiness checks before production cutover.

## Resolved Decisions

- Hero banner is a final ready-made image. Any visible banner text is part of the artwork.
- Featured and monthly product sections need both auto-scroll and manual scrolling.
- Anonymous users use Standard Selling pricing. Authenticated customers use the price list matching their customer group when available, otherwise Standard Selling.
- Product-of-the-month pricing follows the same customer-specific price-list logic as the main catalog.
- Product photos are uploaded by the new Website Content Manager role.
- No-photo product visibility needs a global rule plus category-level overrides and item-level publish blocking.

## Remaining Open Questions

- Exact role permissions for Website Content Manager: only website content DocTypes and item images, or also item text/description/category controls?
- Should price-list PDF downloads follow the same customer-group visibility rules as numeric prices, or can all PDFs remain public?
