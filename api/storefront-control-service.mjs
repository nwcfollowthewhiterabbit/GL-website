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
