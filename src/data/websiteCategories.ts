import type { ItemGroup, WebsiteCategory } from "../types";

export const websiteCategories: WebsiteCategory[] = [
  {
    id: "kitchen-equipment",
    label: "Kitchen & Equipment",
    description: "Cooking, countertop, refrigeration, food prep and back-of-house equipment.",
    featured: true,
    itemGroups: [
      "Kitchen",
      "Gas Equipment AU/NZ",
      "Countertop AU/NZ",
      "Counter Top Fiji",
      "Kitchen Equipment AU",
      "Kitchenware Fiji",
      "Refrigeration AU/NZ",
      "Commercial kitchen equipment",
      "commercial kitchens"
    ]
  },
  {
    id: "front-of-house",
    label: "Front of House",
    description: "Crockery, glassware, cutlery, table accessories and dining service items.",
    featured: true,
    itemGroups: [
      "Front of the House",
      "Crockery AU/NZ",
      "Crockery SG",
      "Crockery US",
      "Crockery China",
      "Glassware AU/NZ",
      "Glassware EU",
      "Glassware US",
      "Glassware China",
      "Cutlery AU/NZ",
      "Cutlery US",
      "Cutlery China",
      "Table Accessories",
      "Polycarbonate AU/NZ",
      "Polycarbonate China"
    ]
  },
  {
    id: "buffet-table-service",
    label: "Buffet & Table Service",
    description: "Buffet serving, buffet display, table service and catering presentation.",
    featured: true,
    itemGroups: ["Buffetware", "Buffetware AU", "Buffet Display Ware", "Buffet Serving Ware"]
  },
  {
    id: "housekeeping-cleaning",
    label: "Housekeeping & Cleaning",
    description: "Housekeeping supplies, cleaning equipment, chemicals, bedding and guest room items.",
    featured: true,
    itemGroups: [
      "Housekeeping & Cleaning",
      "House Keeping Items AU/NZ",
      "House Keeping Items China",
      "House Keeping Items US",
      "Karcher AU",
      "Cleaning Services",
      "Bedding",
      "Chemicals AU/NZ",
      "Chemicals China",
      "Chemicals US",
      "office cleaning",
      "Decoration"
    ]
  },
  {
    id: "furniture-fitouts",
    label: "Furniture & Fitouts",
    description: "Joinery, commercial furniture, mattresses, outdoor fitouts and signage.",
    featured: true,
    itemGroups: [
      "Furniture and fitouts",
      "Joinery",
      "Non-Wooden Furniture",
      "Mattresses",
      "Trex Decking",
      "Artificial decor items",
      "Outdor-Indoor Signs",
      "Decking",
      "Office  Furniture"
    ]
  },
  {
    id: "eco-disposables",
    label: "Eco-Friendly Disposables",
    description: "Disposable packaging and environmentally focused hospitality consumables.",
    itemGroups: ["Eco-Friendly Disposables", "Eco-Friendly Disposables AU/NZ"]
  },
  {
    id: "coffee-iced-tea",
    label: "Coffee & Iced Tea",
    description: "Coffee, iced tea, brewers, dispensers, capsules, bags and beverage accessories.",
    itemGroups: [
      "Iced Tea & Coffee",
      "Iced Tea",
      "Coffee Bags",
      "Coffee Capsules",
      "Iced Tea & Coffee Accessories",
      "Iced Tea & Coffee Brewers",
      "Iced Tea & Coffee Dispensers",
      "Iced Tea & Coffee Disposables",
      "Iced Tea & Coffee Supplements",
      "Room Coffee Machines"
    ]
  },
  {
    id: "specialty-service",
    label: "Specialty & Service",
    description: "Special-order products, services and smaller operational categories.",
    itemGroups: ["Ice Cream", "Ice Cream Machines", "Ice Cream Mix"]
  }
];

export function findWebsiteCategory(id: string) {
  return websiteCategories.find((category) => category.id === id);
}

export function itemGroupMap(itemGroups: ItemGroup[]) {
  return new Map(itemGroups.map((group) => [group.name, group]));
}

export function matchedItemGroups(category: WebsiteCategory, itemGroups: ItemGroup[]) {
  const available = itemGroupMap(itemGroups);
  return category.itemGroups.filter((name) => available.has(name));
}

export function websiteCategoryCount(category: WebsiteCategory, itemGroups: ItemGroup[]) {
  const available = itemGroupMap(itemGroups);
  return category.itemGroups.reduce((sum, name) => sum + (available.get(name)?.itemCount || 0), 0);
}
