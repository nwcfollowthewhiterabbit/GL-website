import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpPool } from "../api/erpnext-db.mjs";

const pageFixturePath = fileURLToPath(new URL("../erpnext/page/website_control_center/website_control_center.json", import.meta.url));
const workspaceName = "Website";
const shortcutLabel = "Website Control Center";
const pageName = "website-control-center";
const workspaceContent = [
  {
    type: "header",
    data: {
      text: "<span class=\"h4\"><b>Website Management</b></span>",
      col: 12
    }
  },
  {
    type: "shortcut",
    data: {
      shortcut_name: shortcutLabel,
      col: 3
    }
  }
];

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function ensurePage() {
  const fixture = JSON.parse(await readFile(pageFixturePath, "utf8"));
  await getErpPool().execute(
    `INSERT INTO \`tabPage\`
      (name, creation, modified, modified_by, owner, docstatus, idx, title, module, standard, page_name, system_page)
     VALUES
      (:name, :now, :now, 'Administrator', 'Administrator', 0, 0, :title, :module, :standard, :pageName, 0)
     ON DUPLICATE KEY UPDATE
      modified = VALUES(modified),
      title = VALUES(title),
      module = VALUES(module),
      standard = VALUES(standard),
      page_name = VALUES(page_name)`,
    {
      name: fixture.name || pageName,
      now: now(),
      title: fixture.title || shortcutLabel,
      module: fixture.module || "Greenleaf",
      standard: fixture.standard || "Yes",
      pageName: fixture.page_name || pageName
    }
  );
}

async function ensureWorkspaceShortcut() {
  const [workspaces] = await getErpPool().execute("SELECT name, content FROM `tabWorkspace` WHERE name = :name LIMIT 1", {
    name: workspaceName
  });
  if (!workspaces[0]) {
    throw new Error(`Workspace ${workspaceName} not found`);
  }

  await getErpPool().execute("DELETE FROM `tabWorkspace Shortcut` WHERE parent = :parent AND label != :label", {
    parent: workspaceName,
    label: shortcutLabel
  });

  const [existing] = await getErpPool().execute("SELECT name FROM `tabWorkspace Shortcut` WHERE parent = :parent AND label = :label LIMIT 1", {
    parent: workspaceName,
    label: shortcutLabel
  });
  if (!existing[0]) {
    await getErpPool().execute(
      `INSERT INTO \`tabWorkspace Shortcut\`
        (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype,
         type, link_to, label, icon, url)
       VALUES
        (:name, :now, :now, 'Administrator', 'Administrator', 0, :idx, :parent, 'shortcuts', 'Workspace',
         'Page', :linkTo, :label, :icon, :url)`,
      {
        name: `${workspaceName}-${shortcutLabel}`,
        now: now(),
        idx: 1,
        parent: workspaceName,
        linkTo: pageName,
        label: shortcutLabel,
        icon: "website",
        url: `/app/${pageName}`
      }
    );
  } else {
    await getErpPool().execute(
      `UPDATE \`tabWorkspace Shortcut\`
       SET modified = :now, idx = 1, type = 'Page', link_to = :linkTo, icon = :icon, url = :url
       WHERE parent = :parent AND label = :label`,
      {
        now: now(),
        parent: workspaceName,
        label: shortcutLabel,
        linkTo: pageName,
        icon: "website",
        url: `/app/${pageName}`
      }
    );
  }

  await getErpPool().execute(
    "UPDATE `tabWorkspace` SET content = :content, modified = :now WHERE name = :name",
    { content: JSON.stringify(workspaceContent), now: now(), name: workspaceName }
  );
}

async function main() {
  await ensurePage();
  await ensureWorkspaceShortcut();
  console.log(`Website workspace shortcut ensured: ${shortcutLabel} -> /app/${pageName}`);
}

main()
  .catch((error) => {
    console.error(`Failed to ensure website sidebar shortcut: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors.
    }
  });
