frappe.pages["website-control-center"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Website Control Center"),
    single_column: true
  });

  page.set_indicator(__("Website settings"), "green");
  page.add_inner_button(__("Open Website"), () => window.open("http://localhost:8080/catalog", "_blank"));
  page.add_inner_button(__("Refresh"), () => render_website_control_center(page));
  render_website_control_center(page);
};

const WEBSITE_URL = "http://localhost:8080/catalog";

const CONTROL_SECTIONS = [
  {
    key: "departments",
    title: __("Catalog Menu"),
    plain_title: "Catalog Menu",
    doctype: "Website Department",
    description: __("Big catalog buttons and their subcategories. Use this when products appear in the wrong menu section."),
    help: __("Open a department, then add or remove ERP Item Groups in the table. If Enabled is off, customers do not see it."),
    actions: [
      { label: __("Manage Menu"), route: ["List", "Website Department"], primary: true },
      { label: __("Add Menu Section"), new_doc: "Website Department" }
    ],
    fields: ["name", "label", "enabled", "sort_order"],
    preview_label: (row) => row.label || row.name
  },
  {
    key: "banners",
    title: __("Homepage Slides"),
    plain_title: "Homepage Slides",
    doctype: "Website Banner",
    description: __("Top slideshow images and click links."),
    help: __("Use clear images. Keep only useful live promotions enabled. Sort Order controls slide order."),
    actions: [
      { label: __("Manage Slides"), route: ["List", "Website Banner"], primary: true },
      { label: __("Add Slide"), new_doc: "Website Banner" }
    ],
    fields: ["name", "title", "enabled", "sort_order"],
    preview_label: (row) => row.title || row.name
  },
  {
    key: "catalogs",
    title: __("Download Catalogs"),
    plain_title: "Download Catalogs",
    doctype: "Website Catalog",
    description: __("PDF catalog downloads shown on the website."),
    help: __("Upload the new PDF, check Enabled, then open the website and test the download button."),
    actions: [
      { label: __("Manage PDFs"), route: ["List", "Website Catalog"], primary: true },
      { label: __("Add PDF"), new_doc: "Website Catalog" }
    ],
    fields: ["name", "title", "enabled", "sort_order"],
    preview_label: (row) => row.title || row.name
  },
  {
    key: "featured_products",
    title: __("Featured Products"),
    plain_title: "Featured Products",
    doctype: "Website Featured Product",
    description: __("Products shown in the 'You may also be interested in' block."),
    help: __("Pick only strong products with good photos. Use Sort Order to control the row. Keep the list short."),
    actions: [
      { label: __("Manage Featured"), route: ["List", "Website Featured Product"], primary: true },
      { label: __("Add Product"), new_doc: "Website Featured Product" }
    ],
    fields: ["name", "item_code", "display_name", "enabled", "sort_order"],
    preview_label: (row) => row.display_name || row.item_code || row.name
  },
  {
    key: "customer_corner",
    title: __("Customer Corner"),
    plain_title: "Customer Corner",
    doctype: "Website Customer Corner Settings",
    description: __("Customer account page controls: login, quote history, purchase history and customer-facing help text."),
    help: __("Keep one settings record enabled. Use it to hide sensitive account sections without changing website code."),
    actions: [
      { label: __("Open Settings"), route: ["List", "Website Customer Corner Settings"], primary: true },
      { label: __("Add Settings"), new_doc: "Website Customer Corner Settings" }
    ],
    fields: ["name", "title", "enabled", "login_enabled", "show_quote_history", "show_purchase_history"],
    preview_label: (row) => row.title || row.name
  },
  {
    key: "manufacturers",
    title: __("Manufacturer Logos"),
    plain_title: "Manufacturer Logos",
    doctype: "Website Manufacturer",
    description: __("Brand logos in the Manufacturers block."),
    help: __("Use square or wide logo images. Disable old brands instead of deleting them."),
    actions: [
      { label: __("Manage Brands"), route: ["List", "Website Manufacturer"], primary: true },
      { label: __("Add Brand"), new_doc: "Website Manufacturer" }
    ],
    fields: ["name", "manufacturer_name", "enabled", "sort_order"],
    preview_label: (row) => row.manufacturer_name || row.name
  }
];

