import { ArrowRight, FileText, LockKeyhole, Mail, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";
import type { PolicySlug } from "../lib/routes";

type PolicySection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type PolicyContent = {
  eyebrow: string;
  title: string;
  intro: string;
  icon: typeof ShieldCheck;
  sections: PolicySection[];
};

const policyContent: Record<PolicySlug, PolicyContent> = {
  privacy: {
    eyebrow: "Customer information",
    title: "Privacy policy",
    intro: "How Green Leaf Pacific handles information submitted through the catalog, quote requests and customer account.",
    icon: ShieldCheck,
    sections: [
      {
        title: "Information we collect",
        items: [
          "Business and contact details supplied with a quote request or account enquiry.",
          "Products, quantities, delivery notes and correspondence connected with a quotation or order.",
          "Technical information needed to operate and protect the website, including request logs and security events."
        ]
      },
      {
        title: "How information is used",
        items: [
          "To prepare quotations, confirm price and availability, arrange delivery and provide after-sales support.",
          "To maintain customer, quotation, order and invoice records in Green Leaf's business systems.",
          "To secure the website, investigate errors and meet legal, accounting and compliance obligations."
        ]
      },
      {
        title: "Payments and service providers",
        paragraphs: [
          "Online card payment is not currently active. When enabled, card details will be entered on an approved hosted payment page and will not be collected or stored by this website.",
          "Information is shared only with service providers needed to operate the website, ERP records, delivery and approved payment processing."
        ]
      },
      {
        title: "Access and enquiries",
        paragraphs: [
          "Contact Green Leaf Pacific to ask about personal information associated with your business account or to request a correction. Records are retained only for operational, legal and accounting needs."
        ]
      }
    ]
  },
  terms: {
    eyebrow: "Trading information",
    title: "Website terms and conditions",
    intro: "The catalog supports business purchasing and quotation requests for hospitality supplies, equipment and related services.",
    icon: FileText,
    sections: [
      {
        title: "Catalog and quotations",
        items: [
          "Catalog information is provided to help customers identify suitable products and request a trade quotation.",
          "Displayed prices are in Fijian dollars (FJD) and remain estimates until Green Leaf confirms the quotation.",
          "A submitted website request is not an accepted order and does not reserve stock."
        ]
      },
      {
        title: "Final price and availability",
        paragraphs: [
          "Green Leaf confirms product availability, substitutions, taxes, delivery charges, lead time and the final payable total before requesting payment. The approved quotation or invoice is the controlling commercial document."
        ]
      },
      {
        title: "Orders and fulfilment",
        paragraphs: [
          "An order proceeds only after the customer accepts the confirmed commercial terms and Green Leaf accepts the order. Customers should review product specifications, quantities, delivery details and payment terms before acceptance."
        ]
      },
      {
        title: "Website use",
        paragraphs: [
          "Do not attempt to interfere with the website, access another customer's information or use automated requests in a way that disrupts service. Product images and descriptions may be updated as supplier information changes."
        ]
      }
    ]
  },
  shipping: {
    eyebrow: "Order fulfilment",
    title: "Shipping and delivery policy",
    intro: "Delivery arrangements are confirmed as part of each Green Leaf quotation because products range from consumables to commercial equipment and furniture.",
    icon: PackageCheck,
    sections: [
      {
        title: "Delivery quotation",
        paragraphs: [
          "The website total covers selected products only. Freight, handling, taxes, installation and other applicable charges are confirmed before payment and shown on the approved quotation or invoice."
        ]
      },
      {
        title: "Timing and availability",
        paragraphs: [
          "Green Leaf sales confirms stock and expected lead time after receiving the request. If an item cannot be supplied as requested, the customer will be contacted with an update or suitable alternatives before payment."
        ]
      },
      {
        title: "Delivery details",
        items: [
          "Customers must provide an accessible delivery location and an authorised contact.",
          "Large equipment, furniture, installation and inter-island deliveries may require a separate freight assessment.",
          "Risk, inspection and acceptance arrangements are stated in the final quotation where applicable."
        ]
      },
      {
        title: "International and restricted goods",
        paragraphs: [
          "Export availability is confirmed case by case. Customs, biosecurity, forestry and destination-country restrictions may affect timing, charges or whether an item can be shipped."
        ]
      }
    ]
  },
  returns: {
    eyebrow: "After-sales support",
    title: "Returns, refunds and cancellations",
    intro: "Requests are reviewed against the confirmed quotation, product condition, supplier terms and applicable warranty.",
    icon: RotateCcw,
    sections: [
      {
        title: "Before dispatch",
        paragraphs: [
          "Contact Green Leaf promptly to request a change or cancellation. A request is not confirmed until Green Leaf accepts it in writing; special-order, made-to-order or already dispatched goods may not be cancellable."
        ]
      },
      {
        title: "Incorrect, damaged or faulty goods",
        paragraphs: [
          "Inspect goods on delivery and contact Green Leaf as soon as possible with the order reference, item details, description of the issue and supporting photographs where relevant. Do not return goods without return instructions."
        ]
      },
      {
        title: "Approved returns and refunds",
        paragraphs: [
          "Green Leaf will confirm whether an approved matter will be resolved by replacement, repair, credit or refund. Any refund is returned through an approved method after the goods and transaction have been verified."
        ]
      },
      {
        title: "Exclusions",
        paragraphs: [
          "Change-of-mind returns, opened consumables, custom goods and special orders are not automatically accepted. The final quotation may contain product-specific cancellation, restocking or warranty conditions."
        ]
      }
    ]
  },
  "payment-security": {
    eyebrow: "Payment readiness",
    title: "Payment and security information",
    intro: "Online card payment is being prepared for approved quotations and is not active on this testing storefront.",
    icon: LockKeyhole,
    sections: [
      {
        title: "Current process",
        items: [
          "Select products and send a quote request to Green Leaf sales.",
          "Green Leaf confirms stock, lead time, taxes, delivery charges and the final FJD amount.",
          "Payment instructions are provided only after the commercial details are confirmed."
        ]
      },
      {
        title: "Hosted card entry",
        paragraphs: [
          "When online payment is activated, the customer will be transferred to an approved payment provider's secure hosted page. This website will not request, process or store full card numbers or card verification codes."
        ]
      },
      {
        title: "Payment confirmation",
        paragraphs: [
          "A browser return page alone will not be treated as proof of payment. Green Leaf systems will verify the provider result before a quotation, order or invoice is marked as paid."
        ]
      },
      {
        title: "Unexpected payment requests",
        paragraphs: [
          "Do not send card details by email, quote notes or the contact form. Contact Green Leaf directly if a payment link, amount or merchant name appears unexpected."
        ]
      }
    ]
  }
};

export function PolicyPage({ policy }: { policy: PolicySlug }) {
  const content = policyContent[policy];
  const Icon = content.icon;

  return (
    <section className="policy-page">
      <div className="shell policy-page__inner">
        <header className="policy-page__header">
          <span><Icon size={18} /> {content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </header>
        <div className="policy-page__layout">
          <nav className="policy-page__nav" aria-label="Policy pages">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/shipping">Shipping</a>
            <a href="/returns">Returns</a>
            <a href="/payment-security">Payment security</a>
          </nav>
          <div className="policy-page__content">
            {content.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items ? (
                  <ul>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
        <footer className="policy-page__contact">
          <div>
            <strong>Need clarification before ordering?</strong>
            <span>Green Leaf sales can confirm product, delivery and commercial terms.</span>
          </div>
          <a className="primary-button" href="mailto:buy@greenleafpacific.com">
            <Mail size={18} /> Contact sales <ArrowRight size={18} />
          </a>
        </footer>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="policy-page">
      <div className="shell policy-page__inner policy-page__not-found">
        <span>Page not found</span>
        <h1>The requested page is not available.</h1>
        <a className="primary-button" href="/catalog">Return to catalog <ArrowRight size={18} /></a>
      </div>
    </section>
  );
}
