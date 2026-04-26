import type { ItemGroup, WebsiteCategory } from "../types";
import { websiteCategories as websiteCategoryData } from "./websiteCategoriesSeed.mjs";

export const websiteCategories = websiteCategoryData as WebsiteCategory[];

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
