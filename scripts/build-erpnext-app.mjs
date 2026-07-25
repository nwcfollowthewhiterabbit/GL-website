import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const erpnextRoot = `${repositoryRoot}erpnext/`;
const appRoot = `${erpnextRoot}app/greenleaf_website/greenleaf_website/`;
const moduleRoot = `${appRoot}green_leaf_website/`;
const doctypeRoot = `${moduleRoot}doctype/`;
const pageRoot = `${moduleRoot}page/website_control_center/`;
const manifest = JSON.parse(await readFile(`${erpnextRoot}website-layer.json`, "utf8"));

function slug(value) {
  return value.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function className(value) {
  return value.replaceAll(/[^a-zA-Z0-9]/g, "");
}

async function buildDocTypes() {
  for (const relativePath of manifest.fixtureFiles.filter((path) => !path.endsWith("custom_fields.json"))) {
    const fixtures = JSON.parse(await readFile(`${erpnextRoot}${relativePath}`, "utf8"));
    for (const fixture of fixtures) {
      const folder = `${doctypeRoot}${slug(fixture.name)}/`;
      const standard = {
        ...fixture,
        custom: 0,
        module: "Green Leaf Website"
      };
      if (!standard.istable) {
        standard.permissions = [{
          role: "System Manager",
          read: 1,
          write: 1,
          create: 1,
          delete: 1,
          report: 1,
          export: 1,
          print: 1,
          email: 1,
          share: 1
        }];
      } else {
        delete standard.permissions;
      }

      await mkdir(folder, { recursive: true });
      await writeFile(`${folder}__init__.py`, "", "utf8");
      await writeFile(`${folder}${slug(fixture.name)}.json`, `${JSON.stringify(standard, null, 2)}\n`, "utf8");
      await writeFile(
        `${folder}${slug(fixture.name)}.py`,
        `from frappe.model.document import Document\n\n\nclass ${className(fixture.name)}(Document):\n\tpass\n`,
        "utf8"
      );
    }
  }
}

async function buildCustomFields() {
  const fields = JSON.parse(await readFile(`${erpnextRoot}fixtures/custom_fields.json`, "utf8"))
    .map((field) => ({
      ...field,
      name: field.name || `${field.dt}-${field.fieldname}`
    }));
  await mkdir(`${appRoot}fixtures/`, { recursive: true });
  await writeFile(`${appRoot}fixtures/custom_field.json`, `${JSON.stringify(fields, null, 2)}\n`, "utf8");
}

async function buildPage() {
  const source = `${erpnextRoot}page/website_control_center/`;
  await mkdir(pageRoot, { recursive: true });
  await writeFile(`${moduleRoot}page/__init__.py`, "", "utf8");
  await copyFile(`${source}__init__.py`, `${pageRoot}__init__.py`);
  await copyFile(`${source}website_control_center.css`, `${pageRoot}website_control_center.css`);
  await copyFile(`${source}website_control_center.js`, `${pageRoot}website_control_center.js`);

  const page = JSON.parse(await readFile(`${source}website_control_center.json`, "utf8"));
  page.module = "Green Leaf Website";
  await writeFile(`${pageRoot}website_control_center.json`, `${JSON.stringify(page, null, 2)}\n`, "utf8");
}

await mkdir(doctypeRoot, { recursive: true });
await writeFile(`${doctypeRoot}__init__.py`, "", "utf8");
await buildDocTypes();
await buildCustomFields();
await buildPage();

console.log(`Built ERPNext app metadata for ${manifest.websiteDocTypes.length} website DocTypes.`);
