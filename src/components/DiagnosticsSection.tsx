import type { CatalogDiagnostics, RecentQuote } from "../types";

type DiagnosticsSectionProps = {
  diagnostics: CatalogDiagnostics | null;
  recentQuotes: RecentQuote[];
};

export function DiagnosticsSection({ diagnostics, recentQuotes }: DiagnosticsSectionProps) {
  return (
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
  );
}
