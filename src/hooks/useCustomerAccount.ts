import { useEffect, useState } from "react";
import {
  fetchAccountInvoiceDetail,
  fetchAccountOrderDetail,
  fetchAccountQuoteDetail,
  fetchAccountSession,
  loginAccount,
  logoutAccount
} from "../lib/api";
import type { AccountDocumentDetail, AccountSession, RecentQuote } from "../types";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function useCustomerAccount(isAccountRoute: boolean) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [quotes, setQuotes] = useState<RecentQuote[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [detail, setDetail] = useState<AccountDocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    if (!isAccountRoute) return;

    let ignore = false;
    setIsLoading(true);
    fetchAccountSession()
      .then((account) => {
        if (ignore) return;
        setSession(account);
        setEmail(account.email);
        setQuotes(account.quotes || []);
        setStatus("");
      })
      .catch(() => {
        if (!ignore) setSession(null);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isAccountRoute]);

  async function login() {
    if (!isValidEmail(email)) {
      setStatus("Enter a valid buyer email.");
      return;
    }
    if (!password) {
      setStatus("Enter your password.");
      return;
    }

    setIsLoading(true);
    setStatus("Signing in...");
    try {
      const result = await loginAccount(email, password);
      if (!result.ok) {
        setStatus("Incorrect email or password.");
        return;
      }
      const account = await fetchAccountSession();
      setSession(account);
      setEmail(account.email);
      setQuotes(account.quotes || []);
      setPassword("");
      setStatus("Signed in.");
    } catch {
      setStatus("Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function refresh() {
    if (!session) return;
    setIsLoading(true);
    fetchAccountSession()
      .then((account) => {
        setSession(account);
        setQuotes(account.quotes || []);
        setStatus("Account refreshed.");
      })
      .catch(() => setStatus("Account data could not be loaded."))
      .finally(() => setIsLoading(false));
  }

  async function loadDetail(
    name: string,
    kind: "quotation" | "order" | "invoice",
    loader: (documentName: string) => Promise<AccountDocumentDetail>
  ) {
    if (!session) {
      setStatus(`Sign in to view ${kind} details.`);
      return;
    }

    setIsDetailLoading(true);
    setStatus(`Loading ${kind} details...`);
    try {
      setDetail(await loader(name));
      setStatus("");
    } catch {
      setStatus(`${kind.charAt(0).toUpperCase()}${kind.slice(1)} details could not be loaded.`);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function logout() {
    await logoutAccount().catch(() => undefined);
    setSession(null);
    setQuotes([]);
    setDetail(null);
    setPassword("");
    setStatus("Signed out.");
  }

  return {
    email,
    password,
    session,
    quotes,
    status,
    isLoading,
    detail,
    isDetailLoading,
    setEmail,
    setPassword,
    login,
    refresh,
    logout,
    viewQuote: (name: string) => loadDetail(name, "quotation", fetchAccountQuoteDetail),
    viewOrder: (name: string) => loadDetail(name, "order", fetchAccountOrderDetail),
    viewInvoice: (name: string) => loadDetail(name, "invoice", fetchAccountInvoiceDetail),
    closeDetail: () => setDetail(null)
  };
}
