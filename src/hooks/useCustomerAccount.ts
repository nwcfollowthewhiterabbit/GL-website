import { useEffect, useRef, useState } from "react";
import {
  accountAction,
  fetchAccountConfig,
  fetchAccountHistory,
  fetchAccountInvoiceDetail,
  fetchAccountOrderDetail,
  fetchAccountQuoteDetail,
  fetchAccountSession,
  loginAccount,
  logoutAccount
} from "../lib/api";
import type { AccountAuthMode, AccountConfig, AccountDocumentDetail, AccountHistoryKind, AccountSession } from "../types";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function captureAccountLink() {
  if (typeof window === "undefined") return { mode: "login" as AccountAuthMode, token: "" };
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const register = fragment.get("register");
  const reset = fragment.get("reset");
  if (register || reset) {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    return { mode: (register ? "register-complete" : "reset-complete") as AccountAuthMode, token: register || reset || "" };
  }
  return { mode: "login" as AccountAuthMode, token: "" };
}

const actionErrors: Record<string, string> = {
  invalid_or_expired_token: "This link has expired or has already been used. Request a new email below.",
  invalid_email: "Enter a valid email address.",
  password_length_invalid: "Use a password between 10 and 128 characters.",
  customer_details_required: "Enter your company, contact name and phone number.",
  account_already_exists: "This account already exists. Sign in or reset your password below.",
  customer_access_unavailable: "Please contact Green Leaf sales to arrange access to this account.",
  self_service_unavailable: "Account registration and password recovery are temporarily unavailable. Please contact Green Leaf sales.",
  account_service_unavailable: "We could not complete this request. Please try again shortly.",
  too_many_requests: "Too many attempts. Please wait a few minutes before trying again."
};

