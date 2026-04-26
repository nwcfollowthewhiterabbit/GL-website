import { DatabaseZap } from "lucide-react";
import { erpFeatures } from "../data/erpFeatures";

export function IntegrationSection() {
  return (
    <section className="erp-band" id="erp">
      <div className="shell erp-layout">
        <div>
          <span className="eyebrow">
            <DatabaseZap size={16} /> ERPNext integration layer
          </span>
          <h2>Designed around two-way commerce data.</h2>
          <p>
            The UI separates product merchandising from operational truth: ERPNext can own stock, prices, customers,
            quotations, sales orders, invoices, and service tickets while the storefront stays fast and polished.
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
  );
}
