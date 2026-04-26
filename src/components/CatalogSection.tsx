import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronRight, Clock3, Layers3, Search, ShoppingCart, X } from "lucide-react";
import { availabilityLabel, availabilityTone, plainTextDescription, priceLabel, productImage, productPlaceholder } from "../lib/catalog";
import type { CatalogDiagnostics, CatalogFacets, CatalogProduct, CatalogSuggestion, ItemGroup, WebsiteCategory } from "../types";

type WebsiteCategoryView = WebsiteCategory & {
  itemCount: number;
  availableItemGroups: string[];
};

type CatalogSectionProps = {
  catalogState: "loading" | "ready" | "fallback";
  products: CatalogProduct[];
  itemGroups: ItemGroup[];
  visibleCategories: WebsiteCategoryView[];
  topFacetGroups: ItemGroup[];
  activeCategory: string;
  activeWebsiteCategory: string;
  searchTerm: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
  page: number;
  pageSize: number;
  productCount: number;
  totalPages: number;
  filtersOpen: boolean;
  diagnostics: CatalogDiagnostics | null;
  catalogFacets: CatalogFacets | null;
  searchSuggestions: CatalogSuggestion[];
  suggestionsLoading: boolean;
  onToggleFilters: () => void;
  onDepartmentChange: (categoryId: string) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onPriceFilterChange: (kind: "min" | "max", value: string) => void;
  onSelectSuggestion: (suggestion: CatalogSuggestion) => void;
  onPageChange: (page: number) => void;
  onSelectProduct: (product: CatalogProduct) => void;
  onAddToQuote: (product: CatalogProduct) => void;
};

