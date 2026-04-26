import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
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
  onLoadQuotes: () => void;
  onRefreshAccount: () => void;
  onLogout: () => void;
  onOpenQuote: () => void;
  onViewQuote: (name: string) => void;
  onViewOrder: (name: string) => void;
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
  onLoadQuotes,
  onRefreshAccount,
  onLogout,
  onOpenQuote,
  onViewQuote,
  onViewOrder,
  onCloseDetail
}: AccountPageProps) {
  const accountQuotes = account?.quotes || quotes;
  const orders = account?.orders || [];
  const profile = account?.profile;
  const latestQuote = accountQuotes[0];
  const latestOrder = orders[0];
  const quotesVisible = settings.showQuoteHistory;
  const ordersVisible = settings.showPurchaseHistory;

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
              <FileText size={18} /> Start quote
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

      <div className="account-summary">
        <article>
          <span>Customer</span>
          <strong>{account?.profile?.customerName || account?.email || email || "Not signed in"}</strong>
          <small>{profile?.group || "Email login"}</small>
        </article>
        <article>
          <span>Website quotes</span>
          <strong>{quotesVisible ? accountQuotes.length : "Off"}</strong>
          <small>{quotesVisible && latestQuote ? `Latest ${shortDate(latestQuote.creation || latestQuote.transactionDate)}` : "Managed in ERP"}</small>
        </article>
        <article>
          <span>Purchase orders</span>
          <strong>{ordersVisible ? orders.length : "Off"}</strong>
          <small>{ordersVisible && latestOrder ? `Latest ${shortDate(latestOrder.creation || latestOrder.transactionDate)}` : "Managed in ERP"}</small>
        </article>
      </div>

      <div className="account-content">
        {isAuthenticated ? (
          <section className="account-panel account-panel--profile">
            <div className="account-panel__head">
              <div>
                <span>ERP customer record</span>
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

        {quotesVisible ? (
        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>ERPNext quotations</span>
              <h3>Quote history</h3>
            </div>
            {!isAuthenticated ? (
              <button className="secondary-button" onClick={onLoadQuotes} disabled={isLoading}>
                <RefreshCcw size={18} /> Lookup
              </button>
            ) : null}
          </div>

          <div className="account-quotes">
            {accountQuotes.length ? (
              accountQuotes.map((quote) => (
                <article key={quote.name}>
                  <div>
                    <strong>{quote.name}</strong>
                    <span>{quote.customer}</span>
                    <small>{quote.marker || quote.orderType || "Website quotation"}</small>
                  </div>
                  <span className={statusClass(quote.status)}>{quote.status}</span>
                  <span>Valid until {shortDate(quote.validTill)}</span>
                  <strong>{money(quote.grandTotal)} FJD</strong>
                  <button className="secondary-button" type="button" onClick={() => onViewQuote(quote.name)} disabled={!isAuthenticated || isDetailLoading}>
                    View details
                  </button>
                </article>
              ))
            ) : (
              <div className="account-empty">
                <FileText size={24} />
                <strong>No quote history loaded</strong>
                <p>{isAuthenticated ? "New website quote requests will appear here after ERPNext creates a quotation." : "Enter buyer email and use Lookup, or sign in with a login code."}</p>
                <button className="secondary-button" type="button" onClick={onOpenQuote}>
                  Start quote <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {ordersVisible ? (
        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>ERPNext sales orders</span>
              <h3>Purchase history</h3>
            </div>
            <PackageCheck size={22} />
          </div>

          <div className="account-quotes">
            {orders.length ? (
              orders.map((order) => (
                <article key={order.name}>
                  <div>
                    <strong>{order.name}</strong>
                    <span>{order.customer}</span>
                    <small>Delivery {shortDate(order.deliveryDate)}</small>
                  </div>
                  <span className={statusClass(order.status)}>{order.status}</span>
                  <span>Delivered {percent(order.perDelivered)} / Billed {percent(order.perBilled)}</span>
                  <strong>{money(order.grandTotal)} FJD</strong>
                  <button className="secondary-button" type="button" onClick={() => onViewOrder(order.name)} disabled={!isAuthenticated || isDetailLoading}>
                    View details
                  </button>
                </article>
              ))
            ) : (
              <div className="account-empty">
                <PackageCheck size={24} />
                <strong>{isAuthenticated ? "No purchase orders found" : "Purchase history is locked"}</strong>
                <p>{isAuthenticated ? "ERP sales orders for this customer email will appear here." : "Sign in to load ERP purchase history for this buyer email."}</p>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {detail ? (
          <section className="account-panel account-panel--wide account-detail">
            <div className="account-panel__head">
              <div>
                <span>{detail.type === "quote" ? "Quotation details" : "Sales order details"}</span>
                <h3>{detail.name}</h3>
              </div>
              <button className="secondary-button" type="button" onClick={onCloseDetail}>
                Close
              </button>
            </div>
            <div className="account-detail__meta">
              <article>
                <span>Status</span>
                <strong>{detail.status}</strong>
              </article>
              <article>
                <span>Customer</span>
                <strong>{detail.customer}</strong>
              </article>
              <article>
                <span>{detail.type === "quote" ? "Valid until" : "Delivery date"}</span>
                <strong>{detail.type === "quote" ? shortDate(detail.validTill) : shortDate(detail.deliveryDate)}</strong>
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
              <button className="secondary-button" type="button" disabled>
                PDF download
              </button>
              <button className="secondary-button" type="button" disabled>
                Pay now
              </button>
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
          </section>
        ) : null}

        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>How this works</span>
              <h3>Simple customer workflow</h3>
            </div>
            <History size={22} />
          </div>
          <div className="account-roadmap">
            <span><ShoppingCart size={18} /> Select products in catalog</span>
            <span><FileText size={18} /> Send quote request to ERPNext</span>
            <span><Clock3 size={18} /> Sales confirms stock and lead time</span>
            <span><PackageCheck size={18} /> {settings.paymentNote}</span>
          </div>
        </section>
      </div>
    </section>
  );
}
