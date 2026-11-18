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
    intro: "How Green Leaf Ltd, trading as Green Leaf Pacific, handles information used for catalog enquiries, quotations and customer accounts.",
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
          "To prepare quotations, confirm availability, arrange orders and delivery, and provide after-sales support.",
          "To maintain customer, quotation, order and invoice records in Green Leaf's business systems.",
          "To secure the website, investigate errors and meet legal, accounting and compliance obligations."
        ]
      },
      {
        title: "Service providers",
        paragraphs: [
          "Green Leaf uses its business systems, hosting and email providers to manage account access, prepare quotations and communicate with customers. The storefront does not collect card details.",
          "When arranging delivery, Green Leaf may share the contact and delivery information needed to fulfil your order."
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
    intro: "These terms apply to quotation requests and purchases from Green Leaf Ltd, trading as Green Leaf Pacific, TIN 50-51812-0-2, in Fiji.",
    icon: FileText,
    sections: [
      {
        title: "Catalog prices",
        items: [
          "Catalog prices are shown in Fijian dollars (FJD).",
          "Catalog prices exclude VAT. Sales confirms the final price, applicable VAT and any delivery or service charges in your quotation.",
          "Product information, stock and prices are sourced from ERPNext but may change before an order is accepted."
        ]
      },
      {
        title: "Requesting a quotation",
        items: [
          "Sign in to submit your basket to Green Leaf sales. You can follow the request in your customer account.",
          "Sales checks the quantities and availability of every item before confirming your quotation.",
          "For special-order items, sales will also confirm lead times and any applicable deposit with you."
        ]
      },
      {
        title: "Orders and fulfilment",
        paragraphs: [
          "Sending a quotation request does not reserve stock or place an order. Green Leaf sales agrees the order, payment and delivery arrangements with you directly. If Green Leaf cannot fulfil an accepted paid order, the customer will be offered an appropriate alternative or refund."
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
          "For orders of FJD 200 or less, sales confirms the delivery charge with the customer in the quotation.",
          "Sales confirms VAT, installation, removal and any other applicable charges with the customer before payment."
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
    intro: "These terms cover goods ordered from Green Leaf. Return requests must be made within 14 days and are subject to product condition, exclusions and approval. For changes to a quotation request, contact sales with its reference.",
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
    eyebrow: "Quotations and payments",
    title: "Payment and security information",
    intro: "Green Leaf sales confirms prices, quantities and delivery for each quotation request.",
    icon: LockKeyhole,
    sections: [
      {
        title: "After you send a request",
        paragraphs: [
          "Your account shows the quotation reference and status. When you are ready to order, contact sales with this reference to confirm the order and payment arrangements."
        ]
      },
      {
        title: "Protect your payment details",
        paragraphs: [
          "Keep card numbers, verification codes and banking passwords out of quotation notes and email. If you receive unexpected payment instructions, call the showroom on +679 670 2222 to check them before paying."
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
