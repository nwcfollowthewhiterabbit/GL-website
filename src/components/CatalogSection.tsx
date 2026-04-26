import { Clock3, Search, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { availabilityLabel, plainTextDescription, priceLabel, productImage } from "../lib/catalog";
import type { CatalogDiagnostics, CatalogFacets, CatalogProduct, ItemGroup } from "../types";

type CatalogSectionProps = {
  catalogState: "loading" | "ready" | "fallback";
  products: CatalogProduct[];
  itemGroups: ItemGroup[];
  visibleCategories: string[];
  topFacetGroups: ItemGroup[];
  activeCategory: string;
  searchTerm: string;
  page: number;
  totalPages: number;
  filtersOpen: boolean;
  diagnostics: CatalogDiagnostics | null;
  catalogFacets: CatalogFacets | null;
  onToggleFilters: () => void;
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
  searchTerm,
  page,
  totalPages,
  filtersOpen,
  diagnostics,
  catalogFacets,
  onToggleFilters,
  onCategoryChange,
  onSearchChange,
  onPageChange,
  onSelectProduct,
  onAddToQuote
}: CatalogSectionProps) {
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
        <button className="secondary-button" onClick={onToggleFilters}>
          <SlidersHorizontal size={18} /> Advanced filters
        </button>
      </div>

      <div className="category-row" aria-label="Catalog categories">
        <button className={`category-button ${!activeCategory ? "is-active" : ""}`} onClick={() => onCategoryChange("")}>
          All products
        </button>
        {visibleCategories.map((category) => (
          <button
            className={`category-button ${activeCategory === category ? "is-active" : ""}`}
            key={category}
            onClick={() => onCategoryChange(category)}
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
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="field">
          <select value={activeCategory} onChange={(event) => onCategoryChange(event.target.value)}>
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
                  <button className="secondary-button" onClick={() => onSelectProduct(product)}>
                    Details
                  </button>
                  <button className="icon-button" aria-label="Add to quote" onClick={() => onAddToQuote(product)}>
                    <ShoppingCart />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

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
    </section>
  );
}
