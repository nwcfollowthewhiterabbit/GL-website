import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { priceLabel } from "../lib/catalog";
import type { QuoteLine } from "../types";

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
  return (
    <aside className={`quote-drawer ${isOpen ? "is-open" : ""}`} aria-label="Quote basket">
      <div className="quote-drawer__header">
        <div>
          <h2>Quote basket</h2>
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
          quoteLines.map((line) => (
            <article className="quote-line" key={line.sku}>
              <div>
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
          ))
        ) : (
          <p className="empty-state">No products selected.</p>
        )}
      </div>

      <div className="quote-form">
        <label className="field">
          <input placeholder="Company" value={quoteCompany} onChange={(event) => onCompanyChange(event.target.value)} />
        </label>
        <label className="field">
          <input placeholder="Contact person" value={buyerContact} onChange={(event) => onContactChange(event.target.value)} />
        </label>
        <label className="field">
          <input placeholder="Email" type="email" value={quoteEmail} onChange={(event) => onEmailChange(event.target.value)} />
        </label>
        <label className="field">
          <input placeholder="Phone" value={buyerPhone} onChange={(event) => onPhoneChange(event.target.value)} />
        </label>
        <label className="field field--textarea">
          <textarea placeholder="Notes" value={quoteNotes} onChange={(event) => onNotesChange(event.target.value)} />
        </label>
        <div className="quote-total">
          <span>Estimated total</span>
          <strong>{quoteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FJD</strong>
        </div>
        <button className="secondary-button" onClick={onClear} disabled={!quoteLines.length || isSubmitting}>
          Clear basket
        </button>
        <button className="quote-button" onClick={onSubmit} disabled={isSubmitting || !quoteLines.length}>
          {isSubmitting ? "Creating..." : "Create quotation"}
        </button>
        {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
      </div>
    </aside>
  );
}
