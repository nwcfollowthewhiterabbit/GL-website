import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { AboutPage } from "./components/AboutPage";
import { AccountPage } from "./components/AccountPage";
import { CatalogDownloadsSection } from "./components/CatalogDownloadsSection";
import { CatalogServiceBand } from "./components/CatalogServiceBand";
import { CatalogSection } from "./components/CatalogSection";
import { HeroSection } from "./components/HeroSection";
import { HowWeOperatePage } from "./components/HowWeOperatePage";
import { LegacyContentSection } from "./components/LegacyContentSection";
import { NotFoundPage, PolicyPage } from "./components/PolicyPage";
import { ProductDetailPage } from "./components/ProductDetailPage";
import { ProductModal } from "./components/ProductModal";
import { QuoteDrawer } from "./components/QuoteDrawer";
import { RecommendedProductsSection } from "./components/RecommendedProductsSection";
import { ServiceContactSection } from "./components/ServiceContactSection";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { featuredProducts as fallbackProducts } from "./data/catalog";
import { matchedItemGroups, websiteCategoryCount } from "./data/websiteCategories";
import { useCustomerAccount } from "./hooks/useCustomerAccount";
import { useStorefrontContent } from "./hooks/useStorefrontContent";
import { useTheme } from "./hooks/useTheme";
import {
  createQuoteRequest,
  fetchCatalogDiagnostics,
  fetchCatalogProduct,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchCatalogSuggestions,
  fetchItemGroups,
  fetchRelatedCatalogProducts
} from "./lib/api";
import { catalogPath, departmentCategoryPath, findCategoryBySlug, parseStorefrontRoute, productPath, type StorefrontRoute } from "./lib/routes";
import { numericPrice } from "./lib/catalog";
import type {
  CatalogDiagnostics,
  CatalogFacets,
  CatalogProduct,
  CatalogSuggestion,
  ItemGroup,
  QuoteLine,
  QuoteRequestResponse,
  QuoteResult
} from "./types";
import "./styles/account.css";
import "./styles/payment.css";
import "./main.css";

const PAGE_SIZE = 12;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function quotationName(data: QuoteRequestResponse) {
  if (typeof data.quotation === "string") return data.quotation;
  return data.quotation?.name || "";
}

