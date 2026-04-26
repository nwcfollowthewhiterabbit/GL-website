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
import type { AccountSession, RecentQuote } from "../types";

type AccountPageProps = {
  email: string;
  code: string;
  quotes: RecentQuote[];
  account: AccountSession | null;
  status: string;
  devCode: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onStartLogin: () => void;
  onVerifyLogin: () => void;
  onLoadQuotes: () => void;
  onRefreshAccount: () => void;
  onLogout: () => void;
  onOpenQuote: () => void;
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

export function AccountPage({
  email,
  code,
  quotes,
  account,
  status,
  devCode,
  isLoading,
  isAuthenticated,
  onEmailChange,
  onCodeChange,
  onStartLogin,
  onVerifyLogin,
  onLoadQuotes,
  onRefreshAccount,
  onLogout,
  onOpenQuote
}: AccountPageProps) {
  const accountQuotes = account?.quotes || quotes;
  const orders = account?.orders || [];
  const profile = account?.profile;
  const latestQuote = accountQuotes[0];
  const latestOrder = orders[0];

  return (
    <section className="shell section account-page">
      <div className="account-shell">
        <div className="account-hero">
          <span className="eyebrow">
            <ShieldCheck size={16} /> Customer corner
          </span>
          <h2>Customer account for trade buyers.</h2>
          <p>Use one email login to track website quotations, ERP purchase history and the next action from Green Leaf sales.</p>
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
          {isAuthenticated ? (
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
          <strong>{accountQuotes.length}</strong>
          <small>{latestQuote ? `Latest ${shortDate(latestQuote.creation || latestQuote.transactionDate)}` : "No quotes loaded"}</small>
        </article>
        <article>
          <span>Purchase orders</span>
          <strong>{orders.length}</strong>
          <small>{latestOrder ? `Latest ${shortDate(latestOrder.creation || latestOrder.transactionDate)}` : "No orders loaded"}</small>
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
                    <small>{quote.marker || shortDate(quote.creation || quote.transactionDate)}</small>
                  </div>
                  <span className={statusClass(quote.status)}>{quote.status}</span>
                  <span>{shortDate(quote.creation || quote.transactionDate)}</span>
                  <strong>{money(quote.grandTotal)} FJD</strong>
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
                    <small>{shortDate(order.creation || order.transactionDate)}</small>
                  </div>
                  <span className={statusClass(order.status)}>{order.status}</span>
                  <span>{shortDate(order.creation || order.transactionDate)}</span>
                  <strong>{money(order.grandTotal)} FJD</strong>
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
            <span><PackageCheck size={18} /> Orders appear after approval</span>
          </div>
        </section>
      </div>
    </section>
  );
}