export function CatalogSection({
  catalogState,
  products,
  itemGroups,
  visibleCategories,
  topFacetGroups,
  activeCategory,
  activeWebsiteCategory,
  searchTerm,
  sort,
  minPrice,
  maxPrice,
  page,
  pageSize,
  productCount,
  totalPages,
  filtersOpen,
  diagnostics,
  catalogFacets,
  searchSuggestions,
  suggestionsLoading,
  onToggleFilters,
  onDepartmentChange,
  onCategoryChange,
  onSearchChange,
  onSortChange,
  onPriceFilterChange,
  onSelectSuggestion,
  onPageChange,
  onSelectProduct,
  onAddToQuote
}: CatalogSectionProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [sidebarPin, setSidebarPin] = useState<"normal" | "fixed" | "bottom">("normal");
  const [sidebarMetrics, setSidebarMetrics] = useState({ left: 0, width: 280 });
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeDepartment = visibleCategories.find((category) => category.id === activeWebsiteCategory);
  const activeLabel = activeCategory || activeDepartment?.label || "All products";
  const hasActiveFilters = Boolean(activeCategory || activeWebsiteCategory || searchTerm || sort !== "featured" || minPrice || maxPrice);
  const activeItemGroupNames = new Set(activeDepartment?.availableItemGroups || []);
  const itemGroupByName = new Map(itemGroups.map((group) => [group.name, group]));
  const sidebarGroups = activeDepartment
    ? activeDepartment.availableItemGroups
        .map((name) => itemGroupByName.get(name))
        .filter((group): group is ItemGroup => Boolean(group))
        .sort((a, b) => b.itemCount - a.itemCount)
    : topFacetGroups.slice(0, 18);
  const subcategoryButtons = activeDepartment ? (
    <div className="catalog-nav-subcategories" aria-label={`${activeDepartment.label} subcategories`}>
      {sidebarGroups.map((group) => (
        <button
          className={`catalog-subcategory ${activeCategory === group.name ? "is-active" : ""}`}
          key={group.name}
          onClick={() => onCategoryChange(group.name)}
        >
          <span>{group.name}</span>
          <strong>{group.itemCount.toLocaleString()}</strong>
        </button>
      ))}
    </div>
  ) : null;
  const shouldShowSuggestions = suggestionsOpen && searchTerm.trim().length >= 1;
  const pageWindow = paginationWindow(page, totalPages);

  useEffect(() => {
    if (!searchTerm.trim()) setSuggestionsOpen(false);
  }, [searchTerm]);

  useEffect(() => {
    let frame = 0;

    const updateSidebarPosition = () => {
      frame = 0;
      const layout = layoutRef.current;
      const sidebar = sidebarRef.current;

      if (!layout || !sidebar || window.innerWidth <= 980) {
        setSidebarPin((current) => (current === "normal" ? current : "normal"));
        return;
      }

      const topOffset = 92;
      const layoutRect = layout.getBoundingClientRect();
      const sidebarHeight = sidebar.offsetHeight;
      const nextPin =
        layoutRect.top <= topOffset && layoutRect.bottom - sidebarHeight > topOffset
          ? "fixed"
          : layoutRect.bottom - sidebarHeight <= topOffset
            ? "bottom"
            : "normal";

      setSidebarPin((current) => (current === nextPin ? current : nextPin));
      setSidebarMetrics((current) => {
        const nextMetrics = { left: layoutRect.left, width: sidebar.offsetWidth };
        return Math.abs(current.left - nextMetrics.left) < 0.5 && Math.abs(current.width - nextMetrics.width) < 0.5 ? current : nextMetrics;
      });
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateSidebarPosition);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [activeCategory, activeWebsiteCategory, filtersOpen, productCount, sidebarGroups.length]);

  function selectSuggestion(suggestion: CatalogSuggestion) {
    setSuggestionsOpen(false);
    searchInputRef.current?.blur();
    onSelectSuggestion(suggestion);
  }

  function clearFilters() {
    onSearchChange("");
    onSortChange("featured");
    onPriceFilterChange("min", "");
    onPriceFilterChange("max", "");
    onDepartmentChange("");
  }

  return (
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
      </div>

      <div className="catalog-layout" ref={layoutRef}>
        <aside
          className={`catalog-sidebar ${filtersOpen ? "is-open" : ""} ${sidebarPin !== "normal" ? `is-${sidebarPin}` : ""}`}
          ref={sidebarRef}
          style={
            {
              "--catalog-sidebar-left": `${sidebarMetrics.left}px`,
              "--catalog-sidebar-width": `${sidebarMetrics.width}px`
            } as CSSProperties
          }
          aria-label="Catalog navigation"
        >
          <div className="catalog-sidebar__head">
            <span>Departments</span>
            <strong>{activeLabel}</strong>
          </div>
          <button className={`catalog-nav-button ${!activeCategory && !activeWebsiteCategory ? "is-active" : ""}`} onClick={() => onDepartmentChange("")}>
            <span>All products</span>
            <ChevronRight size={16} />
          </button>
          {visibleCategories.map((category) => (
            <div className="catalog-nav-group" key={category.id}>
              <button
                className={`catalog-nav-button ${activeWebsiteCategory === category.id ? "is-active" : ""}`}
                onClick={() => onDepartmentChange(category.id)}
              >
                <span>{category.label}</span>
                <strong>{category.itemCount.toLocaleString()}</strong>
              </button>
              {activeWebsiteCategory === category.id ? subcategoryButtons : null}
            </div>
          ))}

          {!activeDepartment ? (
            <div className="catalog-sidebar__groups">
              <span>Popular ERP groups</span>
              {sidebarGroups.map((group) => (
                <button
                  className={`catalog-subcategory ${activeCategory === group.name ? "is-active" : ""}`}
                  key={group.name}
                  onClick={() => onCategoryChange(group.name)}
                >
                  <span>{group.name}</span>
                  <strong>{group.itemCount.toLocaleString()}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="catalog-main">
          <div className="catalog-tools">
            <div className="search-shell">
              <label className="search">
                <Search size={18} />
                <input
                  ref={searchInputRef}
                  placeholder="Search product name, SKU, dimensions"
                  value={searchTerm}
                  onFocus={() => {
                    if (searchTerm.trim()) setSuggestionsOpen(true);
                  }}
                  onChange={(event) => {
                    onSearchChange(event.target.value);
                    setSuggestionsOpen(Boolean(event.target.value.trim()));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSuggestionsOpen(false);
                      return;
                    }
                    if (event.key === "Enter" && searchSuggestions[0]) {
                      event.preventDefault();
                      selectSuggestion(searchSuggestions[0]);
                    }
                  }}
                />
              </label>
              {shouldShowSuggestions ? (
                <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
                  {suggestionsLoading ? (
                    <div className="search-suggestions__status">Searching...</div>
                  ) : searchSuggestions.length ? (
                    searchSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        className="search-suggestion"
                        key={suggestion.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <span className="search-suggestion__type">
                          {suggestion.type === "product" ? "Product" : suggestion.type === "department" ? "Department" : "Category"}
                        </span>
                        <strong>{suggestion.label}</strong>
                        {suggestion.detail ? <small>{suggestion.detail}</small> : null}
                      </button>
                    ))
                  ) : (
                    <div className="search-suggestions__status">No suggestions</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="catalog-sort-panel" aria-label="Catalog sorting and price filters">
              <label>
                <span>Sort</span>
                <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
                  <option value="featured">Featured first</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                  <option value="price_asc">Price low-high</option>
                  <option value="price_desc">Price high-low</option>
                </select>
              </label>
              <label>
                <span>Min price</span>
                <input inputMode="decimal" placeholder="0" value={minPrice} onChange={(event) => onPriceFilterChange("min", event.target.value)} />
              </label>
              <label>
                <span>Max price</span>
                <input inputMode="decimal" placeholder="Any" value={maxPrice} onChange={(event) => onPriceFilterChange("max", event.target.value)} />
              </label>
            </div>
            <div className="catalog-tools__actions">
              <button type="button" className="secondary-button catalog-filter-button" onClick={onToggleFilters}>
                <Layers3 size={18} /> Categories
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="secondary-button catalog-clear-button"
                  onClick={clearFilters}
                >
                  <X size={18} /> Clear
                </button>
              ) : null}
            </div>
          </div>

          {filtersOpen ? (
            <div className="filter-panel">
              <div className="filter-panel__section">
                <span className="filter-panel__label">Available ERP item groups</span>
                <div className="facet-chip-row">
                  {(activeDepartment ? sidebarGroups : topFacetGroups.slice(0, 24)).map((group) => (
                    <button
                      className={`facet-chip ${activeCategory === group.name ? "is-active" : ""}`}
                      key={group.name}
                      onClick={() => onCategoryChange(group.name)}
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

          {products.length ? (
            <div className="product-grid">
              {products.map((product) => (
              <article className="product-card" key={product.sku}>
                <button
                  type="button"
                  className="product-card__image"
                  onClick={() => onSelectProduct(product)}
                  aria-label={`Open details for ${product.name}`}
                >
                  <img
                    src={productImage(product)}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = productPlaceholder;
                    }}
                  />
                  <span className="tag">{activeCategory ? product.category : activeItemGroupNames.has(product.category) ? activeDepartment?.label : product.category}</span>
                </button>
                <div className="product-card__body">
                  <div className="product-card__badges">
                    <span className={`availability-badge is-${availabilityTone(product)}`}>{availabilityLabel(product)}</span>
                    <span className="sku-chip">{product.sku}</span>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{plainTextDescription(product, "ERP-ready product detail with variants, UOM, tax handling, and buying notes.")}</p>
                  <div className="product-card__footer">
                    <div>
                      <span className="price">{priceLabel(product)}</span>
                      <small>
                        <Clock3 size={14} /> Lead time confirmed by sales
                      </small>
                    </div>
                    <div className="product-card__actions">
                      <button type="button" className="secondary-button" onClick={() => onSelectProduct(product)}>
                        Details
                      </button>
                      <button type="button" className="primary-button" onClick={() => onAddToQuote(product)}>
                        <ShoppingCart size={18} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </article>
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <strong>No products found</strong>
              <p>Try another search term or clear the active catalog filters.</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  <X size={18} /> Clear filters
                </button>
              ) : null}
            </div>
          )}

          <div className="pagination">
            <button className="pagination__arrow" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="Previous page">
              Prev
            </button>
            <div className="pagination__pages" aria-label="Catalog pages">
              {pageWindow.map((item, index) =>
                item === "ellipsis" ? (
                  <span className="pagination__ellipsis" key={`ellipsis-${index}`}>...</span>
                ) : (
                  <button
                    type="button"
                    className={`pagination__page ${item === page ? "is-active" : ""}`}
                    key={item}
                    onClick={() => onPageChange(item)}
                    aria-current={item === page ? "page" : undefined}
                  >
                    {item.toLocaleString()}
                  </button>
                )
              )}
            </div>
            <span className="pagination__summary">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <button className="pagination__arrow" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function paginationWindow(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 11) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total]);
  for (let page = current - 3; page <= current + 3; page += 1) {
    if (page > 1 && page < total) pages.add(page);
  }
  if (current <= 5) {
    for (let page = 2; page <= 8; page += 1) pages.add(page);
  }
  if (current >= total - 4) {
    for (let page = total - 7; page < total; page += 1) pages.add(page);
  }

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    if (index > 0 && previous !== undefined && page - previous > 1) return ["ellipsis", page];
    return [page];
  });
}
