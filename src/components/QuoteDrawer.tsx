import { ArrowRight, Building2, CheckCircle2, Mail, Minus, Phone, Plus, StickyNote, Trash2, UserRound } from "lucide-react";
import { priceLabel, productImage, productPlaceholder } from "../lib/catalog";
import type { QuoteLine, QuoteResult } from "../types";

type QuoteDrawerProps = {
  isOpen: boolean;
  quoteLines: QuoteLine[];
  quoteCount: number;
  quoteTotal: number;
  quoteCompany: string;
  buyerContact: string;
  quoteEmail: string;
  buyerPhone: string;
  quoteNotes: string;
  quoteStatus: string;
  quoteResult: QuoteResult | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCompanyChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSetLineQty: (sku: string, qty: number) => void;
  onRemoveLine: (sku: string) => void;
  onClear: () => void;
  onSubmit: () => void;
};

export function QuoteDrawer({
  isOpen,
  quoteLines,
  quoteCount,
  quoteTotal,
  quoteCompany,
  buyerContact,
  quoteEmail,
  buyerPhone,
  quoteNotes,
  quoteStatus,
  quoteResult,
  isSubmitting,
  onClose,
  onCompanyChange,
  onContactChange,
  onEmailChange,
  onPhoneChange,
  onNotesChange,
  onSetLineQty,
  onRemoveLine,
  onClear,
  onSubmit
}: QuoteDrawerProps) {
  const canSubmit = quoteLines.length > 0 && !isSubmitting;
  const quoteTotalLabel = quoteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <aside className={`quote-drawer ${isOpen ? "is-open" : ""}`} aria-label="Quote basket">
      <div className="quote-drawer__header">
        <div>
          <span>Request for quote</span>
          <h2>Trade quote</h2>
          <p>
            {quoteCount} item{quoteCount === 1 ? "" : "s"} selected
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close quote basket">
          <ArrowRight />
        </button>
      </div>

      <div className="quote-drawer__lines">
        {quoteLines.length ? (
          <>
            <div className="quote-drawer__section-title">
              <span>Selected products</span>
              <button onClick={onClear} disabled={!quoteLines.length || isSubmitting}>
                Clear all
              </button>
            </div>
            {quoteLines.map((line) => (
              <article className="quote-line" key={line.sku}>
                <img
                  src={productImage(line)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = productPlaceholder;
                  }}
                />
                <div className="quote-line__body">
                  <h3>{line.name}</h3>
                  <p>{line.sku}</p>
                  <strong>{priceLabel(line)}</strong>
                </div>
                <div className="qty-control">
                  <button className="icon-button" onClick={() => onSetLineQty(line.sku, line.qty - 1)} aria-label="Decrease quantity">
                    <Minus />
                  </button>
                  <span>{line.qty}</span>
                  <button className="icon-button" onClick={() => onSetLineQty(line.sku, line.qty + 1)} aria-label="Increase quantity">
                    <Plus />
                  </button>
                  <button className="icon-button" onClick={() => onRemoveLine(line.sku)} aria-label="Remove item">
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="quote-empty">
            <strong>No products selected</strong>
            <p>Add products from the catalog and send them to Green Leaf sales for price, stock and lead time confirmation.</p>
            <a className="secondary-button" href="/catalog" onClick={onClose}>
              Browse catalog
            </a>
          </div>
        )}
      </div>

      <div className="quote-form">
        {quoteResult ? (
          <div className="quote-result" role="status">
            <span>
              <CheckCircle2 size={16} /> {quoteResult.reused ? "Existing quotation" : "Quotation created"}
            </span>
            <strong>{quoteResult.name}</strong>
            <p>
              {quoteResult.missingCount
                ? `${quoteResult.missingCount} SKU could not be matched in ERPNext.`
                : "Your request is now available in ERPNext for the sales team."}
            </p>
          </div>
        ) : null}
        <div className="quote-drawer__section-title">
          <span>Buyer details</span>
          <strong>{quoteTotalLabel} FJD est.</strong>
        </div>
        <label className="field">
          <Building2 size={18} />
          <input placeholder="Company" value={quoteCompany} onChange={(event) => onCompanyChange(event.target.value)} />
        </label>
        <label className="field">
          <UserRound size={18} />
          <input placeholder="Contact person" value={buyerContact} onChange={(event) => onContactChange(event.target.value)} />
        </label>
        <label className="field">
          <Mail size={18} />
          <input placeholder="Email" type="email" value={quoteEmail} onChange={(event) => onEmailChange(event.target.value)} />
        </label>
        <label className="field">
          <Phone size={18} />
          <input placeholder="Phone" value={buyerPhone} onChange={(event) => onPhoneChange(event.target.value)} />
        </label>
        <label className="field field--textarea">
          <StickyNote size={18} />
          <textarea placeholder="Notes, delivery location, timing, substitutions" value={quoteNotes} onChange={(event) => onNotesChange(event.target.value)} />
        </label>
        <div className="quote-total">
          <span>Estimated product total</span>
          <strong>{quoteTotalLabel} FJD</strong>
        </div>
        <button className="quote-button" onClick={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? "Creating..." : "Send quote request"}
        </button>
        {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
      </div>
    </aside>
  );
}
