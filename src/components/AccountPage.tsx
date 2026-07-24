import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  UserRound
} from "lucide-react";
import type { AccountDocumentDetail, AccountSession, CustomerCornerSettings, RecentQuote } from "../types";

type AccountPageProps = {
  email: string;
  code: string;
  quotes: RecentQuote[];
  account: AccountSession | null;
  status: string;
  devCode: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  settings: CustomerCornerSettings;
  detail: AccountDocumentDetail | null;
  isDetailLoading: boolean;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onStartLogin: () => void;
  onVerifyLogin: () => void;
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

export function AccountPage({
  email,
  code,
  quotes,
  account,
  status,
  devCode,
  isLoading,
  isAuthenticated,
  settings,
  detail,
  isDetailLoading,
  onEmailChange,
  onCodeChange,
  onStartLogin,
  onVerifyLogin,
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
  const latestQuote = accountQuotes[0];
  const latestOrder = orders[0];
  const latestInvoice = invoices[0];
  const quotesVisible = settings.showQuoteHistory;
  const ordersVisible = settings.showPurchaseHistory;
  const [activeTab, setActiveTab] = useState<AccountTab>("orders");

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
      <div className="account-shell">
        <div className="account-hero">
          <span className="eyebrow">
            <ShieldCheck size={16} /> Customer corner
          </span>
          <h2>{settings.title}</h2>
          <p>{settings.introCopy}</p>
          <div className="account-hero__actions">
            <a className="quote-button" href="/catalog">
              <ShoppingCart size={18} /> Browse catalog
            </a>
            <button className="secondary-button" type="button" onClick={onOpenQuote}>
              <FileText size={18} /> Start order
            </button>
          </div>
        </div>

        <aside className="account-auth" aria-label="Customer login">
          {!settings.loginEnabled ? (
            <div className="account-auth__state">
              <Mail size={18} />
              <div>
                <strong>Email login is disabled</strong>
                <span>Contact {settings.salesEmail} for account history.</span>
              </div>
            </div>
          ) : isAuthenticated ? (
            <>
              <div className="account-auth__state">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Signed in</strong>
                  <span>{account?.email || email}</span>
                </div>
              </div>
              <button className="secondary-button" onClick={onRefreshAccount} disabled={isLoading}>
                <RefreshCcw size={18} /> Refresh
              </button>
              <button className="secondary-button" onClick={onLogout}>
                <LogOut size={18} /> Sign out
              </button>
            </>
          ) : (
            <>
              <label className="field">
                <Mail size={18} />
                <input
                  placeholder="Buyer email"
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                />
              </label>
              <button className="quote-button" onClick={onStartLogin} disabled={isLoading}>
                {isLoading ? "Sending..." : "Send login code"}
              </button>
              <label className="field">
                <ShieldCheck size={18} />
                <input
                  placeholder="6-digit code"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => onCodeChange(event.target.value)}
                />
              </label>
              <button className="secondary-button" onClick={onVerifyLogin} disabled={isLoading}>
                Verify and open account
              </button>
              {devCode ? <p className="account-dev-code">Dev login code: {devCode}</p> : null}
            </>
          )}
          {status ? <p className="quote-panel__status">{status}</p> : null}
        </aside>
      </div>

      {isAuthenticated ? <div className="account-summary">
        <article>
          <span>Customer</span>
          <strong>{account?.profile?.customerName || account?.email || email || "Not signed in"}</strong>
          <small>{profile?.group || "Email login"}</small>
        </article>
        <article>
          <span>Website quotes</span>
          <strong>{quotesVisible ? accountQuotes.length : "Off"}</strong>
          <small>{quotesVisible && latestQuote ? `Latest ${shortDate(latestQuote.creation || latestQuote.transactionDate)}` : "No records"}</small>
        </article>
        <article>
          <span>Orders</span>
          <strong>{ordersVisible ? orders.length : "Off"}</strong>
          <small>{ordersVisible && latestOrder ? `Latest ${shortDate(latestOrder.creation || latestOrder.transactionDate)}` : "No records"}</small>
        </article>
        <article>
          <span>Invoices</span>
          <strong>{ordersVisible ? invoices.length : "Off"}</strong>
          <small>{ordersVisible && latestInvoice ? `Latest ${shortDate(latestInvoice.creation || latestInvoice.postingDate)}` : "No records"}</small>
        </article>
      </div> : null}

      {isAuthenticated ? <div className="account-content">
        {isAuthenticated ? (
          <section className="account-panel account-panel--profile">
            <div className="account-panel__head">
              <div>
                <span>Customer account</span>
                <h3>Company profile</h3>
              </div>
              <UserRound size={22} />
            </div>
            <div className="account-profile">
              <article>
                <Building2 size={18} />
                <div>
                  <span>Customer</span>
                  <strong>{profile?.customerName || account?.email}</strong>
                </div>
              </article>
              <article>
                <Mail size={18} />
                <div>
                  <span>Email</span>
                  <strong>{profile?.email || account?.email}</strong>
                </div>
              </article>
              <article>
                <MapPin size={18} />
                <div>
                  <span>Territory</span>
                  <strong>{profile?.territory || "Not set"}</strong>
                </div>
              </article>
            </div>
          </section>
        ) : null}

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
              <span>Quotations</span>
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
              <span>Invoices</span>
              <h3>Invoices</h3>
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
              <span>Orders</span>
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

        {detail ? (
          <section className="account-panel account-panel--wide account-detail">
            <div className="account-panel__head">
              <div>
                <span>{detail.type === "quote" ? "Quotation details" : detail.type === "invoice" ? "Invoice details" : "Sales order details"}</span>
                <h3>{detail.name}</h3>
              </div>
              <button className="secondary-button" type="button" onClick={onCloseDetail}>
                Close
              </button>
            </div>
            <div className="account-detail__meta">
              <article>
                <span>Status</span>
                <strong>{customerStatus(detail.type, detail.status, {
                  perDelivered: detail.type === "order" ? detail.perDelivered : undefined,
                  perBilled: detail.type === "order" ? detail.perBilled : undefined,
                  outstandingAmount: detail.type === "invoice" ? detail.outstandingAmount : undefined
                }).label}</strong>
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
              <a className="secondary-button" href={`mailto:${settings.salesEmail}?subject=${encodeURIComponent(`Update request for ${detail.name}`)}`}>
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
          </section>
        ) : null}

      </div> : null}
    </section>
  );
}
