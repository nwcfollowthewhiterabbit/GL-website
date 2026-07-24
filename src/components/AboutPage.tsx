import { ArrowRight, Building2, CheckCircle2, PackageCheck, Wrench } from "lucide-react";
import { legacyAbout } from "../data/legacyContent";

export function AboutPage() {
  return (
    <article className="about-page">
      <header className="shell about-page__header">
        <span><Building2 size={18} /> About Green Leaf</span>
        <h1>Hospitality supply backed by local service and connected operations</h1>
        <p>{legacyAbout.intro}</p>
      </header>

      <section className="shell about-page__layout">
        <div>
          <span className="operations-kicker">What customers can expect</span>
          <h2>Commercial supply with continuity after the sale</h2>
          <ul>
            {legacyAbout.promises.map((promise) => (
              <li key={promise}><CheckCircle2 size={18} /> {promise}</li>
            ))}
          </ul>
        </div>
        <div className="about-page__operations">
          <PackageCheck size={24} />
          <h2>More than a product catalogue</h2>
          <p>
            Green Leaf connects product information, quotations, purchasing, inventory, sales, delivery and service
            through one operational foundation.
          </p>
          <a href="/how-we-operate">
            See how Green Leaf operates <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="about-page__service">
        <div className="shell">
          <Wrench size={24} />
          <div>
            <span className="operations-kicker">After-sales support</span>
            <h2>{legacyAbout.serviceLine}</h2>
          </div>
          <a className="primary-button" href="/catalog#contact">Contact Green Leaf <ArrowRight size={18} /></a>
        </div>
      </section>
    </article>
  );
}

