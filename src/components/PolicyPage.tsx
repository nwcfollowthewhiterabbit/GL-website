import { ArrowRight, FileText, LockKeyhole, Mail, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";
import type { PolicySlug } from "../lib/routes";
import { PaymentTrustMarks } from "./PaymentTrustMarks";

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
    intro: "How Green Leaf Ltd, trading as Green Leaf Pacific, handles information submitted through the catalog, ordering process and customer account.",
    icon: ShieldCheck,
    sections: [
      {
        title: "Information we collect",
        items: [
          "Business and contact details, including name, company, email, telephone number and delivery location.",
          "Products, quantities, delivery instructions and correspondence connected with a quotation, order, payment or refund.",
          "Technical information needed to operate and protect the website, including request logs and security events."
        ]
      },
      {
        title: "How information is used",
        items: [
          "To process orders and payments, confirm availability, arrange delivery and provide after-sales support.",
          "To maintain customer, quotation, order and invoice records in Green Leaf's business systems.",
          "To secure the website, investigate errors and meet legal, accounting and compliance obligations."
        ]
      },
      {
        title: "Payments and service providers",
        paragraphs: [
          "Online card payments will be processed by Windcave using its Hosted Payment Page. Full card numbers and card verification codes are not collected, processed or stored by the Green Leaf Pacific website.",
          "Information may be shared with ERP, website hosting, email, delivery and Windcave only where needed to provide the service. Windcave handles cardholder data within its own secure payment environment."
        ]
      },
      {
        title: "Access and enquiries",
        paragraphs: [
          "Contact buy@greenleafpacific.com to ask about personal information associated with your business account or request a correction. Records are kept only for as long as reasonably required for service, security, legal, tax and accounting purposes. Marketing messages will require a separate opt-in."
        ]
      }
    ]
  },
  terms: {
    eyebrow: "Trading information",
    title: "Website terms and conditions",
    intro: "These terms apply to purchases from Green Leaf Ltd, trading as Green Leaf Pacific, TIN 50-51812-0-2, in Fiji.",
    icon: FileText,
    sections: [
      {
        title: "Catalog prices",
        items: [
          "All displayed prices and online transactions are in Fijian dollars (FJD).",
          "Catalog prices exclude VAT. Applicable VAT and any delivery or service charge are shown before payment.",
          "Product information, stock and prices are sourced from ERPNext but may change before an order is accepted."
        ]
      },
      {
        title: "Stock and payment path",
        items: [
          "In-stock items can proceed to full payment after customer and delivery details are provided.",
          "Low-stock items require sales confirmation before a payment link is issued.",
          "Special-order and non-stock items require an acceptable ETA and a 70% deposit; the balance is handled under the confirmed order terms."
        ]
      },
      {
        title: "Orders and fulfilment",
        paragraphs: [
          "An order is accepted after Green Leaf validates the customer details, items, stock path and payable amount. Payment links remain valid for 30 days unless cancelled or replaced. If Green Leaf cannot fulfil an accepted paid order, the customer will be offered an appropriate alternative or refund."
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
    intro: "Delivery terms depend on order value, destination, stock status and product category.",
    icon: PackageCheck,
    sections: [
      {
        title: "Delivery charges",
        items: [
          "Orders over FJD 200 receive free delivery within Viti Levu or to the applicable shipper's yard for onward outer-island transport.",
          "For orders of FJD 200 or less, the customer pays the delivery charge shown before payment.",
          "VAT, installation, removal and any other applicable service charges are shown separately before payment."
        ]
      },
      {
        title: "Timing and availability",
        items: [
          "In-stock products are normally delivered within 72 hours after order acceptance.",
          "Special-order, imported, large equipment and furniture items normally require approximately two months and may take up to six months.",
          "A more specific lead time may be displayed or confirmed for the relevant product category."
        ]
      },
      {
        title: "Availability and outer islands",
        items: [
          "Customers must provide an accessible delivery location, telephone number and authorised contact.",
          "If an item becomes unavailable, Green Leaf sales will contact the customer within two days.",
          "For outer islands, Green Leaf delivers to the agreed shipper's yard; onward arrangements are confirmed before payment."
        ]
      },
      {
        title: "Unable to fulfil",
        paragraphs: [
          "If Green Leaf cannot fulfil an order after payment, Green Leaf will contact the customer and arrange a refund. No separate export service is offered through this storefront unless confirmed in writing."
        ]
      }
    ]
  },
  returns: {
    eyebrow: "After-sales support",
    title: "Returns, refunds and cancellations",
    intro: "Return requests must be made within 14 days and are subject to product condition, exclusions and approval.",
    icon: RotateCcw,
    sections: [
      {
        title: "Eligible returns",
        items: [
          "Change-of-mind returns may be accepted within 14 days with a 20% restocking fee.",
          "Dispatched goods may be returned when approved, subject to the 20% restocking fee.",
          "Installed equipment may be returned when approved, subject to the 20% restocking fee and an equipment removal charge."
        ]
      },
      {
        title: "Incorrect, damaged or faulty goods",
        paragraphs: [
          "Inspect goods on delivery and contact Green Leaf promptly with the order reference, affected item and quantity, a clear description of the issue, photographs or video where relevant, and the preferred contact details. Keep the goods and packaging available for inspection and do not return them without instructions."
        ]
      },
      {
        title: "Approved returns and refunds",
        paragraphs: [
          "Approved refunds are normally processed within seven days after the goods, fees and transaction are verified. Partial refunds are used where an approved restocking or equipment removal fee is deducted. Green Leaf will confirm the approved refund method with the customer."
        ]
      },
      {
        title: "Exclusions",
        paragraphs: [
          "Opened consumables, custom or made-to-order goods, special-order products and furniture cannot be returned unless faulty or otherwise required by applicable law. The customer pays return transport unless Green Leaf agrees to collect the goods. Returns and refunds require approval by the General Manager or Director of Sales."
        ]
      }
    ]
  },
  "payment-security": {
    eyebrow: "Secure card payments",
    title: "Payment and security information",
    intro: "Westpac has approved Windcave Hosted Payment Page as the card payment method for Green Leaf Pacific. Payments remain disabled on this testing storefront until Windcave UAT credentials are installed.",
    icon: LockKeyhole,
    sections: [
      {
        title: "Planned order process",
        items: [
          "In-stock items proceed to full payment after customer, telephone and delivery details are collected.",
          "Low-stock items require availability confirmation before Green Leaf sends a payment link.",
          "Special-order and non-stock items require ETA acceptance and a 70% deposit.",
          "Payment links expire after 30 days."
        ]
      },
      {
        title: "Windcave Hosted Payment Page",
        paragraphs: [
          "At checkout, the customer is redirected to Windcave's secure hosted page to enter card details and is then returned to Green Leaf Pacific. The Green Leaf Pacific website does not request, receive or store full card numbers or card verification codes.",
          "Transactions are processed in Fijian dollars (FJD). Visa, Mastercard and American Express are accepted. The hosted integration follows the PCI SAQ A model."
        ]
      },
      {
        title: "Card authentication",
        paragraphs: [
          "Where card authentication is required, the 3-D Secure step is handled within the Windcave hosted payment process. Green Leaf Pacific does not collect authentication credentials."
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
            {policy === "payment-security" ? <PaymentTrustMarks /> : null}
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
