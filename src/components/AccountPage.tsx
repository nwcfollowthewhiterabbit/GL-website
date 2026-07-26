import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import type { AccountDocumentDetail, AccountSession, CustomerCornerSettings, RecentQuote } from "../types";

type AccountPageProps = {
  email: string;
  password: string;
  quotes: RecentQuote[];
  account: AccountSession | null;
  status: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  settings: CustomerCornerSettings;
  detail: AccountDocumentDetail | null;
  isDetailLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  onRefreshAccount: () => void;
  onLogout: () => void;
  onOpenQuote: () => void;
  onViewQuote: (name: string) => void;
  onViewOrder: (name: string) => void;
  onViewInvoice: (name: string) => void;
  onCloseDetail: () => void;
};

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status?: string) {
  return `account-status account-status--${String(status || "open").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function percent(value?: number) {
  return `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;
}

type AccountTab = "orders" | "quotes" | "invoices";
type DocumentType = "order" | "quote" | "invoice";

function customerStatus(
  type: DocumentType,
  statusValue?: string,
  values: { perDelivered?: number; perBilled?: number; outstandingAmount?: number } = {}
) {
  const status = String(statusValue || "").trim();
  const normalized = status.toLowerCase();

  if (normalized.includes("cancel")) return { label: "Cancelled", detail: "This document is no longer active." };
  if (normalized.includes("closed")) return { label: "Closed", detail: "No further action is expected." };

  if (type === "order") {
    if (normalized === "completed" || Number(values.perDelivered || 0) >= 100) {
      return { label: "Completed", detail: "The order has been delivered." };
    }
    if (Number(values.perDelivered || 0) > 0) {
      return { label: "Partially delivered", detail: `${percent(values.perDelivered)} delivered.` };
    }
    if (normalized.includes("hold")) return { label: "On hold", detail: "Green Leaf will contact you with the next update." };
    if (normalized === "draft") return { label: "Awaiting confirmation", detail: "The order is being reviewed." };
    if (normalized.includes("deliver") || normalized.includes("bill")) {
      return { label: "Confirmed", detail: "The order is being prepared for delivery." };
    }
    return { label: status || "In progress", detail: "The order is being processed." };
  }

  if (type === "quote") {
    if (normalized === "ordered") return { label: "Order created", detail: "The quotation has been converted to an order." };
    if (normalized.includes("expire")) return { label: "Expired", detail: "Contact Green Leaf to request an updated quotation." };
    if (normalized === "lost") return { label: "Not proceeding", detail: "The quotation was closed without an order." };
    if (normalized === "open" || normalized === "draft") {
      return { label: "Under review", detail: "Green Leaf is reviewing pricing and availability." };
    }
    return { label: status || "Under review", detail: "The quotation is being processed." };
  }

  if (normalized === "draft") return { label: "Preparing", detail: "The invoice is being prepared." };
  if (normalized === "paid" || Number(values.outstandingAmount || 0) <= 0) {
    return { label: "Paid", detail: "No payment is outstanding." };
  }
  if (normalized.includes("overdue")) return { label: "Overdue", detail: `${money(Number(values.outstandingAmount || 0))} FJD outstanding.` };
  if (normalized.includes("unpaid") || normalized.includes("outstanding")) {
    return { label: "Payment due", detail: `${money(Number(values.outstandingAmount || 0))} FJD outstanding.` };
  }
  return { label: status || "Issued", detail: `${money(Number(values.outstandingAmount || 0))} FJD outstanding.` };
}

type AccountDocumentModalProps = {
  detail: AccountDocumentDetail;
  salesEmail: string;
  onClose: () => void;
};

