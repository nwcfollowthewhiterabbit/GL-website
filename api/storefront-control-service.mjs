import { getErpPool } from "./erpnext-db.mjs";

async function tableExists(tableName) {
  const [rows] = await getErpPool().execute(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
      LIMIT 1
    `,
    { tableName }
  );
  return Boolean(rows[0]);
}

function normalizeId(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getWebsiteDepartments() {
  const departmentTable = "tabWebsite Department";
  const itemGroupTable = "tabWebsite Department Item Group";
  if (!(await tableExists(departmentTable)) || !(await tableExists(itemGroupTable))) {
    return { source: "fallback_static_storefront_mapping", departments: [] };
  }

  const [departments] = await getErpPool().execute(
    `
      SELECT
        d.name,
        IFNULL(NULLIF(d.department_id, ''), d.name) AS department_id,
        IFNULL(NULLIF(d.label, ''), d.name) AS label,
        IFNULL(d.description, '') AS description,
        IFNULL(d.featured, 0) AS featured
      FROM \`${departmentTable}\` d
      WHERE IFNULL(d.enabled, 1) = 1
      ORDER BY IFNULL(d.sort_order, 0), d.idx, d.creation
    `
  );

  if (!departments.length) {
    return { source: "erp_website_department_empty", departments: [] };
  }

  const params = Object.fromEntries(departments.map((department, index) => [`department${index}`, department.name]));
  const placeholders = departments.map((_, index) => `:department${index}`).join(", ");
  const [mappings] = await getErpPool().execute(
    `
      SELECT parent, item_group
      FROM \`${itemGroupTable}\`
      WHERE parent IN (${placeholders})
        AND IFNULL(item_group, '') <> ''
      ORDER BY parent, IFNULL(sort_order, 0), idx
    `,
    params
  );

  const itemGroupsByParent = new Map();
  for (const mapping of mappings) {
    const current = itemGroupsByParent.get(mapping.parent) || [];
    current.push(mapping.item_group);
    itemGroupsByParent.set(mapping.parent, current);
  }

  return {
    source: "erp_website_department",
    departments: departments.map((department) => ({
      id: normalizeId(department.department_id || department.name),
      label: department.label || department.name,
      description: department.description || "",
      featured: Boolean(Number(department.featured || 0)),
      itemGroups: itemGroupsByParent.get(department.name) || []
    }))
  };
}

export async function getWebsiteBanners() {
  const bannerTable = "tabWebsite Banner";
  if (!(await tableExists(bannerTable))) {
    return { source: "fallback_static_hero_banners", banners: [] };
  }

  const [banners] = await getErpPool().execute(
    `
      SELECT
        name,
        IFNULL(NULLIF(banner_id, ''), name) AS banner_id,
        IFNULL(label, '') AS label,
        IFNULL(title, '') AS title,
        IFNULL(copy, '') AS copy,
        IFNULL(image, '') AS image,
        IFNULL(href, '') AS href,
        IFNULL(open_in_new_tab, 0) AS open_in_new_tab
      FROM \`${bannerTable}\`
      WHERE IFNULL(enabled, 1) = 1
      ORDER BY IFNULL(sort_order, 0), idx, creation
    `
  );

  if (!banners.length) {
    return { source: "erp_website_banner_empty", banners: [] };
  }

  return {
    source: "erp_website_banner",
    banners: banners.map((banner) => ({
      id: normalizeId(banner.banner_id || banner.name),
      label: banner.label || banner.title || banner.name,
      title: banner.title || banner.label || banner.name,
      copy: banner.copy || "",
      image: banner.image || "",
      href: banner.href || "/catalog",
      openInNewTab: Boolean(Number(banner.open_in_new_tab || 0))
    }))
  };
}

export async function getWebsiteCatalogs() {
  const catalogTable = "tabWebsite Catalog";
  if (!(await tableExists(catalogTable))) {
    return { source: "fallback_static_website_catalogs", catalogs: [] };
  }

  const [catalogs] = await getErpPool().execute(
    `
      SELECT
        name,
        IFNULL(NULLIF(catalog_id, ''), name) AS catalog_id,
        IFNULL(title, '') AS title,
        IFNULL(description, '') AS description,
        IFNULL(file_url, '') AS file_url,
        IFNULL(cover_image, '') AS cover_image,
        IFNULL(source_label, '') AS source_label
      FROM \`${catalogTable}\`
      WHERE IFNULL(enabled, 1) = 1
        AND IFNULL(file_url, '') <> ''
      ORDER BY IFNULL(sort_order, 0), idx, creation
    `
  );

  if (!catalogs.length) {
    return { source: "erp_website_catalog_empty", catalogs: [] };
  }

  return {
    source: "erp_website_catalog",
    catalogs: catalogs.map((catalog) => ({
      id: normalizeId(catalog.catalog_id || catalog.name),
      title: catalog.title || catalog.name,
      description: catalog.description || "",
      fileUrl: catalog.file_url,
      coverImage: catalog.cover_image || "",
      sourceLabel: catalog.source_label || "Catalogue"
    }))
  };
}

export async function getWebsiteManufacturers() {
  const manufacturerTable = "tabWebsite Manufacturer";
  if (!(await tableExists(manufacturerTable))) {
    return { source: "fallback_static_website_manufacturers", manufacturers: [] };
  }

  const [manufacturers] = await getErpPool().execute(
    `
      SELECT
        name,
        IFNULL(NULLIF(manufacturer_id, ''), name) AS manufacturer_id,
        IFNULL(manufacturer_name, '') AS manufacturer_name,
        IFNULL(logo, '') AS logo,
        IFNULL(url, '') AS url
      FROM \`${manufacturerTable}\`
      WHERE IFNULL(enabled, 1) = 1
        AND IFNULL(logo, '') <> ''
      ORDER BY IFNULL(sort_order, 0), idx, creation
    `
  );

  if (!manufacturers.length) {
    return { source: "erp_website_manufacturer_empty", manufacturers: [] };
  }

  return {
    source: "erp_website_manufacturer",
    manufacturers: manufacturers.map((manufacturer) => ({
      id: normalizeId(manufacturer.manufacturer_id || manufacturer.name),
      name: manufacturer.manufacturer_name || manufacturer.name,
      logo: manufacturer.logo,
      url: manufacturer.url || ""
    }))
  };
}
