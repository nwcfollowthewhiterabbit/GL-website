import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { AboutPage } from "./components/AboutPage";
import { AccountPage } from "./components/AccountPage";
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
import { matchedItemGroups, websiteCategoryCount } from "./data/websiteCategories";
import { useCustomerAccount } from "./hooks/useCustomerAccount";
import { useStorefrontContent } from "./hooks/useStorefrontContent";
import { useRouteScroll } from "./hooks/useRouteScroll";
import { useTheme } from "./hooks/useTheme";
import {
  ResourceNotFound,
  createQuoteRequest,
  purgeLegacyQuoteDetails,
  fetchCatalogProduct,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchCatalogSuggestions,
  fetchItemGroups,
  fetchRelatedCatalogProducts
} from "./lib/api";
import { catalogPath, departmentCategoryPath, findCategoryBySlug, parseStorefrontRoute, productPath, type StorefrontRoute } from "./lib/routes";
import { basketLine, offerKey, nextOrderQuantity, orderStep } from "./lib/catalog";
import type {
  CatalogFacets,
  CatalogProduct,
  CatalogReference,
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
    ...options
  };
}

type AppProps = {
  initialRoute?: StorefrontRoute;
};

export function App({ initialRoute }: AppProps = {}) {
  const [erpProducts, setErpProducts] = useState<CatalogProduct[]>([]);
  const [catalogReference, setCatalogReference] = useState<CatalogReference | null>(null);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [quoteCompany, setQuoteCompany] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("");
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [basketRestored, setBasketRestored] = useState(false);
  // The first client render must match the server-rendered editorial pages.
  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("greenleaf.quoteLines") || "[]");
      if (Array.isArray(saved)) {
        const lines = saved
          .filter((line) => typeof line?.sku === "string" && Number.isFinite(line.qty) && line.qty > 0)
          .slice(0, 100)
          .map((line) => basketLine(line, line.qty, line.unitConfirmed === true));
        setQuoteLines(lines);
      }
    } catch { /* The basket still works when browser storage is unavailable. */ }
    setBasketRestored(true);
  }, []);
  // Saved baskets from the SKU-only release used stock UOM for every pack.
  // Retain quantities, and upgrade only when ERP returns exactly one selling unit.
  useEffect(() => {
    if (!basketRestored) return;
    let active = true;
    async function refreshLegacyBasket() {
      for (const saved of quoteLines.filter((line) => !line.unitConfirmed)) {
        if (!active) return;
        const product = await fetchCatalogProduct(saved.sku).catch(() => null);
        if (!active || !product || product.sellingUnitCount !== 1) continue;
        setQuoteLines((lines) => lines.map((line) => line.sku === saved.sku && !line.unitConfirmed
          ? basketLine(product, line.qty, true) : line));
      }
    }
    void refreshLegacyBasket();
    return () => { active = false; };
  }, [basketRestored]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [route, setRoute] = useState<StorefrontRoute>(() => initialRoute || parseStorefrontRoute());
  const catalogVisible = route.view === "catalog";
  const [searchTerm, setSearchTerm] = useState(route.view === "catalog" ? route.search || "" : "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [catalogSort, setCatalogSort] = useState("featured");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeWebsiteCategory, setActiveWebsiteCategory] = useState("");
  const [page, setPage] = useState(1);
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [previewProduct, setPreviewProduct] = useState<CatalogProduct | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productUnavailable, setProductUnavailable] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [catalogSuggestionsLoading, setCatalogSuggestionsLoading] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const storefront = useStorefrontContent(catalogVisible);
  const account = useCustomerAccount(route.view === "account");
  const { theme, toggleTheme } = useTheme();
  const websiteNavigationCategories = storefront.departments;

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const handlePopState = () => setRoute(parseStorefrontRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useRouteScroll(route);

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
    const origin = document.querySelector<HTMLMetaElement>('meta[name="storefront-origin"]')?.content;
    if (origin) {
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (route.view === "not-found" || route.view === "account") {
        canonical?.remove();
      } else {
        if (!canonical) {
          canonical = document.createElement("link");
          canonical.rel = "canonical";
          document.head.append(canonical);
        }
        const path = route.view === "about" ? "/about-us" : route.view === "policy" ? "/" + route.policy : location.pathname.replace(/\/+$/, "") || "/catalog";
        canonical.href = new URL(path, origin).href;
      }
    }
  }, [activeProduct, route]);

  useEffect(() => {
    if (route.view !== "catalog" || route.search === undefined) return;
    setSearchTerm(route.search);
    setPage(1);
  }, [route]);

  const department = websiteNavigationCategories.find((entry) => entry.id === activeWebsiteCategory);
  const departmentGroups = !activeCategory && department ? matchedItemGroups(department, itemGroups).join(",") : "";
  useEffect(() => {
    if (!catalogVisible) return;
    let ignore = false;
    setCatalogState("loading");
    setErpProducts([]);
    setCatalogTotal(null);
    setCatalogReference(null);

    fetchCatalogProducts({
      page,
      pageSize: PAGE_SIZE,
      q: searchTerm,
      category: activeCategory,
      sort: catalogSort,
      categories: departmentGroups
    })
      .then((data) => {
        if (ignore) return;
        setErpProducts(data.products || []);
        setCatalogTotal(data.total);
        setCatalogReference(data.reference || null);
        setCatalogState("ready");
      })
      .catch(() => {
        if (ignore) return;
        setErpProducts([]);
        setCatalogState("unavailable");
      });

    return () => {
      ignore = true;
    };
  }, [activeCategory, catalogVisible, catalogSort, departmentGroups, page, searchTerm]);

  useEffect(() => {
    if (!catalogVisible) return;
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
  }, [catalogVisible]);

  useEffect(() => {
    const q = searchTerm.trim();
    if (!catalogVisible || !searchFocused || !q) {
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
  }, [catalogVisible, searchFocused, searchTerm, websiteNavigationCategories]);

  useEffect(() => {
    if (route.view !== "catalog") return;
    if (!route.categorySlug) {
      setActiveWebsiteCategory("");
      setActiveCategory("");
      return;
    }
    if (!itemGroups.length) return;
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

    let ignore = false;
    setProductLoading(true);
    setProductUnavailable(false);
    setRelatedProducts([]);
    fetchCatalogProduct(route.sku, route.uom)
      .then((product) => {
        if (ignore) return;
        setActiveProduct(product);
        setProductLoading(false);
        fetchRelatedCatalogProducts(product.sku, 4)
          .then((related) => { if (!ignore) setRelatedProducts(related); })
          .catch(() => { /* Related products are optional. */ });
      })
      .catch((error) => {
        if (ignore) return;
        setActiveProduct(null);
        setProductUnavailable(!(error instanceof ResourceNotFound));
        setProductLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [route]);

  useEffect(() => {
    if (!basketRestored) return;
    try { window.localStorage.setItem("greenleaf.quoteLines", JSON.stringify(quoteLines)); } catch { /* The basket still works when browser storage is unavailable. */ }
  }, [basketRestored, quoteLines]);

  useEffect(() => {
    void purgeLegacyQuoteDetails();
  }, []);

  useEffect(() => {
    setQuoteEmail(account.session?.email || "");
    setQuoteCompany(account.session?.profile?.customerName || "");
    setBuyerPhone(account.session?.profile?.phone || "");
    setBuyerContact(account.session ? account.contact || "" : "");
    setDeliveryLocation("");
    setQuoteNotes("");
    setQuoteResult(null);
    setQuoteStatus("");
    if (account.session && new URLSearchParams(window.location.search).get("basket") === "1") setQuoteOpen(true);
  }, [account.session?.email]);

  const products = erpProducts;
  const quoteCount = quoteLines.reduce((sum, line) => sum + line.qty, 0);

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

  function navigate(path: string, nextRoute = parseStorefrontRoute(path, "")) {
    window.history.pushState({}, "", path);
    if (nextRoute.view === "product") {
      flushSync(() => {
        setRoute(nextRoute);
      });
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
      navigate(departmentCategoryPath(activeDepartment.id, category) + "#catalog");
    } else {
      navigate(catalogPath(category) + "#catalog");
    }
  }

  function setDepartment(categoryId: string) {
    setActiveWebsiteCategory(categoryId);
    setActiveCategory("");
    setPage(1);
    navigate((categoryId ? `/catalog/${categoryId}` : "/catalog") + "#catalog", { view: "catalog", categorySlug: categoryId || undefined });
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

  function openProductPreview(product: CatalogProduct) {
    setPreviewProduct(product);
  }

  function openProductPage(product: CatalogProduct) {
    setActiveProduct(product);
    navigate(productPath(product.sku, product.uom), { view: "product", sku: product.sku, uom: product.uom });
  }

  function selectCatalogSuggestion(suggestion: CatalogSuggestion) {
    if (suggestion.type === "product" && suggestion.sku) {
      navigate(productPath(suggestion.sku, suggestion.uom), { view: "product", sku: suggestion.sku, uom: suggestion.uom });
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
    if (quoteResult) {
      try { window.localStorage.removeItem("greenleaf.lastQuoteRequest"); } catch { /* No persistent request cache. */ }
    }
    setQuoteResult(null);
    setQuoteLines((current) => {
      const unresolved = current.find((line) => !line.unitConfirmed && line.sku === product.sku);
      if (unresolved) {
        return current.map((line) => line === unresolved ? basketLine(product, line.qty, true) : line);
      }
      const key = offerKey(product);
      const existing = current.find((line) => offerKey(line) === key);
      if (existing) {
        return current.map((line) => (offerKey(line) === key ? basketLine(product, nextOrderQuantity(product, line.qty, 1), true) : line));
      }
      return [...current, basketLine(product, orderStep(product), true)];
    });
    setQuoteOpen(true);
  }

  function setLineQty(offer: string, qty: number) {
    setQuoteResult(null);
    setQuoteLines((current) =>
      current
        .map((line) => (offerKey(line) === offer ? { ...line, qty: Math.max(1, qty) } : line))
        .filter((line) => line.qty > 0)
    );
  }

  function removeLine(offer: string) {
    setQuoteResult(null);
    setQuoteLines((current) => current.filter((line) => offerKey(line) !== offer));
  }

  function validateQuoteForm(requireLines: boolean) {
    if (requireLines && quoteLines.some((line) => !line.unitConfirmed)) return "Select the current selling unit for each saved product.";
    if (requireLines && quoteLines.some((line) => line.packingUnit && line.qty % line.packingUnit !== 0)) {
      return "Adjust each quantity to the selling multiple shown in your basket.";
    }
    if (requireLines && !quoteLines.length) return "Add at least one product.";
    if (!quoteCompany.trim()) return "Company name is required.";
    if (!quoteEmail.trim()) return "Buyer email is required.";
    if (!isValidEmail(quoteEmail)) return "Enter a valid buyer email.";
    if (requireLines && !buyerContact.trim()) return "Contact name is required.";
    if (requireLines && !buyerPhone.trim()) return "Buyer phone is required.";
    if (requireLines && !deliveryLocation.trim()) return "Delivery location is required.";
    return "";
  }

  async function submitQuote() {
    if (quoteSubmitting) return;
    if (!account.session) { setQuoteStatus("Sign in or create an account to request a quote. Your basket is saved."); return; }
    const validationError = validateQuoteForm(true);
    if (validationError) {
      setQuoteResult(null);
      setQuoteStatus(validationError);
      return;
    }

    setQuoteSubmitting(true);
    setQuoteResult(null);
    setQuoteStatus("Sending your quote request...");
    try {
      const data = await createQuoteRequest({
        customer: {
          company: quoteCompany,
          contact: buyerContact,
          email: account.session.email,
          phone: buyerPhone,
          location: deliveryLocation
        },
        lines: quoteLines.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          uom: line.uom
        })),
        notes: quoteNotes || "Order basket from storefront"
      });

      const name = quotationName(data);
      if (name && typeof data.quotation !== "string") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail));
        setQuoteStatus("Request received. Green Leaf sales will confirm pricing, availability and delivery. Follow its progress in your account.");
        void account.refresh();
        setQuoteLines([]);
      } else if (name) {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { reused: true }));
        setQuoteStatus("This quote request was already received. Its reference is shown above.");
        setQuoteLines([]);
      } else if (data.error === "not_authenticated") {
        setQuoteStatus("Your session has expired. Sign in again; your basket is saved.");
        void account.refresh();
      } else if (data.error === "invalid_pack_quantity") {
        const line = data.missing?.find((item) => item.reason === "invalid_pack_quantity");
        setQuoteStatus(`${line?.sku || "This item"} must be ordered in multiples of ${line?.packingUnit || "the displayed pack"}. Review its quantity in the basket.`);
      } else if (data.mode === "validation_failed") {
        setQuoteStatus("A selected product, pack or quantity has changed. Remove the affected line and choose a current selling unit from the catalog.");
      } else if (data.mode === "validated_dry_run") {
        setQuoteResult(quoteResultFromResponse(data, quoteEmail, { dryRun: true }));
        setQuoteStatus("Validated locally. ERPNext REST credentials are not configured.");
      } else {
        const errors: Record<string, string> = {
          account_login_required: "Your session has expired. Sign in again; your basket is saved.",
          authentication_required: "Your session has expired. Sign in again; your basket is saved.",
          account_email_mismatch: "Your account has changed. Reload this page before submitting your basket.",
          invalid_quote_lines: "Review the products and quantities in your basket.",
          invalid_customer_details: "Check your contact and delivery details."
        };
        setQuoteStatus(errors[data.error || ""] || "The request was not submitted. Check your basket and try again.");
      }
    } catch {
      setQuoteStatus("The request could not be confirmed. Your basket is saved; try again to check the same request.");
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
          auth={account}
          email={account.email}
          password={account.password}
          quotes={account.quotes}
          account={account.session}
          status={account.status}
          isLoading={account.isLoading}
          isAuthenticated={Boolean(account.session)}
          settings={storefront.customerCorner}
          settingsLoading={storefront.sources.customerCorner === "loading"}
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
          unavailable={productUnavailable}
          relatedProducts={relatedProducts}
          onBackToCatalog={backToCatalog}
          onAddToQuote={addToQuote}
          onSelectRelated={openProductPage}
        />
      ) : (
        <>
          <CatalogSection
            reference={catalogReference}
            catalogState={catalogState}
            products={products}
            itemGroups={itemGroups}
            visibleCategories={visibleCategories}
            topFacetGroups={topFacetGroups}
            activeCategory={activeCategory}
            activeWebsiteCategory={activeWebsiteCategory}
            searchTerm={searchTerm}
            sort={catalogSort}
            page={page}
            pageSize={PAGE_SIZE}
            productCount={catalogTotal || products.length}
            totalPages={totalPages}
            filtersOpen={filtersOpen}
            catalogFacets={catalogFacets}
            searchSuggestions={catalogSuggestions}
            suggestionsLoading={catalogSuggestionsLoading}
            onToggleFilters={() => setFiltersOpen((value) => !value)}
            onDepartmentChange={setDepartment}
            onCategoryChange={setCategory}
            onSearchChange={setSearch}
            onSearchFocus={() => setSearchFocused(true)}
            onSortChange={setSort}
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
      {route.view === "catalog" ? <LegacyContentSection manufacturers={storefront.manufacturers} /> : null}
      {route.view === "how-we-operate" || route.view === "about" || route.view === "account" ? null : (
        <ServiceContactSection onOpenQuote={() => setQuoteOpen(true)} />
      )}
      <SiteFooter departments={websiteNavigationCategories} />
      <ProductModal product={previewProduct} onClose={() => setPreviewProduct(null)} onAddToQuote={addToQuote} />
      <QuoteDrawer
        isOpen={quoteOpen}
        isAuthenticated={Boolean(account.session)}
        isAccountLoading={!account.sessionReady}
        quoteLines={quoteLines}
        quoteCount={quoteCount}
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
          try { window.localStorage.removeItem("greenleaf.lastQuoteRequest"); } catch { /* No persistent request cache. */ }
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
