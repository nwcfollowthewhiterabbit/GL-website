import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AccountPage } from "./components/AccountPage";
import { CatalogDownloadsSection } from "./components/CatalogDownloadsSection";
import { CatalogSection } from "./components/CatalogSection";
import { HeroSection } from "./components/HeroSection";
import { LegacyContentSection } from "./components/LegacyContentSection";
import { ProductDetailPage } from "./components/ProductDetailPage";
import { ProductModal } from "./components/ProductModal";
import { QuoteDrawer } from "./components/QuoteDrawer";
import { RecommendedProductsSection } from "./components/RecommendedProductsSection";
import { ServiceContactSection } from "./components/ServiceContactSection";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { featuredProducts as fallbackProducts } from "./data/catalog";
import { websiteCatalogDownloads as fallbackWebsiteCatalogs } from "./data/catalogDownloadsSeed.mjs";
import { heroBanners as fallbackHeroBanners } from "./data/heroBannersSeed.mjs";
import { websiteManufacturers as fallbackWebsiteManufacturers } from "./data/manufacturersSeed.mjs";
import {
  matchedItemGroups,
  websiteCategories as fallbackWebsiteCategories,
  websiteCategoryCount
} from "./data/websiteCategories";
import {
  createQuoteRequest,
  fetchAccountOrderDetail,
  fetchAccountQuoteDetail,
  fetchAccountSession,
  fetchAccountQuotes,
  fetchCatalogDiagnostics,
  fetchCatalogProduct,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchCatalogSuggestions,
  fetchCustomerCornerSettings,
  fetchFeaturedCatalogProducts,
  fetchItemGroups,
  fetchRecentQuotes,
  fetchRelatedCatalogProducts,
  fetchWebsiteBanners,
  fetchWebsiteCatalogs,
  fetchWebsiteDepartments,
  fetchWebsiteManufacturers,
  logoutAccount,
  startAccountLogin,
  verifyAccountLogin
} from "./lib/api";
import { catalogPath, departmentCategoryPath, findCategoryBySlug, parseStorefrontRoute, productPath, type StorefrontRoute } from "./lib/routes";
import type {
  CatalogDiagnostics,
  CatalogFacets,
  CatalogProduct,
  CatalogSuggestion,
  AccountSession,
  AccountDocumentDetail,
  CustomerCornerSettings,
  ItemGroup,
  QuoteLine,
  QuoteRequestResponse,
  QuoteResult,
  RecentQuote,
  WebsiteBanner,
  WebsiteCatalogDownload,
  WebsiteCategory,
  WebsiteManufacturer
} from "./types";
import "./main.css";

const PAGE_SIZE = 12;

