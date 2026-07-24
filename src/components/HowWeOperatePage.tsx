import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  FileCheck2,
  PackageCheck,
  RefreshCcw,
  ShoppingCart,
  Truck,
  UsersRound,
  Wrench
} from "lucide-react";
import { howWeOperateContent } from "../data/editorialContent.mjs";

const capabilityIcons = [
  Boxes,
  FileCheck2,
  ShoppingCart,
  PackageCheck,
  UsersRound,
  Truck,
  Wrench,
  BarChart3
];

export function HowWeOperatePage() {
  return (
    <article className="operations-page">
      <header className="operations-hero">
        <img
          className="operations-hero__image"
          src="/assets/greenleaf-operations-hero.jpg"
          alt="A completed Green Leaf hospitality joinery project in operation"
        />
        <div className="operations-hero__shade" />
        <div className="shell operations-hero__content">
          <span>{howWeOperateContent.eyebrow}</span>
          <h1>{howWeOperateContent.h1}</h1>
          <p>{howWeOperateContent.opening}</p>
          <div className="operations-hero__actions">
            <a className="primary-button" href="/catalog">
              Explore Our Products <ArrowRight size={18} />
            </a>
            <a className="secondary-button secondary-button--light" href="/catalog#contact">
              Contact Green Leaf
            </a>
          </div>
        </div>
      </header>

      <section className="operations-section operations-section--connected">
        <div className="shell operations-section__intro">
          <div>
            <span className="operations-kicker">Connected commercial operations</span>
            <h2>A connected operation, not a collection of separate tools</h2>
          </div>
          <p>
            Green Leaf manages the commercial journey as a connected flow. Product information supports quotations;
            quotations connect to purchasing, stock and sales documents; fulfilment and service continue from the same
            customer and order history.
          </p>
        </div>
        <div className="shell operations-capabilities">
          {howWeOperateContent.capabilities.map((capability, index) => {
            const Icon = capabilityIcons[index] || ClipboardList;
            return (
              <article key={capability.title}>
                <Icon size={21} />
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="operations-section operations-section--process">
        <div className="shell">
          <div className="operations-section__heading">
            <span className="operations-kicker">From supplier to customer</span>
            <h2>One flow keeps the next action visible</h2>
            <p>
              Each stage creates or updates the information needed by the next team, while the underlying business
              record remains connected.
            </p>
          </div>
          <ol className="operations-process" aria-label="Green Leaf operational process">
            {howWeOperateContent.process.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="operations-section operations-section--outcomes">
        <div className="shell operations-outcomes-layout">
          <div className="operations-section__heading">
            <span className="operations-kicker">What this means for customers</span>
            <h2>More continuity from enquiry to after-sales support</h2>
            <p>
              The benefit is practical: customers and Green Leaf teams can work from clearer records with fewer
              disconnected handoffs.
            </p>
          </div>
          <div className="operations-outcomes">
            {howWeOperateContent.outcomes.map((outcome) => (
              <article key={outcome.title}>
                <FileCheck2 size={19} />
                <div>
                  <h3>{outcome.title}</h3>
                  <p>{outcome.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="operations-section operations-section--erp">
        <div className="shell operations-erp-layout">
          <div>
            <span className="operations-kicker">Operational foundation</span>
            <h2>ERPNext connects Green Leaf’s commercial processes</h2>
          </div>
          <div>
            <p>{howWeOperateContent.erpCopy}</p>
            <ul>
              <li>Product, price and stock information</li>
              <li>Customers, quotations and sales documents</li>
              <li>Suppliers, purchasing and delivery records</li>
              <li>Payments, warranty activity and operational reporting</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="operations-section operations-section--attribution">
        <div className="shell operations-attribution">
          <RefreshCcw size={24} />
          <div>
            <span className="operations-kicker">Built around the way Green Leaf actually works</span>
            <h2>A maintainable system that can evolve with the business</h2>
            <p>
              Green Leaf’s ERPNext workflows, integrations and supporting business automation were designed,
              implemented and continuously improved by{" "}
              <a href="https://rabbitsystems.net/cases/ecommerce-erp-sync">Rabbit Systems</a>. This gives the team a
              maintainable operational foundation that can evolve with Green Leaf’s products, customers and services.
            </p>
          </div>
        </div>
      </section>

      <section className="operations-final">
        <div className="shell operations-final__inner">
          <div>
            <span>Green Leaf Pacific</span>
            <h2>Ready to work with a supplier built for complex hospitality operations?</h2>
          </div>
          <div>
            <a className="primary-button" href="/catalog">
              Browse the Catalogue <ArrowRight size={18} />
            </a>
            <a className="secondary-button secondary-button--light" href="/catalog#contact">
              Contact Green Leaf
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}

