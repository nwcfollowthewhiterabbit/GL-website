import { DatabaseZap, FileText, PackageCheck, Wrench } from "lucide-react";

export const erpFeatures = [
  {
    title: "Item master sync",
    text: "SKU, barcode, item group, brand, UOM and image fields are shaped for ERPNext mapping.",
    icon: DatabaseZap
  },
  {
    title: "Quote first workflow",
    text: "Cart can become a sales quotation before checkout, matching B2B purchasing habits.",
    icon: FileText
  },
  {
    title: "Stock by warehouse",
    text: "Cards reserve room for live availability by Fiji location, inbound shipment, and lead time.",
    icon: PackageCheck
  },
  {
    title: "Service and warranty",
    text: "Equipment pages can link warranty terms, spare parts, and service requests back to ERPNext.",
    icon: Wrench
  }
];
