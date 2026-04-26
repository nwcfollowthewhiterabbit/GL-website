import { ChevronRight, Clock3, Layers3, Search, ShoppingCart, X } from "lucide-react";
import { availabilityLabel, availabilityTone, plainTextDescription, priceLabel, productImage, productPlaceholder } from "../lib/catalog";
import type { CatalogDiagnostics, CatalogFacets, CatalogProduct, ItemGroup, WebsiteCategory } from "../types";

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
  page: number;
  pageSize: number;
  productCount: number;
  totalPages: number;
  filtersOpen: boolean;
  diagnostics: CatalogDiagnostics | null;
  catalogFacets: CatalogFacets | null;
  onToggleFilters: () => void;
  onDepartmentChange: (categoryId: string) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (value: string) => void;
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
  page,
  pageSize,
  productCount,
  totalPages,
  filtersOpen,
  diagnostics,
  catalogFacets,
  onToggleFilters,
  onDepartmentChange,
  onCategoryChange,
  onSearchChange,
  onPageChange,
  onSelectProduct,
  onAddToQuote
}: CatalogSectionProps) {
  const activeDepartment = visibleCategories.find((category) => category.id === activeWebsiteCategory);
  const activeLabel = activeCategory || activeDepartment?.label || "All products";
  const hasActiveFilters = Boolean(activeCategory || activeWebsiteCategory || searchTerm);
  const activeItemGroupNames = new Set(activeDepartment?.availableItemGroups || []);
  const itemGroupByName = new Map(itemGroups.map((group) => [group.name, group]));
  const sidebarGroups = activeDepartment
    ? activeDepartment.availableItemGroups
        .map((name) => itemGroupByName.get(name))
        .filter((group): group is ItemGroup => Boolean(group))
        .sort((a, b) => b.itemCount - a.itemCount)
    : topFacetGroups.slice(0, 18);

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

      <div className="catalog-layout">
        <aside className={`catalog-sidebar ${filtersOpen ? "is-open" : ""}`} aria-label="Catalog navigation">
          <div className="catalog-sidebar__head">
            <span>Departments</span>
            <strong>{activeLabel}</strong>
          </div>
          <button className={`catalog-nav-button ${!activeCategory && !activeWebsiteCategory ? "is-active" : ""}`} onClick={() => onDepartmentChange("")}>
            <span>All products</span>
            <ChevronRight size={16} />
          </button>
          {visibleCategories.map((category) => (
            <button
              className={`catalog-nav-button ${activeWebsiteCategory === category.id ? "is-active" : ""}`}
              key={category.id}
              onClick={() => onDepartmentChange(category.id)}
            >
              <span>{category.label}</span>
              <strong>{category.itemCount.toLocaleString()}</strong>
            </button>
          ))}

          <div className="catalog-sidebar__groups">
            <span>{activeDepartment ? "Subcategories" : "Popular ERP groups"}</span>
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
        </aside>

        <div className="catalog-main">
          <div className="catalog-current">
            <div>
              <span>{activeDepartment ? "Department" : activeCategory ? "ERP item group" : "Catalog"}</span>
              <strong>{activeLabel}</strong>
            </div>
            {activeDepartment ? <p>{activeDepartment.description}</p> : null}
          </div>

          <div className="catalog-tools">
            <label className="search">
              <Search size={18} />
              <input
                placeholder="Search product name, SKU, dimensions"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
            <div className="catalog-tools__actions">
              <button type="button" className="secondary-button catalog-filter-button" onClick={onToggleFilters}>
                <Layers3 size={18} /> Categories
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="secondary-button catalog-clear-button"
                  onClick={() => {
                    onSearchChange("");
                    onDepartmentChange("");
                  }}
                >
                  <X size={18} /> Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="catalog-status">
            <div>
              <span>Showing</span>
              <strong>
                {products.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, productCount).toLocaleString()} of{" "}
                {productCount.toLocaleString()}
              </strong>
            </div>
            <div>
              <span>Price mode</span>
              <strong>{diagnostics?.priceList || "Standard Selling"}</strong>
            </div>
            <div>
              <span>Stock rule</span>
              <strong>Showroom excluded</strong>
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
              <article className="product-card" key={product.name}>
                <div className="product-card__image">
                  <img
                    src={productImage(product)}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = productPlaceholder;
                    }}
                  />
                  <span className="tag">{activeItemGroupNames.has(product.category) ? activeDepartment?.label : product.category}</span>
                </div>
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
                  onClick={() => {
                    onSearchChange("");
                    onDepartmentChange("");
                  }}
                >
                  <X size={18} /> Clear filters
                </button>
              ) : null}
            </div>
          )}

          <div className="pagination">
            <button className="secondary-button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <button className="secondary-button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
