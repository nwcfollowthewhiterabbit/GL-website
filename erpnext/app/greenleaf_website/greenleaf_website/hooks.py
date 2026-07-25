app_name = "greenleaf_website"
app_title = "Green Leaf Website"
app_publisher = "Green Leaf Pacific"
app_description = "Portable ERPNext layer for the Green Leaf storefront"
app_email = "tech@greenleafpacific.com"
app_license = "mit"

required_apps = ["erpnext"]

fixtures = [
	{
		"dt": "Custom Field",
		"filters": [["name", "in", [
			"Quotation-website_quote_id",
			"Quotation-website_source",
			"Quotation-website_customer_email",
			"Quotation-website_payload",
			"Customer-website_origin",
			"Customer-website_last_quote_request",
			"Item Group-website_show_on_storefront",
			"Item Group-website_sort_order",
			"Item Group-website_price_mode",
			"Item Group-website_price_list",
			"Item Group-website_stock_display",
			"Item Group-website_show_products_without_images",
			"Item Group-website_show_products_without_price",
			"Item Group-website_category_note",
			"Item-website_show_on_storefront",
			"Item-website_featured",
			"Item-website_price_mode_override",
			"Item-website_stock_display_override",
			"Item-website_sort_order",
		]]],
	},
]