function AccountDocumentModal({ detail, salesEmail, onClose }: AccountDocumentModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const title = detail.type === "quote"
    ? "Quotation details"
    : detail.type === "invoice"
      ? "Invoice details"
      : "Sales order details";
  const displayStatus = customerStatus(detail.type, detail.status, {
    perDelivered: detail.type === "order" ? detail.perDelivered : undefined,
    perBilled: detail.type === "order" ? detail.perBilled : undefined,
    outstandingAmount: detail.type === "invoice" ? detail.outstandingAmount : undefined
  });

  return (
    <div
      className="account-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="account-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-document-title"
      >
        <header className="account-detail-modal__header">
          <div>
            <span>{title}</span>
            <h3 id="account-document-title">{detail.name}</h3>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close document details"
            title="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="account-detail-modal__body">
          <div className="account-detail__meta">
            <article>
              <span>Status</span>
              <strong>{displayStatus.label}</strong>
            </article>
            <article>
              <span>Customer</span>
              <strong>{detail.customer}</strong>
            </article>
            <article>
              <span>{detail.type === "quote" ? "Valid until" : detail.type === "invoice" ? "Due date" : "Delivery date"}</span>
              <strong>{detail.type === "quote" ? shortDate(detail.validTill) : detail.type === "invoice" ? shortDate(detail.dueDate) : shortDate(detail.deliveryDate)}</strong>
            </article>
            <article>
              <span>Total</span>
              <strong>{money(detail.grandTotal)} FJD</strong>
            </article>
          </div>
          <div className="account-detail__actions">
            <a className="secondary-button" href={`mailto:${salesEmail}?subject=${encodeURIComponent(`Update request for ${detail.name}`)}`}>
              <Mail size={16} /> Request update
            </a>
          </div>
          <div className="account-detail__lines">
            {detail.lines.length ? (
              detail.lines.map((line) => (
                <article key={`${detail.name}-${line.itemCode}-${line.qty}`}>
                  <div>
                    <strong>{line.itemName}</strong>
                    <span>{line.itemCode}</span>
                  </div>
                  <span>{line.qty} {line.uom}</span>
                  <span>{money(line.rate)} FJD</span>
                  <strong>{money(line.amount)} FJD</strong>
                </article>
              ))
            ) : (
              <p className="empty-state">No item lines available for this document.</p>
            )}
          </div>
          {detail.type === "order" ? (
            <div className="account-detail__progress">
              <span>Delivered {percent(detail.perDelivered)}</span>
              <span>Billed {percent(detail.perBilled)}</span>
            </div>
          ) : null}
          {detail.type === "invoice" ? (
            <div className="account-detail__progress">
              <span>Outstanding {money(detail.outstandingAmount)} FJD</span>
              <span>Due {shortDate(detail.dueDate)}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function AccountPage({
  email,
  password,
  quotes,
  account,
  status,
  isLoading,
  isAuthenticated,
  settings,
  detail,
  isDetailLoading,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onRefreshAccount,
  onLogout,
  onOpenQuote,
  onViewQuote,
  onViewOrder,
  onViewInvoice,
  onCloseDetail
}: AccountPageProps) {
  const accountQuotes = account?.quotes || quotes;
  const orders = account?.orders || [];
  const invoices = account?.invoices || [];
  const profile = account?.profile;
  const quotesVisible = settings.showQuoteHistory;
  const ordersVisible = settings.showPurchaseHistory;
  const [activeTab, setActiveTab] = useState<AccountTab>("orders");
  const [showPassword, setShowPassword] = useState(false);

  if (!settings.enabled) {
    return (
      <section className="shell section account-page">
        <div className="account-disabled">
          <ShieldCheck size={28} />
          <h2>Customer corner is temporarily unavailable.</h2>
          <p>Contact Green Leaf sales for quotation and order updates.</p>
          <div>
            <a className="secondary-button" href={`mailto:${settings.salesEmail}`}>
              <Mail size={18} /> {settings.salesEmail}
            </a>
            <a className="secondary-button" href={`tel:${settings.salesPhone.replace(/\s+/g, "")}`}>
              {settings.salesPhone}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="shell section account-page">
      {!isAuthenticated ? (
        <div className="account-login">
          <div className="account-login__copy">
            <span className="eyebrow">
              <ShieldCheck size={16} /> Customer account
            </span>
            <h1>{settings.title}</h1>
            <p>{settings.introCopy}</p>
            <div className="account-login__support">
              <Mail size={18} />
              <div>
                <span>Need account help?</span>
                <a href={`mailto:${settings.salesEmail}`}>{settings.salesEmail}</a>
              </div>
            </div>
          </div>

          <aside className="account-auth" aria-label="Customer login">
            <div className="account-auth__head">
              <UserRound size={20} />
              <div>
                <strong>Sign in</strong>
                <span>Use your customer email and password.</span>
              </div>
            </div>
            {!settings.loginEnabled ? (
              <div className="account-auth__state">
                <Mail size={18} />
                <div>
                  <strong>Customer login is disabled</strong>
                  <span>Contact {settings.salesEmail} for account history.</span>
                </div>
              </div>
            ) : (
              <>
                <label className="field">
                  <Mail size={18} />
                  <input
                    placeholder="Customer email"
                    type="email"
                    autoComplete="username"
                    aria-label="Customer email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                  />
                </label>
                <div className="field">
                  <ShieldCheck size={18} />
                  <input
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    aria-label="Password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onLogin();
                    }}
                  />
                  <button
                    className="account-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button className="quote-button" onClick={onLogin} disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </button>
              </>
            )}
            {status ? <p className="quote-panel__status">{status}</p> : null}
          </aside>
        </div>
      ) : null}

      {isAuthenticated ? <div className="account-content">
        <header className="account-header account-panel--wide">
          <div>
            <span className="eyebrow">
              <UserRound size={16} /> Customer account
            </span>
            <h1>{profile?.customerName || account?.email}</h1>
            <div className="account-header__meta">
              <span><Mail size={15} /> {profile?.email || account?.email}</span>
              {profile?.territory ? <span><MapPin size={15} /> {profile.territory}</span> : null}
              {profile?.group ? <span>{profile.group}</span> : null}
            </div>
          </div>
          <div className="account-header__actions">
            <button className="secondary-button" type="button" onClick={onRefreshAccount} disabled={isLoading}>
              <RefreshCcw size={17} /> {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="secondary-button" type="button" onClick={onLogout}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </header>

        <div className="account-history-head account-panel--wide">
          <div>
            <span>Account activity</span>
            <h2>Documents</h2>
          </div>
          <p>Track orders, quotations and invoices linked to this customer.</p>
        </div>

        <nav className="account-tabs account-panel--wide" aria-label="Account history">
          <button
            className={activeTab === "orders" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            onClick={() => setActiveTab("orders")}
          >
            <PackageCheck size={18} /> Orders <span>{orders.length}</span>
          </button>
          <button
            className={activeTab === "quotes" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            onClick={() => setActiveTab("quotes")}
          >
            <FileText size={18} /> Quotations <span>{accountQuotes.length}</span>
          </button>
          <button
            className={activeTab === "invoices" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            onClick={() => setActiveTab("invoices")}
          >
            <ReceiptText size={18} /> Invoices <span>{invoices.length}</span>
          </button>
        </nav>

        {quotesVisible && activeTab === "quotes" ? (
        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>{accountQuotes.length} {accountQuotes.length === 1 ? "record" : "records"}</span>
              <h3>Quote history</h3>
            </div>
            <FileText size={22} />
          </div>

          <div className="account-quotes">
            {accountQuotes.length ? (
              accountQuotes.map((quote) => {
                const displayStatus = customerStatus("quote", quote.status);
                return <article key={quote.name}>
                  <div>
                    <strong>{quote.name}</strong>
                    <span>{quote.customer}</span>
                    <small>{quote.marker || quote.orderType || "Website quotation"}</small>
                  </div>
                  <span className={statusClass(displayStatus.label)} title={`ERP status: ${quote.status}`}>{displayStatus.label}</span>
                  <span className="account-status-copy">{displayStatus.detail}</span>
                  <strong>{money(quote.grandTotal)} FJD</strong>
                  <button className="secondary-button" type="button" onClick={() => onViewQuote(quote.name)} disabled={!isAuthenticated || isDetailLoading}>
                    <Eye size={16} /> View
                  </button>
                </article>;
              })
            ) : (
              <div className="account-empty">
                <FileText size={24} />
                <strong>No quote history loaded</strong>
                <p>{isAuthenticated ? "New quote requests will appear here after Green Leaf prepares the quotation." : "Sign in to load quotation history for this customer account."}</p>
                <button className="secondary-button" type="button" onClick={onOpenQuote}>
                  Start order <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {ordersVisible && activeTab === "invoices" ? (
        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>{invoices.length} {invoices.length === 1 ? "record" : "records"}</span>
              <h3>Invoice history</h3>
            </div>
            <FileText size={22} />
          </div>

          <div className="account-quotes">
            {invoices.length ? (
              invoices.map((invoice) => {
                const displayStatus = customerStatus("invoice", invoice.status, { outstandingAmount: invoice.outstandingAmount });
                return <article key={invoice.name}>
                  <div>
                    <strong>{invoice.name}</strong>
                    <span>{invoice.customer}</span>
                    <small>Due {shortDate(invoice.dueDate)}</small>
                  </div>
                  <span className={statusClass(displayStatus.label)} title={`ERP status: ${invoice.status}`}>{displayStatus.label}</span>
                  <span className="account-status-copy">{displayStatus.detail}</span>
                  <strong>{money(invoice.grandTotal)} FJD</strong>
                  <button className="secondary-button" type="button" onClick={() => onViewInvoice(invoice.name)} disabled={!isAuthenticated || isDetailLoading}>
                    <Eye size={16} /> View
                  </button>
                </article>;
              })
            ) : (
              <div className="account-empty">
                <FileText size={24} />
                <strong>{isAuthenticated ? "No invoices found" : "Invoices are locked"}</strong>
                <p>{isAuthenticated ? "Invoices for this customer will appear here." : "Sign in to load invoices for this customer account."}</p>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {ordersVisible && activeTab === "orders" ? (
        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>{orders.length} {orders.length === 1 ? "record" : "records"}</span>
              <h3>Order history</h3>
            </div>
            <PackageCheck size={22} />
          </div>

          <div className="account-quotes">
            {orders.length ? (
              orders.map((order) => {
                const displayStatus = customerStatus("order", order.status, {
                  perDelivered: order.perDelivered,
                  perBilled: order.perBilled
                });
                return <article key={order.name}>
                  <div>
                    <strong>{order.name}</strong>
                    <span>{order.customer}</span>
                    <small>Delivery {shortDate(order.deliveryDate)}</small>
                  </div>
                  <span className={statusClass(displayStatus.label)} title={`ERP status: ${order.status}`}>{displayStatus.label}</span>
                  <span className="account-status-copy">{displayStatus.detail}</span>
                  <strong>{money(order.grandTotal)} FJD</strong>
                  <button className="secondary-button" type="button" onClick={() => onViewOrder(order.name)} disabled={!isAuthenticated || isDetailLoading}>
                    <Eye size={16} /> View
                  </button>
                </article>;
              })
            ) : (
              <div className="account-empty">
                <PackageCheck size={24} />
                <strong>{isAuthenticated ? "No orders found" : "Order history is locked"}</strong>
                <p>{isAuthenticated ? "Confirmed orders for this customer will appear here." : "Sign in to load order history for this customer account."}</p>
              </div>
            )}
          </div>
        </section>
        ) : null}

      </div> : null}
      {isAuthenticated && detail ? (
        <AccountDocumentModal detail={detail} salesEmail={settings.salesEmail} onClose={onCloseDetail} />
      ) : null}
    </section>
  );
}
