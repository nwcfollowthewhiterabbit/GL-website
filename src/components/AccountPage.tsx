import { useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import {
  ArrowRight,
  Building2,
  Phone,
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
import type { useCustomerAccount } from "../hooks/useCustomerAccount";
import type { AccountDocumentDetail, AccountSession, CustomerCornerSettings, RecentQuote } from "../types";

type AccountPageProps = {
  auth: ReturnType<typeof useCustomerAccount>;
  email: string;
  password: string;
  quotes: RecentQuote[];
  account: AccountSession | null;
  status: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  settings: CustomerCornerSettings;
  settingsLoading: boolean;
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
    if (normalized.includes("hold")) return { label: "On hold", detail: "Green Leaf will contact you with the next update." };
    if (normalized === "draft") return { label: "Awaiting confirmation", detail: "The order is being reviewed." };
    if (normalized === "completed" || Number(values.perDelivered || 0) >= 100) {
      return { label: "Completed", detail: "The order has been delivered." };
    }
    if (Number(values.perDelivered || 0) > 0) {
      return { label: "Partially delivered", detail: `${percent(values.perDelivered)} delivered.` };
    }
    if (normalized.includes("deliver") || normalized.includes("bill")) {
      return { label: "Confirmed", detail: "The order is being prepared for delivery." };
    }
    return { label: status || "In progress", detail: "The order is being processed." };
  }

  if (type === "quote") {
    if (normalized === "ordered") return { label: "Order created", detail: "The quotation has been converted to an order." };
    if (normalized.includes("expire")) return { label: "Expired", detail: "Contact Green Leaf to request an updated quotation." };
    if (normalized === "lost") return { label: "Not proceeding", detail: "The quotation was closed without an order." };
    if (normalized === "open") return { label: "Quotation ready", detail: "Green Leaf has prepared this quotation. Contact sales to confirm your order." };
    if (normalized === "draft") {
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
  const { dialogRef, closeButtonRef } = useModalFocus(true, onClose);

  const title = detail.type === "quote"
    ? "Quotation details"
    : detail.type === "invoice"
      ? "Invoice details"
      : "Sales order details";
  const showAmounts = detail.type !== "quote" || detail.status?.toLowerCase() !== "draft";
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
            {showAmounts && typeof detail.grandTotal === "number" && (
              <article>
                <span>Total</span>
                <strong>{money(detail.grandTotal)} FJD</strong>
              </article>
            )}
          </div>
          <div className="account-detail__actions">
            <a className="secondary-button" href={`mailto:${salesEmail}?subject=${encodeURIComponent(`Update request for ${detail.name}`)}`}>
              <Mail size={16} /> Request update
            </a>
          </div>
          <div className="account-detail__lines">
            {detail.lines.length ? (
              detail.lines.map((line, index) => (
                <article key={`${detail.name}-${index}`}>
                  <div>
                    <strong>{line.itemName}</strong>
                    <span>{line.itemCode}</span>
                  </div>
                  <span>{line.qty} {line.uom}</span>
                  {showAmounts && typeof line.rate === "number" && <span>{money(line.rate)} FJD</span>}
                  {showAmounts && typeof line.amount === "number" && <strong>{money(line.amount)} FJD</strong>}
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
  auth,
  email,
  password,
  quotes,
  account,
  status,
  isLoading,
  isAuthenticated,
  settings,
  settingsLoading,
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
  const [activeTab, setActiveTab] = useState<AccountTab>("quotes");
  const [showPassword, setShowPassword] = useState(false);
  const completing = auth.authMode.endsWith("complete");
  const showAccount = isAuthenticated && !completing;
  const authTitles = {
    login: "Sign in",
    register: "Create your account",
    reset: "Reset your password",
    "register-complete": "Finish your registration",
    "reset-complete": "Choose a new password"
  };
  const authCopy = {
    login: "Use your customer email and password.",
    register: "We will email you a link to verify your address before you set a password.",
    reset: "Enter your account email to receive a password reset link.",
    "register-complete": "Choose a password and add your business details to request quotes.",
    "reset-complete": "Choose a strong password. Your previous sessions will be signed out."
  };

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
      {!showAccount ? (
        <div className="account-login">
          <div className="account-login__copy">
            <span className="eyebrow">
              <ShieldCheck size={16} /> Customer account
            </span>
            <h1>{settings.title}</h1>
            <p>Create an account to request quotes, follow their progress and view your order history. Online payment is not available in this version.</p>
            <div className="account-login__support">
              <Mail size={18} />
              <div>
                <span>Need account help?</span>
                <a href={`mailto:${settings.salesEmail}`}>{settings.salesEmail}</a>
                <a href="/previous-orders">Orders from the previous website</a>
              </div>
            </div>
          </div>

          <form className="account-auth" aria-label={authTitles[auth.authMode]} onSubmit={(event) => { event.preventDefault(); void auth.submitAuth(); }}>
            <div className="account-auth__head">
              <UserRound size={20} />
              <div><strong>{authTitles[auth.authMode]}</strong><span>{authCopy[auth.authMode]}</span></div>
            </div>
            {settingsLoading || !auth.sessionReady || auth.config === null ? (
              <div className="account-auth__state" role="status"><span>Loading account access…</span></div>
            ) : !settings.loginEnabled || !auth.config.loginEnabled ? (
              <div className="account-auth__state"><Mail size={18} /><div><strong>Account access is temporarily unavailable</strong><span>Contact {settings.salesEmail} for help.</span></div></div>
            ) : (
              <>
                {!completing ? <label className="field">
                  <Mail size={18} />
                  <input placeholder="Customer email" type="email" autoComplete="username" aria-label="Customer email" required maxLength={140} value={email} onChange={(event) => onEmailChange(event.target.value)} />
                </label> : null}
                {auth.authMode === "register-complete" ? <>
                  <label className="field"><Building2 size={18} /><input placeholder="Company or business name" aria-label="Company or business name" autoComplete="organization" required maxLength={140} value={auth.company} onChange={(event) => auth.setCompany(event.target.value)} /></label>
                  <label className="field"><UserRound size={18} /><input placeholder="Contact name" aria-label="Contact name" autoComplete="name" required maxLength={140} value={auth.contact} onChange={(event) => auth.setContact(event.target.value)} /></label>
                  <label className="field"><Phone size={18} /><input placeholder="Phone number" aria-label="Phone number" type="tel" autoComplete="tel" required maxLength={40} value={auth.phone} onChange={(event) => auth.setPhone(event.target.value)} /></label>
                </> : null}
                {auth.authMode === "login" || completing ? <>
                  <div className="field">
                    <ShieldCheck size={18} />
                    <input placeholder={completing ? "New password (10+ characters)" : "Password"} type={showPassword ? "text" : "password"} autoComplete={completing ? "new-password" : "current-password"} aria-label={completing ? "New password" : "Password"} required minLength={completing ? 10 : undefined} maxLength={128} value={password} onChange={(event) => onPasswordChange(event.target.value)} />
                    <button className="account-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                  {completing ? <label className="field"><ShieldCheck size={18} /><input placeholder="Confirm new password" aria-label="Confirm new password" type={showPassword ? "text" : "password"} autoComplete="new-password" required maxLength={128} value={auth.confirmPassword} onChange={(event) => auth.setConfirmPassword(event.target.value)} /></label> : null}
                </> : null}
                <button className="quote-button" type="submit" disabled={isLoading}>
                  {isLoading ? "Please wait..." : auth.authMode === "login" ? "Sign in" : auth.authMode === "register" ? "Send verification email" : auth.authMode === "reset" ? "Send reset email" : auth.authMode === "register-complete" ? "Create account" : "Save new password"}
                </button>
                <div className="account-auth__links">
                  {auth.authMode !== "login" ? <button type="button" onClick={() => auth.changeAuthMode("login")}>Back to sign in</button> : null}
                  {auth.config.registrationEnabled && auth.authMode !== "register" ? <button type="button" onClick={() => auth.changeAuthMode("register")}>{completing ? "Request a new verification link" : "Create an account"}</button> : null}
                  {auth.config.passwordResetEnabled && auth.authMode !== "reset" ? <button type="button" onClick={() => auth.changeAuthMode("reset")}>{completing ? "Request a password reset link" : "Forgot password?"}</button> : null}
                </div>
              </>
            )}
            {status ? <p className="quote-panel__status" role="status">{status}</p> : null}
            <p className="account-auth__note">Your basket stays on this device while you register or sign in.</p>
          </form>
        </div>
      ) : null}

      {showAccount ? <div className="account-content">
        <header className="account-header account-panel--wide">
          <div>
            <span className="eyebrow">
              <UserRound size={16} /> Customer account
            </span>
            <h1>{profile?.customerName || account?.email}</h1>
            <div className="account-header__meta">
              <span><Mail size={15} /> {account?.email}</span>
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
            <h2>Your requests and orders</h2>
          </div>
          <p>Quote requests appear here first. Confirmed orders and invoices are added as Green Leaf processes your request. <a href="/previous-orders">Orders from the previous website</a></p>
        </div>

        <div className="account-next-actions account-panel--wide">
          <a className="secondary-button" href="/catalog">Browse products <ArrowRight size={16} /></a>
          <button className="quote-button" type="button" onClick={onOpenQuote}>Open quote basket</button>
        </div>
        {status ? <p className="account-feedback account-panel--wide" role="status">{status}</p> : null}
        <nav className="account-tabs account-panel--wide" aria-label="Account history">
          <button
            className={activeTab === "orders" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            aria-pressed={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
          >
            <PackageCheck size={18} /> Orders <span>{orders.length}</span>
          </button>
          <button
            className={activeTab === "quotes" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            aria-pressed={activeTab === "quotes"}
            onClick={() => setActiveTab("quotes")}
          >
            <FileText size={18} /> Quotations <span>{accountQuotes.length}</span>
          </button>
          <button
            className={activeTab === "invoices" ? "account-tab account-tab--active" : "account-tab"}
            type="button"
            aria-pressed={activeTab === "invoices"}
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
                    <small>Requested {shortDate(quote.transactionDate || quote.creation)}</small>
                  </div>
                  <span className={statusClass(displayStatus.label)} title={`ERP status: ${quote.status}`}>{displayStatus.label}</span>
                  <span className="account-status-copy">{displayStatus.detail}</span>
                  {quote.status?.toLowerCase() !== "draft" && typeof quote.grandTotal === "number" && <strong>{money(quote.grandTotal)} FJD</strong>}
                  <button className="secondary-button" type="button" onClick={() => onViewQuote(quote.name)} disabled={!isAuthenticated || isDetailLoading}>
                    <Eye size={16} /> View
                  </button>
                </article>;
              })
            ) : (
              <div className="account-empty">
                <FileText size={24} />
                <strong>No quote requests yet</strong>
                <p>{isAuthenticated ? "Your submitted quote requests appear here immediately for sales review." : "Sign in to load quotation history for this customer account."}</p>
                <button className="secondary-button" type="button" onClick={onOpenQuote}>
                  Open quote basket <ArrowRight size={16} />
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

        {auth.historyMore[activeTab] ? <button className="secondary-button account-load-more" type="button" onClick={() => void auth.loadMore(activeTab)} disabled={Boolean(auth.historyLoading)}>{auth.historyLoading === activeTab ? "Loading older records..." : "Load older records"}</button> : null}
      </div> : null}
      {showAccount && detail ? (
        <AccountDocumentModal detail={detail} salesEmail={settings.salesEmail} onClose={onCloseDetail} />
      ) : null}
    </section>
  );
}