const QUICK_ACTIONS = [
  {
    title: __("Products"),
    text: __("Edit product name, image, description, and website visibility."),
    route: ["List", "Item"]
  },
  {
    title: __("Product Groups"),
    text: __("Control group visibility, price mode, stock display, and product image rules."),
    route: ["List", "Item Group"]
  },
  {
    title: __("Quote Requests"),
    text: __("Check website-created quotations and follow up with customers."),
    route: ["List", "Quotation"]
  },
  {
    title: __("Customers"),
    text: __("Check customer records used by account login and quote history."),
    route: ["List", "Customer"]
  }
];

const PLANNED_CONTROLS = [
  {
    title: __("Featured Products"),
    status: __("Ready"),
    text: __("Use Website Featured Product to choose exactly what appears in the recommendation block."),
    route: ["List", "Website Featured Product"]
  },
  {
    title: __("Customer Portal"),
    status: __("Ready"),
    text: __("Use Customer Corner settings to control login, quote history and purchase history visibility."),
    route: ["List", "Website Customer Corner Settings"]
  },
  {
    title: __("Windcave Payments"),
    status: __("Waiting"),
    text: __("Waiting for Windcave sandbox credentials. Planned flow: hosted payment page after quote/order confirmation.")
  },
  {
    title: __("Sync Health"),
    status: __("Next"),
    text: __("A readable status panel for ERP data, website data, and failed sync jobs.")
  }
];

async function render_website_control_center(page) {
  page.body.empty();
  page.body.append(`
    <div class="gl-website-control">
      <section class="gl-website-hero">
        <div>
          <div class="gl-kicker">${__("Green Leaf Pacific")}</div>
          <h2>${__("Website Command Center")}</h2>
          <p>${__(
            "One place for the everyday website changes: menu, slides, PDF catalogs, brand logos, product rules, and later payments."
          )}</p>
        </div>
        <div class="gl-website-hero__actions">
          <button class="btn btn-primary" data-open-storefront>${__("Open Website")}</button>
          <button class="btn btn-default" data-route="List/Item">${__("Products")}</button>
          <button class="btn btn-default" data-route="List/Item Group">${__("Product Groups")}</button>
        </div>
      </section>

      <section class="gl-guidance-panel">
        <div>
          <span>${__("Simple rule")}</span>
          <strong>${__("If it should change on the website, start here.")}</strong>
        </div>
        <ol>
          <li>${__("Turn records on or off with Enabled.")}</li>
          <li>${__("Use Sort Order for display order. Smaller number appears first.")}</li>
          <li>${__("After saving, open the website and check it like a customer.")}</li>
        </ol>
      </section>

      <section class="gl-status-grid"></section>
      <section class="gl-control-grid"></section>

      <section class="gl-quick-grid">
        <div class="gl-section-title">
          <span>${__("Operational shortcuts")}</span>
          <h3>${__("Daily website work")}</h3>
        </div>
        <div class="gl-quick-grid__cards">
          ${QUICK_ACTIONS.map(quick_card).join("")}
        </div>
      </section>

      <section class="gl-next-panel">
        <div class="gl-section-title">
          <span>${__("Coming next")}</span>
          <h3>${__("Controls still being built")}</h3>
        </div>
        <div class="gl-next-list">
          ${PLANNED_CONTROLS.map(planned_card).join("")}
        </div>
      </section>
    </div>
  `);

  bind_common_actions(page.body);

  const $status = page.body.find(".gl-status-grid");
  const $grid = page.body.find(".gl-control-grid");
  $status.html(`<div class="gl-loading">${__("Loading website settings...")}</div>`);

  let stats = [];
  try {
    stats = await Promise.all(CONTROL_SECTIONS.map((section) => get_section_summary(section)));
  } catch (error) {
    $status.html(`<div class="gl-loading gl-loading--error">${__("Could not load website settings. Refresh the page or check permissions.")}</div>`);
    return;
  }

  $status.empty();
  $grid.empty();

  stats.forEach((summary) => {
    $status.append(`
      <article class="gl-stat-card">
        <span>${summary.title}</span>
        <strong>${summary.count}</strong>
        <small>${summary.enabled} ${__("enabled")}</small>
      </article>
    `);

    $grid.append(control_card(summary));
  });

  bind_common_actions(page.body);
}

