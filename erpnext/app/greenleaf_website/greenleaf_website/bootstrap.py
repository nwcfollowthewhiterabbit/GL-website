import json

import frappe


INTEGRATION_USER = "website.integration.v16@greenleaf.local"
TEST_ITEM_CODE = "GL-WEB-E2E-ITEM-001"
TEST_CUSTOMER_NAME = "GL-WEB-E2E-CUSTOMER"
TEST_CUSTOMER_EMAIL = "gl-web-e2e@example.invalid"


def ensure_compatibility_site():
	if not frappe.defaults.get_global_default("company"):
		from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

		setup_complete(
			json.dumps(
				{
					"language": "English",
					"country": "Fiji",
					"timezone": "Pacific/Fiji",
					"currency": "FJD",
					"full_name": "Green Leaf Test Administrator",
					"email": "gl-v16-admin@example.invalid",
					"company_name": "Green Leaf Website Compatibility",
					"company_abbr": "GLT",
					"fy_start_date": "2026-01-01",
					"fy_end_date": "2026-12-31",
					"chart_of_accounts": "Standard",
					"domain": "Distribution",
				}
			)
		)

	return {
		"integration": ensure_integration_user(),
		"data": ensure_compatibility_data(),
	}


def ensure_integration_user():
	if frappe.db.exists("User", INTEGRATION_USER):
		user = frappe.get_doc("User", INTEGRATION_USER)
	else:
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": INTEGRATION_USER,
				"first_name": "Website",
				"last_name": "Integration v16",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		)
		user.insert(ignore_permissions=True)

	for role in ("Sales User", "Stock User", "Accounts User"):
		if role not in {row.role for row in user.roles}:
			user.append("roles", {"role": role})
	user.save(ignore_permissions=True)
	frappe.db.commit()
	return {"user": user.name, "roles": sorted(row.role for row in user.roles)}


def set_integration_credentials(api_key, api_secret):
	if not isinstance(api_key, str) or len(api_key) < 15:
		frappe.throw("Integration API key must contain at least 15 characters")
	if not isinstance(api_secret, str) or len(api_secret) < 24:
		frappe.throw("Integration API secret must contain at least 24 characters")

	ensure_integration_user()
	frappe.db.set_value("User", INTEGRATION_USER, "api_key", api_key)

	from frappe.utils.password import set_encrypted_password

	set_encrypted_password("User", INTEGRATION_USER, api_secret, "api_secret")
	frappe.db.commit()
	return {"user": INTEGRATION_USER, "api_key_configured": True}


def ensure_compatibility_data():
	company = frappe.defaults.get_global_default("company")
	currency = frappe.defaults.get_global_default("currency") or "FJD"
	if not company:
		frappe.throw("Default company is required before seeding website compatibility data")

	item_group = "Website Compatibility"
	if not frappe.db.exists("Item Group", item_group):
		frappe.get_doc(
			{
				"doctype": "Item Group",
				"item_group_name": item_group,
				"parent_item_group": "All Item Groups",
				"is_group": 0,
			}
		).insert(ignore_permissions=True)

	if frappe.db.exists("Item", TEST_ITEM_CODE):
		item = frappe.get_doc("Item", TEST_ITEM_CODE)
	else:
		item = frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": TEST_ITEM_CODE,
				"item_name": "Website Compatibility Test Item",
				"item_group": item_group,
				"stock_uom": "Nos",
				"is_stock_item": 0,
				"is_sales_item": 1,
			}
		)
	item.description = "Synthetic item used only by Green Leaf website compatibility tests."
	item.image = "https://testing.greenleafpacific.com/legacy/greenleaf-logo.png"
	item.website_show_on_storefront = 1
	item.website_featured = 1
	if item.is_new():
		item.insert(ignore_permissions=True)
	else:
		item.save(ignore_permissions=True)

	price_filters = {
		"item_code": TEST_ITEM_CODE,
		"price_list": "Standard Selling",
		"currency": currency,
	}
	if not frappe.db.exists("Item Price", price_filters):
		frappe.get_doc(
			{
				"doctype": "Item Price",
				**price_filters,
				"price_list_rate": 125,
				"selling": 1,
			}
		).insert(ignore_permissions=True)

	customer = frappe.db.exists("Customer", {"customer_name": TEST_CUSTOMER_NAME})
	if not customer:
		customer = frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": TEST_CUSTOMER_NAME,
				"customer_type": "Company",
				"customer_group": "Commercial",
				"territory": "Fiji",
				"website_origin": "greenleaf-v16-compatibility",
			}
		).insert(ignore_permissions=True).name

	contact = frappe.db.exists("Contact", {"email_id": TEST_CUSTOMER_EMAIL})
	if not contact:
		frappe.get_doc(
			{
				"doctype": "Contact",
				"first_name": "Website",
				"last_name": "Compatibility",
				"email_ids": [{"email_id": TEST_CUSTOMER_EMAIL, "is_primary": 1}],
				"links": [{"link_doctype": "Customer", "link_name": customer}],
			}
		).insert(ignore_permissions=True)

	frappe.db.commit()
	return {
		"company": company,
		"currency": currency,
		"item_code": TEST_ITEM_CODE,
		"customer": customer,
		"customer_email": TEST_CUSTOMER_EMAIL,
	}