function quoteResultFromResponse(data: QuoteRequestResponse, email: string, options: Pick<QuoteResult, "reused" | "dryRun"> = {}): QuoteResult {
  const name = quotationName(data) || data.id || "Validated order request";
  const missingSkus = (data.missing || []).map((line) => line.sku).filter(Boolean);
  return {
    name,
    id: data.id,
    missingCount: missingSkus.length,
    missingSkus,
    validLineCount: data.validLines?.length,
    customerEmail: email,
    fulfillmentMode: data.fulfillment?.mode,
    requiresSalesConfirmation: data.fulfillment?.requiresSalesConfirmation,
    depositPercent: data.fulfillment?.depositPercent,
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

type AppProps = {
  initialRoute?: StorefrontRoute;
};

export function App({ initialRoute }: AppProps = {}) {
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
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogSort, setCatalogSort] = useState("featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeWebsiteCategory, setActiveWebsiteCategory] = useState("");
  const [page, setPage] = useState(1);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [route, setRoute] = useState<StorefrontRoute>(() => initialRoute || parseStorefrontRoute());
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [previewProduct, setPreviewProduct] = useState<CatalogProduct | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [catalogSuggestionsLoading, setCatalogSuggestionsLoading] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const storefront = useStorefrontContent();
  const account = useCustomerAccount(route.view === "account");
  const { theme, toggleTheme } = useTheme();
  const websiteNavigationCategories = storefront.departments;

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const handlePopState = () => setRoute(parseStorefrontRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    scrollToPageTopInstantly();
  }, [route]);

  useEffect(() => {
    const pageTitle =
      route.view === "policy"
        ? `${route.policy.replace(/-/g, " ")} | Green Leaf Pacific`
        : route.view === "how-we-operate"
          ? "How Green Leaf Runs Connected Sales, Inventory and Service Operations"
          : route.view === "about"
            ? "About Green Leaf Pacific"
        : route.view === "account"
          ? "Customer account | Green Leaf Pacific"
          : route.view === "product" && activeProduct
            ? `${activeProduct.name} | Green Leaf Pacific`
            : route.view === "not-found"
              ? "Page not found | Green Leaf Pacific"
              : "Green Leaf Pacific";
    document.title = pageTitle;
  }, [activeProduct, route]);

  useEffect(() => {
    if (route.view !== "catalog" || route.search === undefined) return;
    setSearchTerm(route.search);
    setPage(1);
  }, [route]);

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
  }, [activeCategory, activeWebsiteCategory, catalogSort, itemGroups, maxPrice, minPrice, page, searchTerm, websiteNavigationCategories]);

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
  }, [itemGroups, route, websiteNavigationCategories]);

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
    window.localStorage.setItem("greenleaf.quoteLines", JSON.stringify(quoteLines));
  }, [quoteLines]);

  const products = useMemo<CatalogProduct[]>(() => {
    if (catalogState === "fallback") return fallbackProducts;
    return erpProducts;
  }, [catalogState, erpProducts]);

  const quoteCount = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const quoteTotal = quoteLines.reduce((sum, line) => {
    return sum + numericPrice(line) * line.qty;
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
    if (requireLines && !buyerPhone.trim()) return "Buyer phone is required.";
    if (requireLines && !deliveryLocation.trim()) return "Delivery location is required.";
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
    setQuoteStatus("Preparing order in ERPNext...");
    try {
      const data = await createQuoteRequest({
        customer: {
          company: quoteCompany,
          contact: buyerContact,
          email: quoteEmail,
          phone: buyerPhone,
          location: deliveryLocation
        },
        lines: quoteLines.map((line) => ({ sku: line.sku, qty: line.qty })),
        notes: quoteNotes || "Order basket from storefront"
      });

      const name = quotationName(data);
      if (name && typeof data.quotation !== "string") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail));
        setQuoteStatus(data.fulfillment?.requiresSalesConfirmation ? "Request sent. Green Leaf sales will confirm stock or ETA before payment." : "Order prepared. Secure Windcave checkout is the approved payment path and will open after UAT activation.");
        setQuoteLines([]);
      } else if (name) {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { reused: true }));
        setQuoteStatus("This order request was already received. We opened the existing ERP record.");
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

  return (
    <main className="app">
      <SiteHeader
        departments={websiteNavigationCategories}
        quoteCount={quoteCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenQuote={() => setQuoteOpen(true)}
      />
      {route.view === "catalog" ? (
        <HeroSection banners={storefront.banners} />
      ) : null}
      {route.view === "policy" ? (
        <PolicyPage policy={route.policy} />
      ) : route.view === "how-we-operate" ? (
        <HowWeOperatePage />
      ) : route.view === "about" ? (
        <AboutPage />
      ) : route.view === "not-found" ? (
        <NotFoundPage />
      ) : route.view === "account" ? (
        <AccountPage
          email={account.email}
          password={account.password}
          quotes={account.quotes}
          account={account.session}
          status={account.status}
          isLoading={account.isLoading}
          isAuthenticated={Boolean(account.session)}
          settings={storefront.customerCorner}
          onEmailChange={account.setEmail}
          onPasswordChange={account.setPassword}
          onLogin={account.login}
          onRefreshAccount={account.refresh}
          onLogout={account.logout}
          onOpenQuote={() => setQuoteOpen(true)}
          detail={account.detail}
          isDetailLoading={account.isDetailLoading}
          onViewQuote={account.viewQuote}
          onViewOrder={account.viewOrder}
          onViewInvoice={account.viewInvoice}
          onCloseDetail={account.closeDetail}
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
        <>
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
          <CatalogServiceBand onOpenQuote={() => setQuoteOpen(true)} />
        </>
      )}
      {route.view === "catalog" ? (
        <RecommendedProductsSection products={storefront.recommendedProducts} onSelectProduct={openProductPreview} />
      ) : null}
      {route.view === "catalog" ? <CatalogDownloadsSection catalogs={storefront.catalogs} /> : null}
      {route.view === "catalog" ? <LegacyContentSection manufacturers={storefront.manufacturers} /> : null}
      {route.view === "how-we-operate" || route.view === "about" || route.view === "account" ? null : (
        <ServiceContactSection onOpenQuote={() => setQuoteOpen(true)} />
      )}
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
        deliveryLocation={deliveryLocation}
        quoteNotes={quoteNotes}
        quoteStatus={quoteStatus}
        isSubmitting={quoteSubmitting}
        onClose={() => setQuoteOpen(false)}
        onCompanyChange={setQuoteCompany}
        onContactChange={setBuyerContact}
        onEmailChange={setQuoteEmail}
        onPhoneChange={setBuyerPhone}
        onDeliveryLocationChange={setDeliveryLocation}
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