function bind_common_actions($body) {
  $body.find("[data-open-storefront]").off("click").on("click", () => window.open(WEBSITE_URL, "_blank"));
  $body.find("[data-route]").off("click").on("click", function () {
    frappe.set_route($(this).attr("data-route").split("/"));
  });
  $body.find("[data-action-route]").off("click").on("click", function () {
    frappe.set_route($(this).attr("data-action-route").split("/"));
  });
  $body.find("[data-new-doc]").off("click").on("click", function () {
    frappe.new_doc($(this).attr("data-new-doc"));
  });
}

async function get_section_summary(section) {
  const exists = await frappe.db.exists("DocType", section.doctype);
  if (!exists) {
    return { ...section, exists: false, count: 0, enabled: 0, disabled: 0, rows: [] };
  }

  const [count, enabled, rows] = await Promise.all([
    frappe.db.count(section.doctype),
    frappe.db.count(section.doctype, { filters: { enabled: 1 } }),
    frappe.db.get_list(section.doctype, {
      fields: section.fields,
      order_by: "sort_order asc, modified desc",
      limit: 6
    })
  ]);

  return { ...section, exists: true, count, enabled, disabled: Math.max(count - enabled, 0), rows };
}

function quick_card(action) {
  return `
    <article class="gl-quick-card">
      <h4>${action.title}</h4>
      <p>${action.text}</p>
      <button class="btn btn-default btn-sm" data-route="${action.route.join("/")}">${__("Open")}</button>
    </article>
  `;
}

function planned_card(action) {
  const button = action.route
    ? `<button class="btn btn-default btn-xs" data-route="${action.route.join("/")}">${__("Open related")}</button>`
    : "";
  return `
    <article class="gl-planned-card">
      <div>
        <span>${action.status}</span>
        <strong>${action.title}</strong>
      </div>
      <p>${action.text}</p>
      ${button}
    </article>
  `;
}

function control_card(summary) {
  const rows = summary.rows.length
    ? summary.rows
        .map((row) => {
          const enabled = cint(row.enabled || 0) ? __("On") : __("Off");
          const enabled_class = cint(row.enabled || 0) ? "is-on" : "is-off";
          return `
            <li>
              <button data-action-route="Form/${summary.doctype}/${encodeURIComponent(row.name)}">
                ${frappe.utils.escape_html(summary.preview_label(row))}
              </button>
              <span class="${enabled_class}">${enabled}</span>
            </li>
          `;
        })
        .join("")
    : `<li class="gl-empty-row">${summary.exists ? __("No records yet") : __("DocType is not installed")}</li>`;

  const actions = summary.actions
    .map((action) => {
      const class_name = action.primary ? "btn btn-primary btn-sm" : "btn btn-default btn-sm";
      if (action.route) {
        return `<button class="${class_name}" data-action-route="${action.route.join("/")}">${action.label}</button>`;
      }
      return `<button class="${class_name}" data-new-doc="${action.new_doc}">${action.label}</button>`;
    })
    .join("");

  const warning = summary.disabled
    ? `<div class="gl-card-note">${summary.disabled} ${__("record(s) are currently hidden from customers.")}</div>`
    : "";

  return `
    <article class="gl-control-card">
      <div class="gl-control-card__head">
        <div>
          <span>${summary.plain_title}</span>
          <h3>${summary.title}</h3>
          <p>${summary.description}</p>
        </div>
        <strong>${summary.enabled}/${summary.count}</strong>
      </div>
      <div class="gl-card-help">${summary.help}</div>
      ${warning}
      <ul>${rows}</ul>
      <div class="gl-control-card__actions">${actions}</div>
    </article>
  `;
}
