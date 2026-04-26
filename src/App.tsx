import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AccountPage } from "./components/AccountPage";
import { CatalogSection } from "./components/CatalogSection";
import { DiagnosticsSection } from "./components/DiagnosticsSection";
import { HeroSection } from "./components/HeroSection";
import { IntegrationSection } from "./components/IntegrationSection";
import { LegacyContentSection } from "./components/LegacyContentSection";
import { ProductDetailPage } from "./components/ProductDetailPage";
import { QuoteDrawer } from "./components/QuoteDrawer";
import { ServiceContactSection } from "./components/ServiceContactSection";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { featuredProducts as fallbackProducts } from "./data/catalog";
import { findWebsiteCategory, matchedItemGroups, websiteCategories, websiteCategoryCount } from "./data/websiteCategories";
import {
  createQuoteRequest,
  fetchAccountQuotes,
  fetchCatalogDiagnostics,
  fetchCatalogProduct,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchItemGroups,
  fetchRecentQuotes,
  fetchRelatedCatalogProducts
} from "./lib/api";
import { catalogPath, findCategoryBySlug, parseStorefrontRoute, productPath, type StorefrontRoute } from "./lib/routes";
import type {
  CatalogDiagnostics,
  CatalogFacets,
  CatalogProduct,
  ItemGroup,
  QuoteLine,
  QuoteRequestResponse,
  QuoteResult,
  RecentQuote
} from "./types";
import "./main.css";

