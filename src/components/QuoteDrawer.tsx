import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ClipboardCheck, Mail, MapPin, Minus, Phone, Plus, RotateCcw, Send, StickyNote, Trash2, UserRound } from "lucide-react";
import { isSpecialOrder, priceLabel, productImage, productPlaceholder, purchaseFlowLabel, requiresAvailabilityConfirmation } from "../lib/catalog";
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
  onSetLineQty: (sku: string, qty: number) => void;
  onRemoveLine: (sku: string) => void;
  onClear: () => void;
  onNewQuote: () => void;
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
  deliveryLocation,
  quoteNotes,
  quoteStatus,
  quoteResult,
  isSubmitting,
  onClose,
  onCompanyChange,
  onContactChange,
  onEmailChange,
  onPhoneChange,
  onDeliveryLocationChange,
  onNotesChange,
  onSetLineQty,
  onRemoveLine,
  onClear,
  onNewQuote,
  onSubmit
}: QuoteDrawerProps) {
  const canSubmit = quoteLines.length > 0 && !isSubmitting && !quoteResult;
  const quoteTotalLabel = quoteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const basketRequiresConfirmation = quoteLines.some((line) => requiresAvailabilityConfirmation(line, line.qty));
  const basketHasSpecialOrder = quoteLines.some(isSpecialOrder);
  const requiresConfirmation = quoteResult?.requiresSalesConfirmation ?? basketRequiresConfirmation;
  const hasSpecialOrder = quoteResult?.fulfillmentMode === "special_order" || basketHasSpecialOrder;
  const resultTitle = quoteResult?.dryRun
    ? "Order validated"
    : quoteResult?.reused
      ? "Existing ERP request"
      : requiresConfirmation
        ? "Availability request sent"
        : "Order prepared";

  return (
    <>
      <button
        type="button"
        className={`quote-backdrop ${isOpen ? "is-open" : ""}`}
        aria-label="Close order basket"
        onClick={onClose}
        tabIndex={isOpen ? 0 : -1}
      />
      <aside className={`quote-drawer ${isOpen ? "is-open" : ""}`} aria-label="Order basket" aria-hidden={!isOpen}>
        <div className="quote-drawer__header">
          <div>
            <span>{requiresConfirmation ? "Sales confirmation path" : "In-stock checkout path"}</span>
            <h2>Order basket</h2>
            <p>{quoteResult ? "ERP request recorded" : `${quoteCount} item${quoteCount === 1 ? "" : "s"} selected from the live ERP catalog`}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close order basket">
            <ArrowRight />
          </button>
        </div>

        <div className="quote-drawer__progress" aria-label="Order steps">
          <span className={quoteLines.length || quoteResult ? "is-complete" : ""}>Products</span>
          <span className={quoteCompany && quoteEmail && buyerPhone && deliveryLocation ? "is-complete" : ""}>Details</span>
          <span className={quoteResult ? "is-complete" : ""}>Payment</span>
        </div>

        <div className="quote-drawer__content">
          <div className="quote-drawer__lines">
            {quoteLines.length ? (
              <>
                <div className="quote-drawer__section-title">
                  <span>Selected products</span>
                  <button type="button" onClick={onClear} disabled={!quoteLines.length || isSubmitting || Boolean(quoteResult)}>
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
                      <small>{purchaseFlowLabel(line)}</small>
                    </div>
                    <div className="qty-control">
                      <button type="button" className="icon-button" onClick={() => onSetLineQty(line.sku, line.qty - 1)} disabled={isSubmitting || Boolean(quoteResult)} aria-label="Decrease quantity">
                        <Minus />
                      </button>
                      <span>{line.qty}</span>
                      <button type="button" className="icon-button" onClick={() => onSetLineQty(line.sku, line.qty + 1)} disabled={isSubmitting || Boolean(quoteResult)} aria-label="Increase quantity">
                        <Plus />
                      </button>
                      <button type="button" className="icon-button" onClick={() => onRemoveLine(line.sku)} disabled={isSubmitting || Boolean(quoteResult)} aria-label="Remove item">
                        <Trash2 />
                      </button>
                    </div>
                  </article>
                ))}
              </>
            ) : quoteResult ? (
              <div className="quote-confirmation-empty">
                <ClipboardCheck size={22} />
                <strong>Order details recorded in ERPNext</strong>
                <p>{requiresConfirmation ? "Sales will confirm stock or ETA before payment." : "The order is ready for the payment step once the gateway is activated."}</p>
              </div>
            ) : (
              <div className="quote-empty">
                <strong>No products selected</strong>
                <p>Add products from the catalog. In-stock items proceed to checkout; low-stock and special-order items are confirmed first.</p>
                <a className="secondary-button" href="/catalog" onClick={onClose}>
                  Browse catalog
                </a>
              </div>
            )}
          </div>

          <div className="quote-form">
            {quoteResult ? (
              <div className="quote-result" role="status">
                <div className="quote-result__header">
                  <CheckCircle2 size={20} />
                  <div>
                    <span>{resultTitle}</span>
                    <strong>{quoteResult.name}</strong>
                  </div>
                </div>
                <div className="quote-result__meta">
                  {quoteResult.customerEmail ? <span>{quoteResult.customerEmail}</span> : null}
                  {quoteResult.id ? <span>Request ID {quoteResult.id}</span> : null}
                  {typeof quoteResult.validLineCount === "number" ? <span>{quoteResult.validLineCount} ERP line{quoteResult.validLineCount === 1 ? "" : "s"}</span> : null}
                </div>
                <ol className="quote-result__steps">
                  {requiresConfirmation ? <li>Sales confirms stock or ETA before payment.</li> : <li>ERP stock is sufficient for the requested quantity.</li>}
                  <li>{hasSpecialOrder ? "A 70% deposit applies to special-order items." : "Full payment applies to in-stock items."}</li>
                  <li>The secure payment step will be enabled after Westpac gateway approval.</li>
                </ol>
                {quoteResult.missingCount ? (
                  <div className="quote-result__warning">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>{quoteResult.missingCount} SKU not matched in ERPNext</strong>
                      <p>These products need ERP item mapping before sales can quote them.</p>
                      {quoteResult.missingSkus?.length ? (
                        <div className="quote-result__chips">
                          {quoteResult.missingSkus.slice(0, 6).map((sku) => (
                            <span key={sku}>{sku}</span>
                          ))}
                          {quoteResult.missingSkus.length > 6 ? <span>+{quoteResult.missingSkus.length - 6}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="quote-result__actions">
                  <a className="secondary-button" href="/account" onClick={onClose}>
                    Quote history
                  </a>
                  <button type="button" className="secondary-button" onClick={onNewQuote}>
                    <RotateCcw size={16} /> New quote
                  </button>
                </div>
              </div>
            ) : null}
            <div className="quote-drawer__section-title">
              <span>Buyer details</span>
              <strong>{quoteTotalLabel} FJD excl. VAT</strong>
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
            <label className="field">
              <MapPin size={18} />
              <input placeholder="Delivery location" value={deliveryLocation} onChange={(event) => onDeliveryLocationChange(event.target.value)} />
            </label>
            <label className="field field--textarea">
              <StickyNote size={18} />
              <textarea placeholder="Order notes, timing, substitutions" value={quoteNotes} onChange={(event) => onNotesChange(event.target.value)} />
            </label>
            <div className="quote-total">
              <span>Product subtotal, excluding VAT</span>
              <strong>{quoteTotalLabel} FJD</strong>
            </div>
            <div className={`order-flow-note ${requiresConfirmation ? "is-confirmation" : "is-ready"}`}>
              <strong>{requiresConfirmation ? "Confirmation required before payment" : "In-stock checkout path"}</strong>
              <span>
                {hasSpecialOrder
                  ? "Sales confirms the ETA; a 70% deposit applies. Payment links remain valid for 30 days."
                  : requiresConfirmation
                    ? "Requested quantity exceeds confirmed stock. Sales will verify availability and issue a 30-day payment link."
                    : "Full payment applies. VAT and any delivery charge will be added before payment."}
              </span>
            </div>
            {quoteResult ? null : (
              <button type="button" className="quote-button" onClick={onSubmit} disabled={!canSubmit}>
                {isSubmitting ? "Creating..." : requiresConfirmation ? "Request confirmation" : "Prepare checkout"} <Send size={17} />
              </button>
            )}
            {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
          </div>
        </div>
      </aside>
    </>
  );
}
