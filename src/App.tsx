import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Factory,
  Minus,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { catalogStats, featuredProducts as fallbackProducts, manufacturers } from "./data/catalog";
import { erpFeatures } from "./data/erpFeatures";
import {
  createQuoteRequest,
  fetchCatalogDiagnostics,
  fetchCatalogFacets,
  fetchCatalogProducts,
  fetchItemGroups,
  fetchRecentQuotes
} from "./lib/api";
import { availabilityLabel, plainTextDescription, priceLabel, productImage } from "./lib/catalog";
import type { CatalogDiagnostics, CatalogFacets, CatalogProduct, ItemGroup, QuoteLine, RecentQuote } from "./types";
import "./main.css";

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

  useEffect(() => {
    let ignore = false;

    fetchCatalogProducts({
      page,
      pageSize: 8,
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

  function submitQuickQuote() {
    const product = products[0];
    if (!product?.sku) {
      setQuoteStatus("Catalog is still loading.");
      return;
    }

    setQuoteStatus("Sending quote request...");
    createQuoteRequest({
      customer: {
        company: quoteCompany || "Website Customer",
        email: quoteEmail || "website.customer@example.com"
      },
      lines: [{ sku: product.sku, qty: 1 }],
      notes: "Quick quote from storefront hero form"
    })
      .then((data) => {
        if (data.quotation?.name) {
          const missingText = data.missing?.length ? ` ${data.missing.length} SKU missing.` : "";
          setQuoteStatus(`Quotation ${data.quotation.name} created.${missingText}`);
        } else if (typeof data.quotation === "string") {
          setQuoteStatus(`Quotation ${data.quotation} already exists.`);
        } else if (data.mode === "validated_dry_run") {
          setQuoteStatus("Validated. ERPNext REST credentials are not configured.");
        } else {
          setQuoteStatus(data.error || "Quote request processed.");
        }
      })
      .catch(() => setQuoteStatus("Quote request failed."));
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

  function submitQuote() {
    if (!quoteLines.length) {
      setQuoteStatus("Add at least one product.");
      return;
    }

    setQuoteStatus("Creating ERPNext quotation...");
    createQuoteRequest({
      customer: {
        company: quoteCompany || "Website Customer",
        contact: buyerContact,
        email: quoteEmail || "website.customer@example.com",
        phone: buyerPhone
      },
      lines: quoteLines.map((line) => ({ sku: line.sku, qty: line.qty })),
      notes: quoteNotes || "Quote basket from storefront"
    })
      .then((data) => {
        if (data.quotation?.name) {
          setQuoteStatus(`Quotation ${data.quotation.name} created.`);
          setQuoteLines([]);
          refreshRecentQuotes();
        } else if (typeof data.quotation === "string") {
          setQuoteStatus(`Quotation ${data.quotation} already exists.`);
        } else if (data.mode === "validation_failed") {
          setQuoteStatus("No valid ERPNext items in basket.");
        } else {
          setQuoteStatus(data.error || "Quote request processed.");
        }
      })
      .catch(() => setQuoteStatus("Quote request failed."));
  }

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
  const totalPages = Math.max(1, Math.ceil((catalogTotal || products.length) / 8));

  return (
    <main className="app">
      <div className="topbar">
        <div className="shell topbar__inner">
          <div className="topbar__group">
            <MapPin />
            <span>Nippon Complex Back Rd., Nadi, Fiji Islands</span>
          </div>
          <div className="topbar__group">
            <Phone />
            <span>+679 670 2222</span>
            <Mail />
            <span>buy@greenleafpacific.com</span>
          </div>
        </div>
      </div>

      <nav className="nav">
        <div className="shell nav__inner">
          <a className="brand" href="#">
            <span className="brand__mark">GL</span>
            <span>
              <span className="brand__name">Green Leaf Pacific</span>
              <span className="brand__sub">Hospitality supply marketplace</span>
            </span>
          </a>
          <div className="nav__links">
            <a href="#catalog">Catalog</a>
            <a href="#erp">ERPNext sync</a>
            <a href="#service">Service</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="nav__actions">
            <button className="icon-button" aria-label="Open menu" title="Menu">
              <Menu />
            </button>
            <button className="icon-button" aria-label="Cart" title="Cart" onClick={() => setQuoteOpen(true)}>
              <ShoppingCart />
              {quoteCount ? <span className="cart-badge">{quoteCount}</span> : null}
            </button>
            <button className="primary-button" onClick={() => setQuoteOpen(true)}>
              Request quote <ArrowRight />
            </button>
          </div>
        </div>
      </nav>

      <section className="shell hero">
        <div>
          <span className="eyebrow">
            <Building2 size={16} /> B2B supply for hotels, restaurants and resorts
          </span>
          <h1>Procurement storefront ready for ERPNext.</h1>
          <p className="hero__copy">
            A modern Green Leaf commerce concept with quote-led buying, product
            groups for hospitality operations, and a data structure prepared for
            two-way ERPNext synchronization.
          </p>
          <div className="quick-links">
            <span className="pill">
              <Truck /> {(catalogTotal || catalogStats.erpnext.items).toLocaleString()} ERP catalog items
            </span>
            <span className="pill">
              <Factory /> {catalogStats.erpnext.items.toLocaleString()} ERPNext items
            </span>
            <span className="pill">
              <CheckCircle2 /> {manufacturers.length}+ mapped brands
            </span>
          </div>
        </div>

        <aside className="quote-panel" aria-label="Fast quote form">
          <h2>Fast trade quote</h2>
          <p>
            Select a department and send a draft request. Later this can create
            a Sales Quotation in ERPNext.
          </p>
          <div className="field-grid">
            <label className="field">
              <Search size={18} />
              <input
                placeholder="Company name"
                value={quoteCompany}
                onChange={(event) => setQuoteCompany(event.target.value)}
              />
            </label>
            <label className="field">
              <Mail size={18} />
              <input
                placeholder="Buyer email"
                value={quoteEmail}
                onChange={(event) => setQuoteEmail(event.target.value)}
              />
            </label>
            <button className="quote-button" onClick={submitQuickQuote}>
              Build quotation <ArrowRight size={18} />
            </button>
            {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
          </div>
        </aside>
      </section>

      <section className="shell section" id="catalog">
        <div className="section-heading">
          <div>
            <h2>Commercial catalog</h2>
            <p>
              {catalogState === "ready"
                ? "Live ERPNext data with Standard Selling prices and showroom stock excluded."
                : "Product cards are ready for live prices, quote-only products, lead times, and ERP item groups."}
            </p>
          </div>
          <button className="secondary-button" onClick={() => setFiltersOpen((value) => !value)}>
            <SlidersHorizontal size={18} /> Advanced filters
          </button>
        </div>

        <div className="category-row" aria-label="Catalog categories">
          <button
            className={`category-button ${!activeCategory ? "is-active" : ""}`}
            onClick={() => {
              setActiveCategory("");
              setPage(1);
            }}
          >
            All products
          </button>
          {visibleCategories.map((category) => (
            <button
              className={`category-button ${activeCategory === category ? "is-active" : ""}`}
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setPage(1);
              }}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="catalog-tools">
          <label className="search">
            <Search size={18} />
            <input
              placeholder="Search product name, SKU, dimensions"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="field">
            <select
              value={activeCategory}
              onChange={(event) => {
                setActiveCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All item groups</option>
              {itemGroups.slice(0, 80).map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtersOpen ? (
          <div className="filter-panel">
            <div className="filter-panel__section">
              <span className="filter-panel__label">Popular ERP groups</span>
              <div className="facet-chip-row">
                {topFacetGroups.map((group) => (
                  <button
                    className={`facet-chip ${activeCategory === group.name ? "is-active" : ""}`}
                    key={group.name}
                    onClick={() => {
                      setActiveCategory(group.name);
                      setPage(1);
                    }}
                  >
                    <span>{group.name}</span>
                    <strong>{group.itemCount.toLocaleString()}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-panel__section filter-panel__section--rules">
              <div>
                <span className="filter-panel__label">Storefront rules</span>
                <p>
                  Price list: <strong>{diagnostics?.priceList || "Standard Selling"}</strong>. Currency:{" "}
                  <strong>{catalogFacets?.rules.defaultCurrency || "FJD"}</strong>.
                </p>
              </div>
              <div>
                <span className="filter-panel__label">Excluded warehouses</span>
                <p>{catalogFacets?.rules.excludedWarehouses.join(", ") || "Showroom warehouses excluded"}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.name}>
              <div className="product-card__image">
                <img src={productImage(product)} alt="" />
                <span className="tag">{product.category}</span>
              </div>
              <div className="product-card__body">
                <h3>{product.name}</h3>
                <div className="meta-row">
                  <span>{availabilityLabel(product)}</span>
                  <span>{product.sku}</span>
                  <Clock3 size={16} />
                </div>
                <p>{plainTextDescription(product, "ERP-ready product detail with variants, UOM, tax handling, and buying notes.")}</p>
                <div className="meta-row">
                  <span className="price">{priceLabel(product)}</span>
                  <div className="product-card__actions">
                    <button className="secondary-button" onClick={() => setSelectedProduct(product)}>
                      Details
                    </button>
                    <button className="icon-button" aria-label="Add to quote" onClick={() => addToQuote(product)}>
                      <ShoppingCart />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="pagination">
          <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      </section>

      <section className="erp-band" id="erp">
        <div className="shell erp-layout">
          <div>
            <span className="eyebrow">
              <DatabaseZap size={16} /> ERPNext integration layer
            </span>
            <h2>Designed around two-way commerce data.</h2>
            <p>
              The UI separates product merchandising from operational truth:
              ERPNext can own stock, prices, customers, quotations, sales orders,
              invoices, and service tickets while the storefront stays fast and
              polished.
            </p>
          </div>
          <div className="erp-grid">
            {erpFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="erp-card" key={feature.title}>
                  <div className="erp-card__row">
                    <span className="erp-card__icon">
                      <Icon size={19} />
                    </span>
                    <h3>{feature.title}</h3>
                  </div>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="shell section contact" id="service">
        <article className="contact-card">
          <h3>Trade service model</h3>
          <p>
            Keep the visible shop simple while supporting the real B2B needs:
            quote approvals, customer-specific pricing, warranties, spare parts,
            and repeat purchase lists.
          </p>
          <div className="contact-strip">
            <CheckCircle2 size={18} /> Best warranty on the market
          </div>
        </article>
        <article className="contact-card" id="contact">
          <h3>Contact</h3>
          <p>Green Leaf Ltd, Nippon Complex Back Rd., Nadi, Fiji Islands</p>
          <div className="contact-strip">
            <Phone size={18} /> +679 670 2222
            <Mail size={18} /> buy@greenleafpacific.com
          </div>
        </article>
      </section>

      <section className="shell section diagnostics" id="diagnostics">
        <div className="section-heading">
          <div>
            <h2>Catalog diagnostics</h2>
            <p>Live ERPNext data quality counters for the storefront.</p>
          </div>
        </div>
        <div className="diagnostic-grid">
          <article>
            <span>Total sales items</span>
            <strong>{diagnostics ? Number(diagnostics.totals.total_items).toLocaleString() : "..."}</strong>
          </article>
          <article>
            <span>Without image</span>
            <strong>{diagnostics ? Number(diagnostics.totals.without_image).toLocaleString() : "..."}</strong>
          </article>
          <article>
            <span>Weak item group</span>
            <strong>{diagnostics ? Number(diagnostics.totals.weak_group).toLocaleString() : "..."}</strong>
          </article>
          <article>
            <span>No selling price</span>
            <strong>{diagnostics ? Number(diagnostics.totals.without_selling_price).toLocaleString() : "..."}</strong>
          </article>
        </div>
        <div className="recent-quotes">
          <h3>Recent website quotations</h3>
          {recentQuotes.length ? (
            <div className="recent-quotes__list">
              {recentQuotes.map((quote) => (
                <article key={quote.name}>
                  <strong>{quote.name}</strong>
                  <span>{quote.customer}</span>
                  <span>{quote.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FJD</span>
                  <span>{quote.status}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No website quotations yet.</p>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="shell footer__inner">
          <span>Green Leaf Pacific ecommerce concept</span>
          <span>Catalog, quotation and ERPNext synchronization ready</span>
        </div>
      </footer>

      <aside className={`quote-drawer ${quoteOpen ? "is-open" : ""}`} aria-label="Quote basket">
        <div className="quote-drawer__header">
          <div>
            <h2>Quote basket</h2>
            <p>{quoteCount} item{quoteCount === 1 ? "" : "s"} selected</p>
          </div>
          <button className="icon-button" onClick={() => setQuoteOpen(false)} aria-label="Close quote basket">
            <ArrowRight />
          </button>
        </div>

        <div className="quote-drawer__lines">
          {quoteLines.length ? (
            quoteLines.map((line) => (
              <article className="quote-line" key={line.sku}>
                <div>
                  <h3>{line.name}</h3>
                  <p>{line.sku}</p>
                  <strong>{priceLabel(line)}</strong>
                </div>
                <div className="qty-control">
                  <button className="icon-button" onClick={() => setLineQty(line.sku, line.qty - 1)} aria-label="Decrease quantity">
                    <Minus />
                  </button>
                  <span>{line.qty}</span>
                  <button className="icon-button" onClick={() => setLineQty(line.sku, line.qty + 1)} aria-label="Increase quantity">
                    <Plus />
                  </button>
                  <button className="icon-button" onClick={() => removeLine(line.sku)} aria-label="Remove item">
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">No products selected.</p>
          )}
        </div>

        <div className="quote-form">
          <label className="field">
            <input placeholder="Company" value={quoteCompany} onChange={(event) => setQuoteCompany(event.target.value)} />
          </label>
          <label className="field">
            <input placeholder="Contact person" value={buyerContact} onChange={(event) => setBuyerContact(event.target.value)} />
          </label>
          <label className="field">
            <input placeholder="Email" value={quoteEmail} onChange={(event) => setQuoteEmail(event.target.value)} />
          </label>
          <label className="field">
            <input placeholder="Phone" value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} />
          </label>
          <label className="field field--textarea">
            <textarea placeholder="Notes" value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} />
          </label>
          <div className="quote-total">
            <span>Estimated total</span>
            <strong>{quoteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FJD</strong>
          </div>
          <button className="secondary-button" onClick={() => setQuoteLines([])} disabled={!quoteLines.length}>
            Clear basket
          </button>
          <button className="quote-button" onClick={submitQuote}>Create quotation</button>
          {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
        </div>
      </aside>

      {selectedProduct ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedProduct(null)}>
          <article className="product-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button product-modal__close" onClick={() => setSelectedProduct(null)} aria-label="Close product details">
              <X />
            </button>
            <div className="product-modal__media">
              <img src={productImage(selectedProduct)} alt="" />
            </div>
            <div className="product-modal__body">
              <span className="tag">{selectedProduct.category}</span>
              <h2>{selectedProduct.name}</h2>
              <dl>
                <div>
                  <dt>SKU</dt>
                  <dd>{selectedProduct.sku}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{availabilityLabel(selectedProduct)}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{priceLabel(selectedProduct)}</dd>
                </div>
              </dl>
              <p>{plainTextDescription(selectedProduct, "No product description available.", 1000)}</p>
              <button className="quote-button" onClick={() => addToQuote(selectedProduct)}>
                Add to quote
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