export function useCustomerAccount(isAccountRoute: boolean) {
  const [link] = useState(captureAccountLink);
  const tokenRef = useRef(link.token);
  const [authMode, setAuthMode] = useState<AccountAuthMode>(link.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [config, setConfig] = useState<AccountConfig | null>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [detail, setDetail] = useState<AccountDocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState<AccountHistoryKind | null>(null);
  const [historyMore, setHistoryMore] = useState({ quotes: false, orders: false, invoices: false });
  const historyOffsets = useRef({ quotes: 0, orders: 0, invoices: 0 });
  const requestGeneration = useRef(0);
  const accountIdentity = useRef("");

  function applySession(account: AccountSession) {
    if (accountIdentity.current !== account.email) { requestGeneration.current += 1; setDetail(null); }
    accountIdentity.current = account.email;
    setSession(account);
    setEmail(account.email);
    setHistoryMore({ quotes: account.quotes.length >= 20, orders: account.orders.length >= 20, invoices: account.invoices.length >= 20 });
    historyOffsets.current = { quotes: account.quotes.length, orders: account.orders.length, invoices: account.invoices.length };
  }

  useEffect(() => {
    fetchAccountConfig().then(setConfig).catch(() => {
      setConfig({ loginEnabled: false, registrationEnabled: false, passwordResetEnabled: false });
    });
  }, []);

  useEffect(() => {
    function receiveAccountLink() {
      const incoming = captureAccountLink();
      if (!incoming.token) return;
      tokenRef.current = incoming.token;
      setAuthMode(incoming.mode);
      setPassword("");
      setConfirmPassword("");
      setStatus("");
    }
    window.addEventListener("hashchange", receiveAccountLink);
    return () => window.removeEventListener("hashchange", receiveAccountLink);
  }, []);

  useEffect(() => {
    let ignore = false;
    const generation = requestGeneration.current;
    setIsLoading(true);
    fetchAccountSession()
      .then((account) => {
        if (!ignore && generation === requestGeneration.current) applySession(account);
      })
      .catch(() => {
        if (!ignore && generation === requestGeneration.current) setSession(null);
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
          setSessionReady(true);
        }
      });
    return () => { ignore = true; };
  }, [isAccountRoute]);

  function changeAuthMode(mode: AccountAuthMode) {
    setAuthMode(mode);
    setPassword("");
    setConfirmPassword("");
    setStatus("");
    if (mode === "login" || mode === "register" || mode === "reset") tokenRef.current = "";
  }

  async function login() {
    if (isLoading) return;
    if (!isValidEmail(email)) { setStatus("Enter a valid customer email."); return; }
    if (!password) { setStatus("Enter your password."); return; }
    setIsLoading(true);
    setStatus("Signing in...");
    try {
      const result = await loginAccount(email, password);
      if (!result.ok) { setStatus("Incorrect email or password."); return; }
      requestGeneration.current += 1;
      const generation = requestGeneration.current;
      const account = await fetchAccountSession();
      if (generation !== requestGeneration.current) return;
      applySession(account);
      setPassword("");
      setStatus("Signed in. Your basket is ready when you are.");
    } catch {
      setStatus("Sign-in could not be completed. Please try again.");
    } finally { setIsLoading(false); }
  }

  async function submitAuth() {
    if (authMode === "login") return login();
    if (isLoading) return;
    const completing = authMode.endsWith("complete");
    if (!completing && !isValidEmail(email)) { setStatus("Enter a valid email address."); return; }
    if (completing && (password.length < 10 || password.length > 128)) { setStatus(actionErrors.password_length_invalid); return; }
    if (completing && password !== confirmPassword) { setStatus("The passwords do not match."); return; }
    if (authMode === "register-complete" && (!company.trim() || !contact.trim() || !phone.trim())) {
      setStatus(actionErrors.customer_details_required); return;
    }
    const route = authMode.startsWith("register") ? "register" : "password-reset";
    setIsLoading(true);
    setStatus("");
    try {
      const result = await accountAction(`${route}/${completing ? "complete" : "request"}`, completing
        ? { token: tokenRef.current, password, company: company.trim(), contact: contact.trim(), phone: phone.trim() }
        : { email: email.trim() });
      if (!result.ok) { setStatus(actionErrors[result.error || ""] || "We could not complete this request. Please try again."); return; }
      if (!completing) {
        setStatus(authMode === "register"
          ? "Check your inbox for the next step. If this email can be registered, we have sent a verification link. Already registered? Sign in or reset your password."
          : "If an active account matches this email, we have sent a password reset link. Check your inbox and spam folder.");
      } else if (authMode === "register-complete") {
        tokenRef.current = "";
        setPassword("");
        setConfirmPassword("");
        setAuthMode("login");
        if (result.email) setEmail(result.email);
        try {
          requestGeneration.current += 1;
          const generation = requestGeneration.current;
          const account = await fetchAccountSession();
          if (generation !== requestGeneration.current) return;
          applySession(account);
          setStatus("Account created. You can now send your basket for a quote.");
        } catch { setStatus("Account created. Sign in with your email and new password."); }
      } else {
        tokenRef.current = "";
        setPassword("");
        setConfirmPassword("");
        requestGeneration.current += 1;
        accountIdentity.current = "";
        setSession(null);
        setDetail(null);
        setAuthMode("login");
        setStatus("Password updated. Sign in with your new password.");
      }
    } catch { setStatus("We could not reach the account service. Please try again."); }
    finally { setIsLoading(false); }
  }

  async function refresh() {
    if (!session || isLoading) return;
    setIsLoading(true);
    const generation = requestGeneration.current;
    try {
      const account = await fetchAccountSession();
      if (generation !== requestGeneration.current) return;
      applySession(account);
      setStatus("Account refreshed.");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      if ((error as { status?: number }).status === 401) { requestGeneration.current += 1; accountIdentity.current = ""; setSession(null); setDetail(null); setStatus("Your session has expired. Sign in again to continue."); }
      else setStatus("Account data could not be loaded. Please try again.");
    }
    finally { setIsLoading(false); }
  }

  async function loadMore(kind: AccountHistoryKind) {
    if (!session || historyLoading || !historyMore[kind]) return;
    setHistoryLoading(kind);
    const generation = requestGeneration.current;
    try {
      const page = await fetchAccountHistory(kind, historyOffsets.current[kind]);
      if (generation !== requestGeneration.current) return;
      const records = page[kind] || [];
      setSession((current) => {
        if (!current) return current;
        const combined = [...current[kind], ...records];
        return { ...current, [kind]: combined.filter((record, index) => combined.findIndex((other) => other.name === record.name) === index) };
      });
      setHistoryMore((current) => ({ ...current, [kind]: Boolean(page.hasMore) }));
      historyOffsets.current[kind] = page.nextOffset ?? historyOffsets.current[kind] + records.length;
    } catch { setStatus("Older records could not be loaded. Please try again."); }
    finally { setHistoryLoading(null); }
  }

  async function loadDetail(name: string, kind: string, loader: (name: string) => Promise<AccountDocumentDetail>) {
    if (!session) { setStatus(`Sign in to view ${kind} details.`); return; }
    const generation = requestGeneration.current;
    setIsDetailLoading(true);
    setDetail(null);
    setStatus(`Loading ${kind} details...`);
    try {
      const result = await loader(name);
      if (generation !== requestGeneration.current) return;
      setDetail(result);
      setStatus("");
    } catch { setStatus(`${kind} details could not be loaded.`); }
    finally { setIsDetailLoading(false); }
  }

  useEffect(() => {
    function syncLogout(event: StorageEvent) {
      if (event.key === "greenleaf.signedOut") window.location.reload();
    }
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, []);

  async function logout() {
    requestGeneration.current += 1;
    try { await logoutAccount(); }
    catch { setStatus("Sign-out failed. Please try again."); return; }
    accountIdentity.current = "";
    try { window.localStorage.setItem("greenleaf.signedOut", String(Date.now())); } catch { /* Optional cross-tab notification. */ }
    tokenRef.current = "";
    setEmail("");
    setConfirmPassword("");
    setContact("");
    setCompany("");
    setPhone("");
    setAuthMode("login");
    setSession(null);
    setDetail(null);
    setIsLoading(false);
    setIsDetailLoading(false);
    setHistoryLoading(null);
    setPassword("");
    setStatus("Signed out.");
  }

  return {
    email, password, confirmPassword, company, contact, phone, session, config,
    quotes: session?.quotes || [], status, isLoading, sessionReady, authMode,
    detail, isDetailLoading, historyLoading, historyMore,
    setEmail, setPassword, setConfirmPassword, setCompany, setContact, setPhone,
    changeAuthMode, submitAuth, login, refresh, logout, loadMore,
    viewQuote: (name: string) => loadDetail(name, "Quotation", fetchAccountQuoteDetail),
    viewOrder: (name: string) => loadDetail(name, "Order", fetchAccountOrderDetail),
    viewInvoice: (name: string) => loadDetail(name, "Invoice", fetchAccountInvoiceDetail),
    closeDetail: () => setDetail(null)
  };
}
