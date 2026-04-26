import { CheckCircle2, History, LogOut, Mail, PackageCheck, RefreshCcw, ShieldCheck } from "lucide-react";
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
};

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  onLogout
}: AccountPageProps) {
  const accountQuotes = account?.quotes || quotes;
  const orders = account?.orders || [];

  return (
    <section className="shell section account-page">
      <div className="account-shell">
        <div className="account-hero">
          <span className="eyebrow">
            <ShieldCheck size={16} /> Customer corner
          </span>
          <h2>Account access for trade buyers.</h2>
          <p>Sign in by email to see website quotations and ERP purchase history connected to the same customer record.</p>
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
        </article>
        <article>
          <span>Website quotes</span>
          <strong>{accountQuotes.length}</strong>
        </article>
        <article>
          <span>Purchase orders</span>
          <strong>{orders.length}</strong>
        </article>
      </div>

      <div className="account-content">
        <section className="account-panel">
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
                  </div>
                  <span>{quote.status}</span>
                  <span>{money(quote.grandTotal)} FJD</span>
                </article>
              ))
            ) : (
              <p className="empty-state">No quote history loaded.</p>
            )}
          </div>
        </section>

        <section className="account-panel">
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
                  </div>
                  <span>{order.status}</span>
                  <span>{money(order.grandTotal)} FJD</span>
                </article>
              ))
            ) : (
              <p className="empty-state">
                {isAuthenticated ? "No purchase orders found for this email." : "Sign in to load ERP purchase history."}
              </p>
            )}
          </div>
        </section>

        <section className="account-panel account-panel--wide">
          <div className="account-panel__head">
            <div>
              <span>Next customer features</span>
              <h3>Account roadmap</h3>
            </div>
            <History size={22} />
          </div>
          <div className="account-roadmap">
            <span>Download quotations and invoices</span>
            <span>Reorder from previous orders</span>
            <span>Company users and approval rules</span>
            <span>ERP credit limit and payment status</span>
          </div>
        </section>
      </div>
    </section>
  );
}
