import { useEffect, useRef } from "react";
import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, Mail, MapPin, Minus, Phone, Plus, RotateCcw, Send, StickyNote, Trash2, UserRound } from "lucide-react";
import { nextOrderQuantity, offerKey, orderStep, priceLabel, productImage, productPlaceholder, purchaseFlowLabel } from "../lib/catalog";
import type { QuoteLine, QuoteResult } from "../types";

type QuoteDrawerProps = {
  isOpen: boolean;
  isAuthenticated: boolean;
  isAccountLoading: boolean;
  quoteLines: QuoteLine[];
  quoteCount: number;
  quoteTotal: number;
  quoteCompany: string;
  buyerContact: string;
  quoteEmail: string;
  buyerPhone: string;
  deliveryLocation: string;
  quoteNotes: string;
  quoteStatus: string;
  quoteResult: QuoteResult | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCompanyChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onDeliveryLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSetLineQty: (offer: string, qty: number) => void;
  onRemoveLine: (offer: string) => void;
  onClear: () => void;
  onNewQuote: () => void;
  onSubmit: () => void;
};

export function QuoteDrawer(props: QuoteDrawerProps) {
  const { isOpen, isAuthenticated, isAccountLoading, quoteLines, quoteCount, quoteTotal, quoteCompany, buyerContact, quoteEmail, buyerPhone, deliveryLocation, quoteNotes, quoteStatus, quoteResult, isSubmitting, onClose, onContactChange, onPhoneChange, onDeliveryLocationChange, onNotesChange, onSetLineQty, onRemoveLine, onClear, onNewQuote, onSubmit } = props;
  const canSubmit = isAuthenticated && quoteLines.length > 0 && !isSubmitting && !quoteResult;
  const quoteTotalLabel = quoteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])') || []);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); previousFocus?.focus(); };
  }, [isOpen]);

  return <>
    <button type="button" className={`quote-backdrop ${isOpen ? "is-open" : ""}`} aria-label="Close quote basket" onClick={onClose} tabIndex={-1} />
    <aside ref={drawerRef} className={`quote-drawer ${isOpen ? "is-open" : ""}`} role="dialog" aria-modal={isOpen || undefined} aria-label="Quote basket" aria-hidden={!isOpen} inert={!isOpen}>
      <div className="quote-drawer__header">
        <div><span>Request a quotation</span><h2>Quote basket</h2><p>{quoteResult ? "Your request has been received" : `${quoteCount} item${quoteCount === 1 ? "" : "s"} selected`}</p></div>
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close quote basket"><ArrowRight /></button>
      </div>
      <div className="quote-drawer__progress" aria-label="Quote request steps">
        <span className={quoteLines.length || quoteResult ? "is-complete" : ""}>Products</span>
        <span className={isAuthenticated ? "is-complete" : ""}>Your details</span>
        <span className={quoteResult ? "is-complete" : ""}>Request sent</span>
      </div>
      <div className="quote-drawer__content">
        <div className="quote-drawer__lines">
          {quoteLines.length ? <>
            <div className="quote-drawer__section-title"><span>Selected products</span><button type="button" onClick={onClear} disabled={isSubmitting || Boolean(quoteResult)}>Clear all</button></div>
            {quoteLines.map((line) => <article className="quote-line" key={offerKey(line)}>
              <img src={productImage(line)} alt="" onError={(event) => { event.currentTarget.src = productPlaceholder; }} />
              <div className="quote-line__body"><h3>{line.name}</h3><p>{line.sku}</p>{line.unitConfirmed ? <strong>{priceLabel(line)}</strong> : <a href={`/catalog?${new URLSearchParams({ q: line.sku })}`}>Choose the current selling unit</a>}<small>{purchaseFlowLabel(line)}</small></div>
              <div className="qty-control">
                <button type="button" className="icon-button" onClick={() => onSetLineQty(offerKey(line), nextOrderQuantity(line, line.qty, -1))} disabled={line.qty <= orderStep(line) || isSubmitting || Boolean(quoteResult)} aria-label={`Decrease quantity of ${line.name}`}><Minus /></button>
                <span aria-label={`Quantity of ${line.name}`}>{line.qty}</span>
                <button type="button" className="icon-button" onClick={() => onSetLineQty(offerKey(line), nextOrderQuantity(line, line.qty, 1))} disabled={line.qty >= nextOrderQuantity(line, line.qty, 1) || isSubmitting || Boolean(quoteResult)} aria-label={`Increase quantity of ${line.name}`}><Plus /></button>
                <button type="button" className="icon-button" onClick={() => onRemoveLine(offerKey(line))} disabled={isSubmitting || Boolean(quoteResult)} aria-label={`Remove ${line.name}`}><Trash2 /></button>
              </div>
            </article>)}
          </> : quoteResult ? <div className="quote-confirmation-empty"><ClipboardCheck size={22} /><strong>Thank you for your request</strong><p>Green Leaf sales will review your products, quantities and delivery requirements.</p></div> : <div className="quote-empty"><strong>No products selected</strong><p>Add products from the catalog, then send your basket to Green Leaf for a quote.</p><a className="secondary-button" href="/catalog" onClick={onClose}>Browse catalog</a></div>}
        </div>
        <div className="quote-form">
          {quoteResult ? <div className="quote-result" role="status">
            <div className="quote-result__header"><CheckCircle2 size={20} /><div><span>{quoteResult.dryRun ? "Request not submitted" : quoteResult.reused ? "Your existing quote request" : "Quote request received"}</span><strong>{quoteResult.name}</strong></div></div>
            <div className="quote-result__meta">{quoteResult.customerEmail ? <span>{quoteResult.customerEmail}</span> : null}</div>
            <ol className="quote-result__steps"><li>Your request is awaiting sales review.</li><li>Green Leaf will confirm pricing, availability and delivery.</li><li>Follow the quotation and any confirmed orders in your account.</li></ol>
            <div className="quote-result__actions"><a className="secondary-button" href="/account#quotes" onClick={onClose}>View quote history</a><button type="button" className="secondary-button" onClick={onNewQuote}><RotateCcw size={16} /> New request</button></div>
          </div> : !isAuthenticated ? <div className="quote-signin-notice">
            <UserRound size={24} /><strong>{isAccountLoading ? "Checking your account..." : "Sign in to request a quote"}</strong>
            <p>Create an account or sign in to send this basket and track your request. Your selected products will stay in the basket.</p>
            {!isAccountLoading ? <a className="quote-button" href="/account?basket=1" onClick={onClose}>Sign in or create account <ArrowRight size={17} /></a> : null}
          </div> : <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            <div className="quote-drawer__section-title"><span>Your details</span></div>
            <label className="field"><Building2 size={18} /><input aria-label="Company" value={quoteCompany} readOnly /></label>
            <label className="field"><Mail size={18} /><input aria-label="Verified account email" type="email" value={quoteEmail} readOnly /></label>
            <label className="field"><UserRound size={18} /><input placeholder="Contact person" aria-label="Contact person" autoComplete="name" required maxLength={140} value={buyerContact} onChange={(event) => onContactChange(event.target.value)} /></label>
            <label className="field"><Phone size={18} /><input placeholder="Phone" aria-label="Phone" type="tel" autoComplete="tel" required maxLength={40} value={buyerPhone} onChange={(event) => onPhoneChange(event.target.value)} /></label>
            <label className="field"><MapPin size={18} /><input placeholder="Delivery location" aria-label="Delivery location" autoComplete="street-address" required maxLength={200} value={deliveryLocation} onChange={(event) => onDeliveryLocationChange(event.target.value)} /></label>
            <label className="field field--textarea"><StickyNote size={18} /><textarea placeholder="Notes, timing or alternatives" aria-label="Quote notes" maxLength={2000} value={quoteNotes} onChange={(event) => onNotesChange(event.target.value)} /></label>
            <div className="quote-total"><span>Indicative subtotal, excluding VAT</span><strong>{quoteTotalLabel} FJD</strong></div>
            <div className="order-flow-note is-confirmation"><strong>Sales will confirm your quote</strong><span>Prices, availability, VAT and delivery are confirmed in your quotation. Sending a request does not place a confirmed order. No online payment is taken.</span></div>
            <button type="submit" className="quote-button" disabled={!canSubmit || quoteLines.some((line) => !line.unitConfirmed || Boolean(line.packingUnit && line.qty % line.packingUnit !== 0))}>{isSubmitting ? "Sending request..." : "Request a quote"} <Send size={17} /></button>
          </form>}
          {quoteStatus ? <p className="quote-panel__status" role="status">{quoteStatus}</p> : null}
        </div>
      </div>
    </aside>
  </>;
}
