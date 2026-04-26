export type CatalogProduct = {
  sku: string;
  name: string;
  category: string;
  price: number | string;
  priceMode?: string;
  stockDisplay?: string;
  currency?: string;
  status?: string;
  availability?: string;
  quantity?: number;
  uom?: string;
  image?: string | null;
  description?: string;
};

export type CatalogSuggestion = {
  id: string;
  type: "product" | "item_group" | "department";
  label: string;
  detail?: string;
  sku?: string;
  category?: string;
  departmentId?: string;
  image?: string | null;
};

export type QuoteLine = CatalogProduct & {
  qty: number;
};

export type ItemGroup = {
  name: string;
  parent: string | null;
  isGroup: boolean;
  itemCount: number;
  showOnStorefront?: boolean;
  sortOrder?: number;
  priceMode?: string;
  priceList?: string;
  stockDisplay?: string;
  showProductsWithoutImages?: boolean;
  showProductsWithoutPrice?: boolean;
  categoryNote?: string;
};

export type WebsiteCategory = {
  id: string;
  label: string;
  description: string;
  itemGroups: string[];
  featured?: boolean;
};

export type WebsiteBanner = {
  id: string;
  label: string;
  title: string;
  copy: string;
  image: string;
  href: string;
  openInNewTab?: boolean;
};

export type WebsiteCatalogDownload = {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  coverImage?: string;
  sourceLabel?: string;
};

export type WebsiteManufacturer = {
  id: string;
  name: string;
  logo: string;
  url?: string;
};

export type CustomerCornerSettings = {
  enabled: boolean;
  loginEnabled: boolean;
  showQuoteHistory: boolean;
  showPurchaseHistory: boolean;
  title: string;
  introCopy: string;
  salesEmail: string;
  salesPhone: string;
  paymentNote: string;
};

export type CatalogDiagnostics = {
  priceList?: string;
  storefrontRules?: StorefrontRules;
  totals: {
    total_items: number;
    enabled_items: string | number;
    without_image: string | number;
    weak_group: string | number;
    without_selling_price: string | number;
  };
  topGroups: Array<{ item_group: string; item_count: number }>;
};

export type StorefrontRules = {
  excludedGroups: string[];
  excludedWarehouses: string[];
  defaultCurrency: string;
};

export type CatalogFacets = {
  itemGroups: ItemGroup[];
  rules: StorefrontRules;
  topGroups: Array<{ item_group: string; item_count: number }>;
};

export type RecentQuote = {
  name: string;
  owner?: string;
  customer: string;
  transactionDate?: string;
  validTill?: string;
  grandTotal: number;
  status: string;
  orderType?: string;
  creation?: string;
  marker: string;
};

export type CustomerOrder = {
  name: string;
  customer: string;
  transactionDate?: string;
  deliveryDate?: string;
  grandTotal: number;
  status: string;
  perDelivered?: number;
  perBilled?: number;
  creation?: string;
};

export type AccountDocumentLine = {
  itemCode: string;
  itemName: string;
  description?: string;
  qty: number;
  uom?: string;
  rate: number;
  amount: number;
  image?: string | null;
  deliveryDate?: string;
  deliveredQty?: number;
  billedAmount?: number;
};

export type AccountQuoteDetail = RecentQuote & {
  type: "quote";
  validTill?: string;
  contactEmail?: string;
  contactMobile?: string;
  notes?: string;
  terms?: string;
  lines: AccountDocumentLine[];
};

export type AccountOrderDetail = CustomerOrder & {
  type: "order";
  billingStatus?: string;
  deliveryStatus?: string;
  contactEmail?: string;
  contactPhone?: string;
  poNo?: string;
  poDate?: string;
  terms?: string;
  lines: AccountDocumentLine[];
};

export type AccountDocumentDetail = AccountQuoteDetail | AccountOrderDetail;

export type CustomerProfile = {
  name: string;
  customerName: string;
  email: string;
  phone: string;
  group: string;
  territory: string;
};

export type AccountSession = {
  email: string;
  profile: CustomerProfile | null;
  quotes: RecentQuote[];
  orders: CustomerOrder[];
};

export type AccountLoginStartResponse = {
  ok: boolean;
  email?: string;
  expiresInSeconds?: number;
  delivery?: string;
  devCode?: string;
  error?: string;
};

export type AccountLoginVerifyResponse = {
  ok: boolean;
  token?: string;
  email?: string;
  expiresAt?: string;
  error?: string;
};

export type CatalogProductsResponse = {
  page: number;
  pageSize: number;
  total: number;
  priceList: string;
  categoryRule?: ItemGroup;
  products: CatalogProduct[];
};

export type QuoteRequestPayload = {
  id?: string;
  customer: {
    company?: string;
    contact?: string;
    email?: string;
    phone?: string;
  };
  lines: Array<{ sku: string; qty: number }>;
  notes?: string;
};

export type QuoteRequestResponse = {
  mode?: string;
  id?: string;
  nextAction?: string;
  error?: string;
  quotation?: string | {
    name: string;
    owner?: string;
    customer?: string;
    grand_total?: number;
  };
  validLines?: Array<{ item_code: string; qty: number; rate?: number; uom?: string }>;
  missing?: Array<{ sku: string; qty?: number; reason?: string }>;
};

export type QuoteResult = {
  name: string;
  id?: string;
  missingCount: number;
  missingSkus?: string[];
  validLineCount?: number;
  customerEmail?: string;
  reused?: boolean;
  dryRun?: boolean;
};
