import { Mail, RefreshCcw } from "lucide-react";
import type { RecentQuote } from "../types";

type AccountPageProps = {
  email: string;
  quotes: RecentQuote[];
  status: string;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onLoadQuotes: () => void;
};

export function AccountPage({ email, quotes, status, isLoading, onEmailChange, onLoadQuotes }: AccountPageProps) {
  return (
    <section className="shell section account-page">
      <div className="section-heading">
        <div>
          <h2>Quote history</h2>
          <p>Lookup website-created ERPNext quotations by buyer email.</p>
        </div>
      </div>

      <div className="account-lookup">
        <label className="field">
          <Mail size={18} />
          <input
            placeholder="Buyer email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <button className="quote-button" onClick={onLoadQuotes} disabled={isLoading}>
          <RefreshCcw size={18} /> {isLoading ? "Loading..." : "Load quotes"}
        </button>
      </div>

      {status ? <p className="quote-panel__status">{status}</p> : null}

      <div className="account-quotes">
        {quotes.length ? (
          quotes.map((quote) => (
            <article key={quote.name}>
              <div>
                <strong>{quote.name}</strong>
                <span>{quote.customer}</span>
              </div>
              <span>{quote.status}</span>
              <span>{quote.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FJD</span>
            </article>
          ))
        ) : (
          <p className="empty-state">No quote history loaded.</p>
        )}
      </div>
    </section>
  );
}
