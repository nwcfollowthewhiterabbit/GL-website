import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CatalogSection } from "./components/CatalogSection";
import { DiagnosticsSection } from "./components/DiagnosticsSection";
import { HeroSection } from "./components/HeroSection";
import { IntegrationSection } from "./components/IntegrationSection";
import { ProductModal } from "./components/ProductModal";
import { QuoteDrawer } from "./components/QuoteDrawer";
import { ServiceContactSection } from "./components/ServiceContactSection";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { featuredProducts as fallbackProducts } from "./data/catalog";
import {
  createQuoteRequest,
  fetchCatalogDiagnostics,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchItemGroups,
  fetchRecentQuotes
} from "./lib/api";
import type { CatalogDiagnostics, CatalogFacets, CatalogProduct, ItemGroup, QuoteLine, RecentQuote } from "./types";
import "./main.css";

const PAGE_SIZE = 8;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
  const [page, setPage] = useState(1);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchCatalogProducts({
      page,
      pageSize: PAGE_SIZE,
      q: searchTerm,
      category: activeCategory
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
  }, [activeCategory, page, searchTerm]);

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
    const preferred = itemGroups
      .filter((group) => !["All Item Groups", "Expences", "Products"].includes(group.name))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 8)
      .map((group) => group.name);
    return preferred.length ? preferred : ["Kitchen", "Housekeeping & Cleaning", "Furniture and fitouts", "Buffetware"];
  }, [itemGroups]);

  const topFacetGroups = useMemo(() => {
    return itemGroups
      .filter((group) => !group.isGroup && group.itemCount > 0)
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 12);
  }, [itemGroups]);

  const totalPages = Math.max(1, Math.ceil((catalogTotal || products.length) / PAGE_SIZE));

  function setCategory(category: string) {
    setActiveCategory(category);
    setPage(1);
  }

  function setSearch(value: string) {
    setSearchTerm(value);
    setPage(1);
  }

  function addToQuote(product: CatalogProduct) {
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
    setQuoteLines((current) =>
      current
        .map((line) => (line.sku === sku ? { ...line, qty: Math.max(1, qty) } : line))
        .filter((line) => line.qty > 0)
    );
  }

  function removeLine(sku: string) {
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
      setQuoteStatus(validationError);
      return;
    }

    const product = products[0];
    if (!product?.sku) {
      setQuoteStatus("Catalog is still loading.");
      return;
    }

    setQuoteSubmitting(true);
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

      if (data.quotation?.name) {
        const missingText = data.missing?.length ? ` ${data.missing.length} SKU missing.` : "";
        setQuoteStatus(`Quotation ${data.quotation.name} created.${missingText}`);
        refreshRecentQuotes();
      } else if (typeof data.quotation === "string") {
        setQuoteStatus(`Quotation ${data.quotation} already exists.`);
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
      setQuoteStatus(validationError);
      return;
    }

    setQuoteSubmitting(true);
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

      if (data.quotation?.name) {
        const missingText = data.missing?.length ? ` ${data.missing.length} SKU missing.` : "";
        setQuoteStatus(`Quotation ${data.quotation.name} created.${missingText}`);
        setQuoteLines([]);
        refreshRecentQuotes();
      } else if (typeof data.quotation === "string") {
        setQuoteStatus(`Quotation ${data.quotation} already exists.`);
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

  return (
    <main className="app">
      <SiteHeader quoteCount={quoteCount} onOpenQuote={() => setQuoteOpen(true)} />
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
      <CatalogSection
        catalogState={catalogState}
        products={products}
        itemGroups={itemGroups}
        visibleCategories={visibleCategories}
        topFacetGroups={topFacetGroups}
        activeCategory={activeCategory}
        searchTerm={searchTerm}
        page={page}
        totalPages={totalPages}
        filtersOpen={filtersOpen}
        diagnostics={diagnostics}
        catalogFacets={catalogFacets}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onSelectProduct={setSelectedProduct}
        onAddToQuote={addToQuote}
      />
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
        onClear={() => setQuoteLines([])}
        onSubmit={submitQuote}
      />
      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToQuote={addToQuote} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