const fallbackCustomerCornerSettings: CustomerCornerSettings = {
  enabled: true,
  loginEnabled: true,
  showQuoteHistory: true,
  showPurchaseHistory: true,
  title: "Customer account for trade buyers.",
  introCopy: "Use one email login to track website quotations, ERP purchase history and the next action from Green Leaf sales.",
  salesEmail: "buy@greenleafpacific.com",
  salesPhone: "+679 670 2222",
  paymentNote: "Payment link will be added after Windcave approval."
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function quotationName(data: QuoteRequestResponse) {
  if (typeof data.quotation === "string") return data.quotation;
  return data.quotation?.name || "";
}

function quoteResultFromResponse(data: QuoteRequestResponse, email: string, options: Pick<QuoteResult, "reused" | "dryRun"> = {}): QuoteResult {
  const name = quotationName(data) || data.id || "Validated quote request";
  const missingSkus = (data.missing || []).map((line) => line.sku).filter(Boolean);
  return {
    name,
    id: data.id,
    missingCount: missingSkus.length,
    missingSkus,
    validLineCount: data.validLines?.length,
    customerEmail: email,
    ...options
  };
}

function scrollToPageTopInstantly() {
  const root = document.documentElement;
  const body = document.body;
  const rootScrollBehavior = root.style.scrollBehavior;
  const bodyScrollBehavior = body.style.scrollBehavior;

  root.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";
  root.scrollTop = 0;
  body.scrollTop = 0;
  window.scrollTo(0, 0);
  root.style.scrollBehavior = rootScrollBehavior;
  body.style.scrollBehavior = bodyScrollBehavior;
}

function App() {
  const [erpProducts, setErpProducts] = useState<CatalogProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "fallback">("loading");
  const [quoteCompany, setQuoteCompany] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("");
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [websiteDepartments, setWebsiteDepartments] = useState<WebsiteCategory[]>([]);
  const [websiteBanners, setWebsiteBanners] = useState<WebsiteBanner[]>([]);
  const [websiteCatalogs, setWebsiteCatalogs] = useState<WebsiteCatalogDownload[]>([]);
  const [websiteManufacturers, setWebsiteManufacturers] = useState<WebsiteManufacturer[]>([]);
  const [customerCornerSettings, setCustomerCornerSettings] = useState<CustomerCornerSettings>(fallbackCustomerCornerSettings);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogSort, setCatalogSort] = useState("featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeWebsiteCategory, setActiveWebsiteCategory] = useState("");
  const [page, setPage] = useState(1);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [route, setRoute] = useState<StorefrontRoute>(() => parseStorefrontRoute());
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [previewProduct, setPreviewProduct] = useState<CatalogProduct | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<CatalogProduct[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [catalogSuggestionsLoading, setCatalogSuggestionsLoading] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [accountDevCode, setAccountDevCode] = useState("");
  const [accountToken, setAccountToken] = useState("");
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [accountQuotes, setAccountQuotes] = useState<RecentQuote[]>([]);
  const [accountStatus, setAccountStatus] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountDetail, setAccountDetail] = useState<AccountDocumentDetail | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);
  const websiteNavigationCategories = websiteDepartments.length ? websiteDepartments : fallbackWebsiteCategories;
  const heroBanners = websiteBanners.length ? websiteBanners : (fallbackHeroBanners as WebsiteBanner[]);
  const catalogDownloads = websiteCatalogs.length
    ? websiteCatalogs
    : (fallbackWebsiteCatalogs as WebsiteCatalogDownload[]);
  const manufacturerLogos = websiteManufacturers.length
    ? websiteManufacturers
    : (fallbackWebsiteManufacturers as WebsiteManufacturer[]);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const handlePopState = () => setRoute(parseStorefrontRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updateParallax = () => {
      frame = 0;
      const offset = motionQuery.matches ? 0 : Math.round(window.scrollY * -0.08);
      document.documentElement.style.setProperty("--parallax-offset", `${offset}px`);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    motionQuery.addEventListener("change", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      motionQuery.removeEventListener("change", requestUpdate);
      document.documentElement.style.removeProperty("--parallax-offset");
    };
  }, []);

  useLayoutEffect(() => {
    if (route.view !== "product") return;
    scrollToPageTopInstantly();
  }, [route]);

  useEffect(() => {
    if (route.view !== "catalog" || route.search === undefined) return;
    setSearchTerm(route.search);
    setPage(1);
  }, [route.view, route.search]);

  useEffect(() => {
    let ignore = false;
    const activeWebsiteDepartment = websiteNavigationCategories.find((category) => category.id === activeWebsiteCategory);
    setCatalogState("loading");
    setErpProducts([]);
    setCatalogTotal(null);

    fetchCatalogProducts({
      page,
      pageSize: PAGE_SIZE,
      q: searchTerm,
      category: activeCategory,
      sort: catalogSort,
      minPrice,
      maxPrice,
      categories:
        !activeCategory && activeWebsiteDepartment ? matchedItemGroups(activeWebsiteDepartment, itemGroups) : undefined
    })
      .then((data) => {
        if (ignore) return;
        setErpProducts(data.products || []);
        setCatalogTotal(data.total || null);
        setCatalogState("ready");
      })
      .catch(() => {
        if (ignore) return;
        setErpProducts([]);
        setCatalogState("fallback");
      });

    return () => {
      ignore = true;
    };
  }, [activeCategory, activeWebsiteCategory, catalogSort, itemGroups, maxPrice, minPrice, page, searchTerm, websiteDepartments]);

  useEffect(() => {
    fetchCatalogFacets()
      .then((facets) => {
        setCatalogFacets(facets);
        setItemGroups(facets.itemGroups || []);
      })
      .catch(() => {
        setCatalogFacets(null);
        fetchItemGroups()
          .then((groups) => setItemGroups(groups.filter((group: ItemGroup) => group.itemCount > 0)))
          .catch(() => setItemGroups([]));
      });
  }, []);

  useEffect(() => {
    fetchWebsiteDepartments()
      .then((departments) => setWebsiteDepartments(departments.filter((department) => department.itemGroups.length)))
      .catch(() => setWebsiteDepartments([]));
  }, []);

  useEffect(() => {
    fetchWebsiteBanners()
      .then((banners) => setWebsiteBanners(banners.filter((banner) => banner.image && banner.title)))
      .catch(() => setWebsiteBanners([]));
  }, []);

  useEffect(() => {
    fetchWebsiteCatalogs()
      .then((catalogs) => setWebsiteCatalogs(catalogs.filter((catalog) => catalog.fileUrl && catalog.title)))
      .catch(() => setWebsiteCatalogs([]));
  }, []);

  useEffect(() => {
    fetchWebsiteManufacturers()
      .then((manufacturers) => setWebsiteManufacturers(manufacturers.filter((manufacturer) => manufacturer.logo && manufacturer.name)))
      .catch(() => setWebsiteManufacturers([]));
  }, []);

  useEffect(() => {
    fetchCustomerCornerSettings()
      .then((settings) => setCustomerCornerSettings(settings || fallbackCustomerCornerSettings))
      .catch(() => setCustomerCornerSettings(fallbackCustomerCornerSettings));
  }, []);

  useEffect(() => {
    const q = searchTerm.trim();
    if (!q) {
      setCatalogSuggestions([]);
      setCatalogSuggestionsLoading(false);
      return;
    }

    let ignore = false;
    setCatalogSuggestionsLoading(true);
    const timer = window.setTimeout(() => {
      fetchCatalogSuggestions(q, 8)
        .then((suggestions) => {
          if (ignore) return;
          const lower = q.toLowerCase();
          const departmentSuggestions = websiteNavigationCategories
            .filter((department) => department.label.toLowerCase().includes(lower))
            .slice(0, 3)
            .map((department) => ({
              id: `department:${department.id}`,
              type: "department" as const,
              label: department.label,
              detail: "Department",
              departmentId: department.id
            }));
          setCatalogSuggestions([...departmentSuggestions, ...suggestions].slice(0, 8));
        })
        .catch(() => {
          if (!ignore) setCatalogSuggestions([]);
        })
        .finally(() => {
          if (!ignore) setCatalogSuggestionsLoading(false);
        });
    }, 120);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm, websiteNavigationCategories]);

  useEffect(() => {
    if (route.view !== "catalog" || !route.categorySlug || !itemGroups.length) return;
    const department = websiteNavigationCategories.find((category) => category.id === route.categorySlug);
    if (department) {
      setActiveWebsiteCategory(department.id);
      setActiveCategory(findCategoryBySlug(matchedItemGroups(department, itemGroups), route.itemGroupSlug));
      setPage(1);
      return;
    }

    const category = findCategoryBySlug(
      itemGroups.map((group) => group.name),
      route.categorySlug
    );
    setActiveWebsiteCategory("");
    setActiveCategory(category);
    setPage(1);
  }, [itemGroups, route, websiteDepartments]);

  useEffect(() => {
    if (route.view !== "product") {
      setProductLoading(false);
      setRelatedProducts([]);
      return;
    }

    const localProduct = [...erpProducts, ...fallbackProducts].find((product) => product.sku === route.sku);
    if (localProduct) {
      setActiveProduct(localProduct);
    }

    let ignore = false;
    setProductLoading(true);
    fetchCatalogProduct(route.sku)
      .then((product) => {
        if (ignore) return;
        setActiveProduct(product);
        return fetchRelatedCatalogProducts(product.sku, 4).catch(() => []);
      })
      .then((related) => {
        if (ignore || !related) return;
        setRelatedProducts(related);
      })
      .catch(() => {
        if (ignore) return;
        setActiveProduct(localProduct || null);
        setRelatedProducts([]);
      })
      .finally(() => {
        if (!ignore) setProductLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [erpProducts, route]);

  useEffect(() => {
    fetchCatalogDiagnostics()
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null));
  }, []);

  useEffect(() => {
    fetchFeaturedCatalogProducts(8)
      .then(setRecommendedProducts)
      .catch(() => setRecommendedProducts([]));
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("greenleaf.quoteLines");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setQuoteLines(parsed);
      }
    } catch {
      window.localStorage.removeItem("greenleaf.quoteLines");
    }
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("greenleaf.accountToken") || "";
    if (savedToken) setAccountToken(savedToken);
  }, []);

  useEffect(() => {
    if (!accountToken) return;
    setAccountLoading(true);
    fetchAccountSession(accountToken)
      .then((account) => {
        setAccountSession(account);
        setAccountEmail(account.email);
        setAccountQuotes(account.quotes || []);
        setAccountStatus("");
      })
      .catch(() => {
        window.localStorage.removeItem("greenleaf.accountToken");
        setAccountToken("");
        setAccountSession(null);
        setAccountStatus("Account session expired. Send a new login code.");
      })
      .finally(() => setAccountLoading(false));
  }, [accountToken]);

  useEffect(() => {
    window.localStorage.setItem("greenleaf.quoteLines", JSON.stringify(quoteLines));
  }, [quoteLines]);

  function refreshRecentQuotes() {
    fetchRecentQuotes(5)
      .then(setRecentQuotes)
      .catch(() => setRecentQuotes([]));
  }

  useEffect(() => {
    refreshRecentQuotes();
  }, []);

  const products = useMemo<CatalogProduct[]>(() => {
    if (catalogState === "fallback") return fallbackProducts;
    return erpProducts;
  }, [catalogState, erpProducts]);

  const quoteCount = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const quoteTotal = quoteLines.reduce((sum, line) => {
    const price = typeof line.price === "number" ? line.price : 0;
    return sum + price * line.qty;
  }, 0);

  const visibleCategories = useMemo(() => {
    return websiteNavigationCategories.map((category) => ({
      ...category,
      itemCount: websiteCategoryCount(category, itemGroups),
      availableItemGroups: matchedItemGroups(category, itemGroups)
    }));
  }, [itemGroups, websiteNavigationCategories]);

  const topFacetGroups = useMemo(() => {
    const activeDepartment = websiteNavigationCategories.find((category) => category.id === activeWebsiteCategory);
    if (activeDepartment) {
      const allowed = new Set(matchedItemGroups(activeDepartment, itemGroups));
      return itemGroups
        .filter((group) => allowed.has(group.name) && group.itemCount > 0)
        .sort((a, b) => b.itemCount - a.itemCount);
    }
    return itemGroups.filter((group) => !group.isGroup && group.itemCount > 0).sort((a, b) => b.itemCount - a.itemCount);
  }, [activeWebsiteCategory, itemGroups, websiteNavigationCategories]);

  const totalPages = Math.max(1, Math.ceil((catalogTotal || products.length) / PAGE_SIZE));

  function navigate(path: string, nextRoute = parseStorefrontRoute(path)) {
    window.history.pushState({}, "", path);
    if (nextRoute.view === "product") {
      flushSync(() => {
        setRoute(nextRoute);
      });
      scrollToPageTopInstantly();
      return;
    }
    setRoute(nextRoute);
  }

  function setCategory(category: string) {
    const activeDepartment = websiteNavigationCategories.find((item) => item.id === activeWebsiteCategory);
    const categoryBelongsToActiveDepartment = activeDepartment
      ? matchedItemGroups(activeDepartment, itemGroups).includes(category)
      : false;

    if (!categoryBelongsToActiveDepartment) {
      setActiveWebsiteCategory("");
    }
    setActiveCategory(category);
    setPage(1);
    if (categoryBelongsToActiveDepartment && activeDepartment) {
      navigate(departmentCategoryPath(activeDepartment.id, category));
    } else {
      navigate(catalogPath(category), { view: "catalog", categorySlug: undefined });
    }
  }

  function setDepartment(categoryId: string) {
    setActiveWebsiteCategory(categoryId);
    setActiveCategory("");
    setPage(1);
    navigate(categoryId ? `/catalog/${categoryId}` : "/catalog", { view: "catalog", categorySlug: categoryId || undefined });
  }

  function setSearch(value: string) {
    setSearchTerm(value);
    setPage(1);
    if (route.view !== "catalog") {
      navigate(activeWebsiteCategory ? `/catalog/${activeWebsiteCategory}` : catalogPath(activeCategory));
    }
  }

  function setSort(value: string) {
    setCatalogSort(value);
    setPage(1);
  }

  function setPriceFilter(kind: "min" | "max", value: string) {
    const normalized = value.replace(/[^\d.]/g, "");
    if (kind === "min") setMinPrice(normalized);
    else setMaxPrice(normalized);
    setPage(1);
  }

  function openProductPreview(product: CatalogProduct) {
    setPreviewProduct(product);
  }

  function openProductPage(product: CatalogProduct) {
    setActiveProduct(product);
    navigate(productPath(product.sku), { view: "product", sku: product.sku });
  }

  function selectCatalogSuggestion(suggestion: CatalogSuggestion) {
    if (suggestion.type === "product" && suggestion.sku) {
      navigate(productPath(suggestion.sku), { view: "product", sku: suggestion.sku });
      return;
    }

    if (suggestion.type === "department" && suggestion.departmentId) {
      setSearchTerm("");
      setDepartment(suggestion.departmentId);
      return;
    }

    if (suggestion.type === "item_group" && suggestion.category) {
      setSearchTerm("");
      setCategory(suggestion.category);
    }
  }

  function backToCatalog() {
    navigate(activeWebsiteCategory ? `/catalog/${activeWebsiteCategory}` : catalogPath(activeCategory), {
      view: "catalog",
      categorySlug: activeWebsiteCategory || undefined
    });
  }

  function addToQuote(product: CatalogProduct) {
    setQuoteResult(null);
    setQuoteLines((current) => {
      const existing = current.find((line) => line.sku === product.sku);
      if (existing) {
        return current.map((line) => (line.sku === product.sku ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...current, { ...product, qty: 1 }];
    });
    setQuoteOpen(true);
  }

  function setLineQty(sku: string, qty: number) {
    setQuoteResult(null);
    setQuoteLines((current) =>
      current
        .map((line) => (line.sku === sku ? { ...line, qty: Math.max(1, qty) } : line))
        .filter((line) => line.qty > 0)
    );
  }

  function removeLine(sku: string) {
    setQuoteResult(null);
    setQuoteLines((current) => current.filter((line) => line.sku !== sku));
  }

  function validateQuoteForm(requireLines: boolean) {
    if (requireLines && !quoteLines.length) return "Add at least one product.";
    if (!quoteCompany.trim()) return "Company name is required.";
    if (!quoteEmail.trim()) return "Buyer email is required.";
    if (!isValidEmail(quoteEmail)) return "Enter a valid buyer email.";
    return "";
  }

  async function submitQuickQuote() {
    const validationError = validateQuoteForm(false);
    if (validationError) {
      setQuoteResult(null);
      setQuoteStatus(validationError);
      return;
    }

    const product = products[0];
    if (!product?.sku) {
      setQuoteStatus("Catalog is still loading.");
      return;
    }

    setQuoteSubmitting(true);
    setQuoteResult(null);
    setQuoteStatus("Sending quote request...");
    try {
      const data = await createQuoteRequest({
        customer: {
          company: quoteCompany,
          email: quoteEmail
        },
        lines: [{ sku: product.sku, qty: 1 }],
        notes: "Quick quote from storefront hero form"
      });

      const name = quotationName(data);
      if (name && typeof data.quotation !== "string") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail));
        setQuoteStatus("Quote request sent. Green Leaf sales will confirm price, stock and lead time.");
        refreshRecentQuotes();
      } else if (name) {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { reused: true }));
        setQuoteStatus("This quote request was already received. We opened the existing ERP quotation.");
      } else if (data.mode === "validated_dry_run") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { dryRun: true }));
        setQuoteStatus("Validated locally. ERPNext REST credentials are not configured.");
      } else {
        setQuoteStatus(data.error || "Quote request processed.");
      }
    } catch {
      setQuoteStatus("Quote request failed.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function submitQuote() {
    const validationError = validateQuoteForm(true);
    if (validationError) {
      setQuoteResult(null);
      setQuoteStatus(validationError);
      return;
    }

    setQuoteSubmitting(true);
    setQuoteResult(null);
    setQuoteStatus("Creating ERPNext quotation...");
    try {
      const data = await createQuoteRequest({
        customer: {
          company: quoteCompany,
          contact: buyerContact,
          email: quoteEmail,
          phone: buyerPhone
        },
        lines: quoteLines.map((line) => ({ sku: line.sku, qty: line.qty })),
        notes: quoteNotes || "Quote basket from storefront"
      });

      const name = quotationName(data);
      if (name && typeof data.quotation !== "string") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail));
        setQuoteStatus("Quote request sent. Green Leaf sales will confirm price, stock and lead time.");
        setQuoteLines([]);
        refreshRecentQuotes();
      } else if (name) {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { reused: true }));
        setQuoteStatus("This quote request was already received. We opened the existing ERP quotation.");
        setQuoteLines([]);
      } else if (data.mode === "validation_failed") {
        setQuoteStatus("No valid ERPNext items in basket.");
      } else if (data.mode === "validated_dry_run") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { dryRun: true }));
        setQuoteStatus("Validated locally. ERPNext REST credentials are not configured.");
      } else {
        setQuoteStatus(data.error || "Quote request processed.");
      }
    } catch {
      setQuoteStatus("Quote request failed.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function loadAccountQuotes() {
    if (!isValidEmail(accountEmail)) {
      setAccountStatus("Enter a valid buyer email.");
      setAccountQuotes([]);
      return;
    }

    setAccountLoading(true);
    setAccountStatus("Loading quote history...");
    try {
      const quotes = await fetchAccountQuotes(accountEmail, 20);
      setAccountQuotes(quotes);
      setAccountStatus(quotes.length ? `${quotes.length} quotation${quotes.length === 1 ? "" : "s"} found.` : "No quotations found.");
    } catch {
      setAccountQuotes([]);
      setAccountStatus("Quote history could not be loaded.");
    } finally {
      setAccountLoading(false);
    }
  }

  async function beginAccountLogin() {
    if (!isValidEmail(accountEmail)) {
      setAccountStatus("Enter a valid buyer email.");
      return;
    }

    setAccountLoading(true);
    setAccountStatus("Sending login code...");
    setAccountDevCode("");
    try {
      const result = await startAccountLogin(accountEmail);
      if (!result.ok) {
        setAccountStatus("Login code could not be sent.");
        return;
      }
      setAccountEmail(result.email || accountEmail);
      setAccountDevCode(result.devCode || "");
      setAccountStatus(result.devCode ? "Code generated for local testing." : "Check your email for the login code.");
    } catch {
      setAccountStatus("Login code could not be sent.");
    } finally {
      setAccountLoading(false);
    }
  }

  async function completeAccountLogin() {
    if (!isValidEmail(accountEmail)) {
      setAccountStatus("Enter a valid buyer email.");
      return;
    }
    if (!accountCode.trim()) {
      setAccountStatus("Enter the login code.");
      return;
    }

    setAccountLoading(true);
    setAccountStatus("Verifying login code...");
    try {
      const result = await verifyAccountLogin(accountEmail, accountCode);
      if (!result.ok || !result.token) {
        setAccountStatus("Invalid or expired login code.");
        return;
      }
      window.localStorage.setItem("greenleaf.accountToken", result.token);
      setAccountToken(result.token);
      setAccountCode("");
      setAccountDevCode("");
      setAccountStatus("Signed in.");
    } catch {
      setAccountStatus("Login failed.");
    } finally {
      setAccountLoading(false);
    }
  }

  function refreshAccount() {
    if (!accountToken) return;
    setAccountLoading(true);
    fetchAccountSession(accountToken)
      .then((account) => {
        setAccountSession(account);
        setAccountQuotes(account.quotes || []);
        setAccountStatus("Account refreshed.");
      })
      .catch(() => setAccountStatus("Account data could not be loaded."))
      .finally(() => setAccountLoading(false));
  }

  async function viewAccountQuote(name: string) {
    if (!accountToken) {
      setAccountStatus("Sign in to view quotation details.");
      return;
    }
    setAccountDetailLoading(true);
    setAccountStatus("Loading quotation details...");
    try {
      setAccountDetail(await fetchAccountQuoteDetail(accountToken, name));
      setAccountStatus("");
    } catch {
      setAccountStatus("Quotation details could not be loaded.");
    } finally {
      setAccountDetailLoading(false);
    }
  }

  async function viewAccountOrder(name: string) {
    if (!accountToken) {
      setAccountStatus("Sign in to view order details.");
      return;
    }
    setAccountDetailLoading(true);
    setAccountStatus("Loading order details...");
    try {
      setAccountDetail(await fetchAccountOrderDetail(accountToken, name));
      setAccountStatus("");
    } catch {
      setAccountStatus("Order details could not be loaded.");
    } finally {
      setAccountDetailLoading(false);
    }
  }

  async function signOutAccount() {
    if (accountToken) await logoutAccount(accountToken).catch(() => undefined);
    window.localStorage.removeItem("greenleaf.accountToken");
    setAccountToken("");
    setAccountSession(null);
    setAccountQuotes([]);
    setAccountDetail(null);
    setAccountCode("");
    setAccountDevCode("");
    setAccountStatus("Signed out.");
  }

  return (
    <main className="app">
      <SiteHeader departments={websiteNavigationCategories} quoteCount={quoteCount} onOpenQuote={() => setQuoteOpen(true)} />
      {route.view !== "product" ? (
        <HeroSection banners={heroBanners} />
      ) : null}
      {route.view === "account" ? (
        <AccountPage
          email={accountEmail}
          code={accountCode}
          quotes={accountQuotes}
          account={accountSession}
          status={accountStatus}
          devCode={accountDevCode}
          isLoading={accountLoading}
          isAuthenticated={Boolean(accountToken && accountSession)}
          settings={customerCornerSettings}
          onEmailChange={setAccountEmail}
          onCodeChange={setAccountCode}
          onStartLogin={beginAccountLogin}
          onVerifyLogin={completeAccountLogin}
          onLoadQuotes={loadAccountQuotes}
          onRefreshAccount={refreshAccount}
          onLogout={signOutAccount}
          onOpenQuote={() => setQuoteOpen(true)}
          detail={accountDetail}
          isDetailLoading={accountDetailLoading}
          onViewQuote={viewAccountQuote}
          onViewOrder={viewAccountOrder}
          onCloseDetail={() => setAccountDetail(null)}
        />
      ) : route.view === "product" ? (
        <ProductDetailPage
          product={activeProduct}
          isLoading={productLoading}
          relatedProducts={relatedProducts}
          onBackToCatalog={backToCatalog}
          onAddToQuote={addToQuote}
          onSelectRelated={openProductPage}
        />
      ) : (
        <CatalogSection
          catalogState={catalogState}
          products={products}
          itemGroups={itemGroups}
          visibleCategories={visibleCategories}
          topFacetGroups={topFacetGroups}
          activeCategory={activeCategory}
          activeWebsiteCategory={activeWebsiteCategory}
          searchTerm={searchTerm}
          sort={catalogSort}
          minPrice={minPrice}
          maxPrice={maxPrice}
          page={page}
          pageSize={PAGE_SIZE}
          productCount={catalogTotal || products.length}
          totalPages={totalPages}
          filtersOpen={filtersOpen}
          diagnostics={diagnostics}
          catalogFacets={catalogFacets}
          searchSuggestions={catalogSuggestions}
          suggestionsLoading={catalogSuggestionsLoading}
          onToggleFilters={() => setFiltersOpen((value) => !value)}
          onDepartmentChange={setDepartment}
          onCategoryChange={setCategory}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onPriceFilterChange={setPriceFilter}
          onSelectSuggestion={selectCatalogSuggestion}
          onPageChange={setPage}
          onSelectProduct={openProductPreview}
          onAddToQuote={addToQuote}
        />
      )}
      {route.view !== "product" ? (
        <RecommendedProductsSection products={recommendedProducts} onSelectProduct={openProductPreview} />
      ) : null}
      {route.view !== "product" ? <CatalogDownloadsSection catalogs={catalogDownloads} /> : null}
      {route.view !== "product" ? <LegacyContentSection manufacturers={manufacturerLogos} /> : null}
      <ServiceContactSection onOpenQuote={() => setQuoteOpen(true)} />
      <SiteFooter departments={websiteNavigationCategories} />
      <ProductModal product={previewProduct} onClose={() => setPreviewProduct(null)} onAddToQuote={addToQuote} />
      <QuoteDrawer
        isOpen={quoteOpen}
        quoteLines={quoteLines}
        quoteCount={quoteCount}
        quoteTotal={quoteTotal}
        quoteCompany={quoteCompany}
        buyerContact={buyerContact}
        quoteEmail={quoteEmail}
        buyerPhone={buyerPhone}
        quoteNotes={quoteNotes}
        quoteStatus={quoteStatus}
        isSubmitting={quoteSubmitting}
        onClose={() => setQuoteOpen(false)}
        onCompanyChange={setQuoteCompany}
        onContactChange={setBuyerContact}
        onEmailChange={setQuoteEmail}
        onPhoneChange={setBuyerPhone}
        onNotesChange={setQuoteNotes}
        onSetLineQty={setLineQty}
        onRemoveLine={removeLine}
        onClear={() => {
          setQuoteResult(null);
          setQuoteLines([]);
        }}
        onNewQuote={() => {
          setQuoteResult(null);
          setQuoteStatus("");
          setQuoteLines([]);
        }}
        onSubmit={submitQuote}
        quoteResult={quoteResult}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
