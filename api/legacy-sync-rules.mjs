export const legacySyncRules = {
  catalog: {
    direction: "erpnext_to_storefront",
    source: {
      item: "tabItem",
      price: "tabItem Price",
      stock: "tabBin",
      warehouse: "tabWarehouse"
    },
    defaults: {
      priceList: process.env.DEFAULT_PRICE_LIST || "Standard Selling",
      currency: process.env.DEFAULT_CURRENCY || "FJD",
      excludedWarehouses: ["Showroom - GL", "Furniture Showroom (Upstairs) - GL"],
      excludedWarehousePattern: "showroom"
    },
    behavior: [
      "disable products without a positive selling price",
      "floor sellable quantity to an integer",
      "exclude showroom warehouses from stock availability",
      "preserve SKU as the stable item identity",
      "treat new item insertion as an explicit migration action"
    ]
  },
  quote: {
    direction: "storefront_to_erpnext",
    targetDoctype: "Quotation",
    defaults: {
      company: process.env.ERP_COMPANY || "Green Leaf Ltd",
      customerGroup: process.env.ERP_CUSTOMER_GROUP || "Individual",
      territory: process.env.ERP_TERRITORY || "Nadi, Lautoka",
      priceList: process.env.DEFAULT_PRICE_LIST || "Standard Selling"
    },
    idempotency: {
      legacyMarker: "OpenCart Order #<order_id>",
      newMarker: "Green Leaf Website Quote #<quote_request_id>"
    },
    behavior: [
      "match customers by email where possible",
      "create deterministic WEB customers for new buyers",
      "only submit SKU lines that exist in ERPNext",
      "return missing SKU lines instead of silently dropping them",
      "create quotation first, not sales order"
    ]
  }
};