const PAGE_SIZE = 8;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function quotationName(data: QuoteRequestResponse) {
  if (typeof data.quotation === "string") return data.quotation;
  return data.quotation?.name || "";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeWebsiteCategory, setActiveWebsiteCategory] = useState("");
  const [page, setPage] = useState(1);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [route, setRoute] = useState<StorefrontRoute>(() => parseStorefrontRoute());
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountQuotes, setAccountQuotes] = useState<RecentQuote[]>([]);
  const [accountStatus, setAccountStatus] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    const handlePopState = () => setRoute(parseStorefrontRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchCatalogProducts({
      page,
      pageSize: PAGE_SIZE,
      q: searchTerm,
      category: activeCategory,
      categories:
        !activeCategory && activeWebsiteCategory
          ? matchedItemGroups(findWebsiteCategory(activeWebsiteCategory)!, itemGroups)
          : undefined
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
  }, [activeCategory, activeWebsiteCategory, itemGroups, page, searchTerm]);

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
    if (route.view !== "catalog" || !route.categorySlug || !itemGroups.length) return;
    const department = websiteCategories.find((category) => category.id === route.categorySlug);
    if (department) {
      setActiveWebsiteCategory(department.id);
      setActiveCategory("");
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
  }, [itemGroups, route]);

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

  function refreshRecentQuotes() {
    fetchRecentQuotes(5)
      .then(setRecentQuotes)
      .catch(() => setRecentQuotes([]));
  }

  useEffect(() => {
    refreshRecentQuotes();
  }, []);

  const products = useMemo<CatalogProduct[]>(() => {
    if (erpProducts.length) return erpProducts;
    return fallbackProducts;
  }, [erpProducts]);

  const quoteCount = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const quoteTotal = quoteLines.reduce((sum, line) => {
    const price = typeof line.price === "number" ? line.price : 0;
    return sum + price * line.qty;
  }, 0);

  const visibleCategories = useMemo(() => {
    return websiteCategories.map((category) => ({
      ...category,
      itemCount: websiteCategoryCount(category, itemGroups),
      availableItemGroups: matchedItemGroups(category, itemGroups)
    }));
  }, [itemGroups]);

  const topFacetGroups = useMemo(() => {
    const activeDepartment = findWebsiteCategory(activeWebsiteCategory);
    if (activeDepartment) {
      const allowed = new Set(matchedItemGroups(activeDepartment, itemGroups));
      return itemGroups
        .filter((group) => allowed.has(group.name) && group.itemCount > 0)
        .sort((a, b) => b.itemCount - a.itemCount);
    }
    return itemGroups.filter((group) => !group.isGroup && group.itemCount > 0).sort((a, b) => b.itemCount - a.itemCount);
  }, [activeWebsiteCategory, itemGroups]);

  const totalPages = Math.max(1, Math.ceil((catalogTotal || products.length) / PAGE_SIZE));

  function navigate(path: string, nextRoute = parseStorefrontRoute(path)) {
    window.history.pushState({}, "", path);
    setRoute(nextRoute);
  }

  function setCategory(category: string) {
    setActiveWebsiteCategory("");
    setActiveCategory(category);
    setPage(1);
    navigate(catalogPath(category), { view: "catalog", categorySlug: category ? undefined : undefined });
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

  function openProduct(product: CatalogProduct) {
    setActiveProduct(product);
    navigate(productPath(product.sku), { view: "product", sku: product.sku });
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
        const missingText = data.missing?.length ? ` ${data.missing.length} SKU missing.` : "";
        setQuoteResult({ name, missingCount: data.missing?.length || 0 });
        setQuoteStatus(`Quotation ${name} created.${missingText}`);
        refreshRecentQuotes();
      } else if (name) {
        setQuoteResult({ name, missingCount: data.missing?.length || 0, reused: true });
        setQuoteStatus(`Quotation ${name} already exists.`);
      } else if (data.mode === "validated_dry_run") {
        setQuoteStatus("Validated. ERPNext REST credentials are not configured.");
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
        const missingText = data.missing?.length ? ` ${data.missing.length} SKU missing.` : "";
        setQuoteResult({ name, missingCount: data.missing?.length || 0 });
        setQuoteStatus(`Quotation ${name} created.${missingText}`);
        setQuoteLines([]);
        refreshRecentQuotes();
      } else if (name) {
        setQuoteResult({ name, missingCount: data.missing?.length || 0, reused: true });
        setQuoteStatus(`Quotation ${name} already exists.`);
      } else if (data.mode === "validation_failed") {
        setQuoteStatus("No valid ERPNext items in basket.");
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

  return (
    <main className="app">
      <SiteHeader quoteCount={quoteCount} onOpenQuote={() => setQuoteOpen(true)} />
      {route.view !== "product" ? (
        <HeroSection
          catalogTotal={catalogTotal}
          quoteCompany={quoteCompany}
          quoteEmail={quoteEmail}
          quoteStatus={quoteStatus}
          isSubmitting={quoteSubmitting}
          onCompanyChange={setQuoteCompany}
          onEmailChange={setQuoteEmail}
          onSubmitQuickQuote={submitQuickQuote}
        />
      ) : null}
      {route.view === "account" ? (
        <AccountPage
          email={accountEmail}
          quotes={accountQuotes}
          status={accountStatus}
          isLoading={accountLoading}
          onEmailChange={setAccountEmail}
          onLoadQuotes={loadAccountQuotes}
        />
      ) : route.view === "product" ? (
        <ProductDetailPage
          product={activeProduct}
          isLoading={productLoading}
          relatedProducts={relatedProducts}
          onBackToCatalog={backToCatalog}
          onAddToQuote={addToQuote}
          onSelectRelated={openProduct}
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
          page={page}
          totalPages={totalPages}
          filtersOpen={filtersOpen}
          diagnostics={diagnostics}
          catalogFacets={catalogFacets}
          onToggleFilters={() => setFiltersOpen((value) => !value)}
          onDepartmentChange={setDepartment}
          onCategoryChange={setCategory}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onSelectProduct={openProduct}
          onAddToQuote={addToQuote}
        />
      )}
      <LegacyContentSection />
      <IntegrationSection />
      <ServiceContactSection />
      <DiagnosticsSection diagnostics={diagnostics} recentQuotes={recentQuotes} />
      <SiteFooter />
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
        onSubmit={submitQuote}
        quoteResult={quoteResult}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
