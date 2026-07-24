import { useEffect, useState } from "react";
import { websiteCatalogDownloads } from "../data/catalogDownloadsSeed.mjs";
import { heroBanners } from "../data/heroBannersSeed.mjs";
import { websiteManufacturers } from "../data/manufacturersSeed.mjs";
import { websiteCategories } from "../data/websiteCategories";
import {
  fetchCustomerCornerSettingsResource,
  fetchFeaturedCatalogProducts,
  fetchWebsiteBannersResource,
  fetchWebsiteCatalogsResource,
  fetchWebsiteDepartmentsResource,
  fetchWebsiteManufacturersResource
} from "../lib/api";
import type {
  CatalogProduct,
  CustomerCornerSettings,
  StorefrontContentSources,
  WebsiteBanner,
  WebsiteCatalogDownload,
  WebsiteCategory,
  WebsiteManufacturer
} from "../types";

const fallbackCustomerCornerSettings: CustomerCornerSettings = {
  enabled: true,
  loginEnabled: false,
  showQuoteHistory: true,
  showPurchaseHistory: true,
  title: "Customer account for trade buyers.",
  introCopy: "Sign in with your Green Leaf customer credentials to view quotations, orders, invoices and current statuses.",
  salesEmail: "buy@greenleafpacific.com",
  salesPhone: "+679 670 2222",
  paymentNote: "In-stock items use full payment; special-order items require a 70% deposit."
};

const initialSources: StorefrontContentSources = {
  departments: "loading",
  banners: "loading",
  catalogs: "loading",
  manufacturers: "loading",
  customerCorner: "loading"
};

export function useStorefrontContent() {
  const [departments, setDepartments] = useState<WebsiteCategory[]>(websiteCategories);
  const [banners, setBanners] = useState<WebsiteBanner[]>(heroBanners as WebsiteBanner[]);
  const [catalogs, setCatalogs] = useState<WebsiteCatalogDownload[]>(
    websiteCatalogDownloads as WebsiteCatalogDownload[]
  );
  const [manufacturers, setManufacturers] = useState<WebsiteManufacturer[]>(
    websiteManufacturers as WebsiteManufacturer[]
  );
  const [customerCorner, setCustomerCorner] = useState<CustomerCornerSettings>(fallbackCustomerCornerSettings);
  const [recommendedProducts, setRecommendedProducts] = useState<CatalogProduct[]>([]);
  const [sources, setSources] = useState<StorefrontContentSources>(initialSources);

  useEffect(() => {
    let ignore = false;

    Promise.allSettled([
      fetchWebsiteDepartmentsResource(),
      fetchWebsiteBannersResource(),
      fetchWebsiteCatalogsResource(),
      fetchWebsiteManufacturersResource(),
      fetchCustomerCornerSettingsResource(),
      fetchFeaturedCatalogProducts(8)
    ]).then(([departmentResult, bannerResult, catalogResult, manufacturerResult, customerCornerResult, productsResult]) => {
      if (ignore) return;

      const nextSources = { ...initialSources };
      if (departmentResult.status === "fulfilled") {
        const valid = departmentResult.value.departments.filter((department) => department.itemGroups.length);
        if (valid.length) setDepartments(valid);
        nextSources.departments = valid.length ? departmentResult.value.source : "local_static_departments";
      } else {
        nextSources.departments = "local_static_departments";
      }

      if (bannerResult.status === "fulfilled") {
        const valid = bannerResult.value.banners.filter((banner) => banner.image && banner.title);
        if (valid.length) setBanners(valid);
        nextSources.banners = valid.length ? bannerResult.value.source : "local_static_banners";
      } else {
        nextSources.banners = "local_static_banners";
      }

      if (catalogResult.status === "fulfilled") {
        const valid = catalogResult.value.catalogs.filter((catalog) => catalog.fileUrl && catalog.title);
        if (valid.length) setCatalogs(valid);
        nextSources.catalogs = valid.length ? catalogResult.value.source : "local_static_catalogs";
      } else {
        nextSources.catalogs = "local_static_catalogs";
      }

      if (manufacturerResult.status === "fulfilled") {
        const valid = manufacturerResult.value.manufacturers.filter((manufacturer) => manufacturer.logo && manufacturer.name);
        if (valid.length) setManufacturers(valid);
        nextSources.manufacturers = valid.length ? manufacturerResult.value.source : "local_static_manufacturers";
      } else {
        nextSources.manufacturers = "local_static_manufacturers";
      }

      if (customerCornerResult.status === "fulfilled" && customerCornerResult.value.settings) {
        setCustomerCorner(customerCornerResult.value.settings);
        nextSources.customerCorner = customerCornerResult.value.source;
      } else {
        nextSources.customerCorner = "local_static_customer_corner";
      }

      if (productsResult.status === "fulfilled") setRecommendedProducts(productsResult.value);
      setSources(nextSources);
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const fallbackSources = Object.entries(sources).filter(([, source]) => source.includes("fallback") || source.includes("local_static"));
    if (fallbackSources.length) {
      console.warn("Storefront is using fallback content", Object.fromEntries(fallbackSources));
    }
  }, [sources]);

  return {
    departments,
    banners,
    catalogs,
    manufacturers,
    customerCorner,
    recommendedProducts,
    sources
  };
}
