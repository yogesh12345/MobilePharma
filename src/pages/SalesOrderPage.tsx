import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import FloatingLabelDecimalInput from "../components/FloatingLabelDecimalInput";
import FloatingLabelInput from "../components/FloatingLabelInput";
import { sendMedia, sendText } from "../services/whatsappService";

type Customer = {
  id: number;
  CustomerName: string;
  AddressLine1: string;
  AddressLine2: string;
  AddressLine3: string;
  LastOrderDate: string;
  LastOrderTime: string;
  NumItems: number;
  Status: string;
  Active?: boolean | number | string;
  IsActive?: boolean | number | string;
  CustomerActive?: boolean | number | string;
  MobileNo?: string;
  WhatsappNo?: string;
  EmailID?: string;
  GstNo?: string;
};

type ItemInfo = {
  id: number;
  ItemName: string;
  Packing: string;
  CompanyID: number;
  CompShort: string;
  HSNCode: string;
  Location: string;
  RackNumber: string;
  MRP: number;
  RetRate: number;
  GSTPercent: number;
  Scheme: string;
  SchmQty: number;
  SchmFree: number;
  StockQty1: number;
  StockQty2: number;
  StockAvailable: boolean;
  StockStatus?: string;
  AsOnDate?: string;
};

type CompanyRow = {
  id: number;
  CompName: string;
  CompShort: string;
  ItemCount: number;
};

type CartItem = ItemInfo & {
  uid: string;
  rowId?: number;
  Qty1: number;
  Qty2: number;
  pending: boolean;
};

type SalesOrderShareFormat = "pdf" | "image" | "text";

type OrderListRow = {
  ID: number;
  SONumber: string;
  SODate: string;
  CustId: number;
  CustomerName: string;
  AddressLine1: string;
  AddressLine2: string;
  AddressLine3: string;
  CityDistrict?: string;
  AddressState?: string;
  NumItems: number;
  Status: string;
};

type LoadedOrder = {
  header: any;
  rows: CartItem[];
  customer: Customer;
};

const orderStatuses = ["Saved", "Submitted", "Cancelled", "Invoiced", "Delivered"];
const ITEM_SEARCH_MIN_CHARS = 3;

const buttonBase =
  "rounded-md px-3 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

type ActionIconName = "save" | "submit" | "cancel" | "new" | "print" | "back" | "remove";

const actionIconPaths: Record<ActionIconName, ReactNode> = {
  save: <path d="M5 4h12l2 2v14H5zM8 4v5h8V4M8 20v-6h8v6" />,
  submit: <path d="m5 12 4 4L19 6" />,
  cancel: <path d="m7 7 10 10M17 7 7 17" />,
  new: <path d="M12 5v14M5 12h14" />,
  print: <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M7 14h10v6H7z" />,
  back: <path d="m15 6-6 6 6 6M9 12h10" />,
  remove: <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5M14 11v5" />,
};

const ActionIcon = ({ name }: { name: ActionIconName }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {actionIconPaths[name]}
  </svg>
);

const BottomActionButton = ({
  label,
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ActionIconName;
}) => (
  <button
    {...props}
    aria-label={props["aria-label"] || label}
    title={label}
    className={`${buttonBase} inline-flex h-10 w-10 items-center justify-center p-2 text-xs ${className}`}
  >
    <ActionIcon name={icon} />
    <span className="sr-only">{label}</span>
  </button>
);

const FloatingPrintButton = ({
  disabled,
  format,
  onFormatChange,
  onPrint,
}: {
  disabled?: boolean;
  format: SalesOrderShareFormat;
  onFormatChange: (format: SalesOrderShareFormat) => void;
  onPrint: (format?: SalesOrderShareFormat) => void;
}) => {
  const [open, setOpen] = useState(false);
  const options: Array<{ value: SalesOrderShareFormat; label: string }> = [
    { value: "pdf", label: "WhatsApp PDF" },
    { value: "image", label: "WhatsApp Image" },
    { value: "text", label: "WhatsApp Text" },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                onFormatChange(option.value);
                setOpen(false);
                onPrint(option.value);
              }}
              className={`block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-blue-50 disabled:opacity-50 ${
                format === option.value ? "text-blue-700" : "text-slate-700"
              }`}
              role="menuitem"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Print and send order on WhatsApp"
        aria-expanded={open}
      >
        <ActionIcon name="print" />
      </button>
    </div>
  );
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const todayISODate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const timezoneOffset = () => {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
};

const toApiDateTime = (date?: string) => {
  const value = String(date || todayISODate()).trim();
  if (value.includes("T")) return value;
  return `${value}T00:00:00${timezoneOffset()}`;
};

const displayDateTime = (date?: string, time?: string) => {
  if (!date) return "-";
  const [year, month, day] = String(date).split("T")[0].split("-");
  const formatted = day && month && year ? `${day}/${month}/${year}` : date;
  return time ? `${formatted} ${time}` : formatted;
};

const incrementTrailingNumber = (value?: string) => {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)(\d+)$/);
  if (!match) return "";
  const [, prefix, digits] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${prefix}${next}`;
};

const statusForMobile = (status?: string) => {
  const upper = String(status || "").toUpperCase();
  if (upper === "SAVED") return "Saved";
  if (upper === "PARTIAL" || upper === "PENDING" || upper === "OPEN-PENDING") return "Saved";
  if (upper === "CANCELLED" || upper === "CANCELED") return "Cancelled";
  if (upper === "INVOICED") return "Invoiced";
  if (upper === "DELIVERED") return "Delivered";
  if (upper === "OPEN" || upper === "CLOSED" || upper === "SUBMITTED") {
    return "Submitted";
  }
  return status || "-";
};

const normalizedStatus = (status?: string) => String(status || "").trim().toUpperCase();

const canEditSOStatus = (status?: string) => {
  const normalized = normalizedStatus(status);
  return normalized !== "SUBMITTED" && normalized !== "CANCELLED" && normalized !== "CANCELED";
};

const addressOf = (row: Partial<Customer & OrderListRow>) =>
  [
    row.AddressLine1,
    row.AddressLine2,
    row.AddressLine3,
    "CityDistrict" in row ? row.CityDistrict : "",
    "AddressState" in row ? row.AddressState : "",
  ]
    .filter((value) => String(value || "").trim())
    .join(", ");

const newUid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const customerGstNo = (row: Partial<Customer>) => String(row.GstNo ?? "");

const normalizeCustomer = (row: Customer): Customer => ({
  ...row,
  GstNo: customerGstNo(row).trim(),
});

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const salesOrderShareMessage = [
  "Dear Sir/Madam,",
  "",
  "Your Order has been accepted. Please see the attachment.",
  "",
  "Thanks for your business.",
  "",
  "Meena Agencies",
].join("\n");

const salesOrderText = (
  orderNumber: string,
  orderDate: string,
  status: string,
  items: CartItem[],
) => [
  "Dear Sir/Madam,",
  "",
  "Your order has been accepted as follows:",
  "",
  `🧾 SO No.: ${orderNumber}`,
  `📅 Date: ${displayDateTime(orderDate)}`,
  `📌 Status: ${status}`,
  "",
  "Items:",
  ...items.map(
    (item, index) =>
      `${index + 1}. ${item.ItemName} – ${item.Packing || "-"} × ${Number(item.Qty1 || 0) + Number(item.Qty2 || 0)}`,
  ),
  "",
  "Thank you for your business. 🙏",
  "",
  "*Meena Agencies*",
  "",
  `Order Value: ₹${money(items.reduce((total, item) => total + Number(item.Qty1 || 0) * Number(item.RetRate || 0), 0))}`,
].join("\n");

const isExplicitlyInactive = (value: unknown) => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value === 0;
  const normalized = String(value).trim().toLowerCase();
  return ["0", "false", "inactive", "in active", "disabled", "no", "n"].includes(normalized);
};

const selectableMappedCustomers = (rows: Customer[]) =>
  rows.filter(
    (customer) =>
      String(customer.CustomerName || "").trim().length > 0 &&
      !isExplicitlyInactive(customer.IsActive) &&
      !isExplicitlyInactive(customer.Active) &&
      !isExplicitlyInactive(customer.CustomerActive),
  );

const cartSignature = (rows: CartItem[]) =>
  JSON.stringify(
    rows.map((row) => ({
      rowId: row.rowId || 0,
      itemId: row.id || 0,
      qty1: Number(row.Qty1 || 0),
      qty2: Number(row.Qty2 || 0),
    })),
  );

const distinctCartItems = (items: CartItem[]) => {
  const byItem = new Map<number, CartItem>();
  items.forEach((item) => {
    const current = byItem.get(item.id);
    if (!current) {
      byItem.set(item.id, { ...item });
      return;
    }
    current.Qty1 += item.Qty1;
    current.Qty2 += item.Qty2;
    current.pending = current.pending || item.pending;
  });
  return Array.from(byItem.values());
};

const CartCountIcon = ({ count, compact = false }: { count: number; compact?: boolean }) => (
  <div
    className={
      compact
        ? "inline-flex items-center gap-1 text-blue-800"
        : "grid min-h-12 min-w-12 place-items-center rounded-full text-blue-800"
    }
  >
    <svg
      viewBox="0 0 24 24"
      className={compact ? "h-5 w-5" : "h-8 w-8"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
    </svg>
    <span
      className={
        compact
          ? "text-sm font-black leading-none text-blue-900"
          : "-mt-1 text-[11px] font-black leading-none text-blue-900"
      }
    >
      {count}
    </span>
    <span className="sr-only">Cart items: {count}</span>
  </div>
);

export type CustomerUpdate = Partial<Customer> & Pick<Customer, "id">;

interface SalesOrderPageProps {
  onEditCustomer?: (customer: Customer) => void;
  customerUpdate?: CustomerUpdate | null;
  customerUpdateFocusRequestKey?: number;
}

export default function SalesOrderPage({
  onEditCustomer,
  customerUpdate,
  customerUpdateFocusRequestKey = 0,
}: SalesOrderPageProps) {
  const [activeTab, setActiveTab] = useState<"place" | "review">("place");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<LoadedOrder | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadedCartSignature, setLoadedCartSignature] = useState("");
  const [cartSearch, setCartSearch] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemInfo | null>(null);
  const [editingCartUid, setEditingCartUid] = useState<string | null>(null);
  const [itemSourceTab, setItemSourceTab] = useState<"search" | "companies">("search");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null);
  const [companyItems, setCompanyItems] = useState<ItemInfo[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingCompanyItems, setLoadingCompanyItems] = useState(false);
  const [reviewAddingItem, setReviewAddingItem] = useState(false);
  const [qty1, setQty1] = useState(1);
  const [qty2, setQty2] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draftSoNumber, setDraftSoNumber] = useState("New");
  const [draftSoDate, setDraftSoDate] = useState(todayISODate());
  const [newOrderSavedId, setNewOrderSavedId] = useState<number | null>(null);
  const [savedCartSignature, setSavedCartSignature] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [shareFormat, setShareFormat] = useState<SalesOrderShareFormat>(() => {
    const saved = window.localStorage.getItem("sales-order-share-format");
    return saved === "image" || saved === "text" ? saved : "pdf";
  });
  const selectedItemEditorRef = useRef<HTMLDivElement | null>(null);
  const customerSelectRef = useRef<HTMLInputElement | null>(null);
  const itemSelectRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const freeInputRef = useRef<HTMLInputElement | null>(null);

  const cartCount = cart.length;

  useEffect(() => {
    if (!customerUpdate || customerUpdateFocusRequestKey <= 0) return;
    setSelectedCustomer((current) =>
      current?.id === customerUpdate.id ? { ...current, ...customerUpdate } : current,
    );
    setSelectedOrder((current) =>
      current?.customer.id === customerUpdate.id
        ? { ...current, customer: { ...current.customer, ...customerUpdate } }
        : current,
    );
  }, [customerUpdate, customerUpdateFocusRequestKey]);

  const loadCustomers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await API.get("/mobile/sales-orders/customers");
      const rows = Array.isArray(res.data?.customers)
        ? (res.data.customers as Customer[]).map(normalizeCustomer)
        : [];
      setCustomers(selectableMappedCustomers(rows));
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDraftSoNumber = async () => {
    setDraftSoNumber("New");
    try {
      const res = await API.get("/so/list", {
        params: {
          page: 1,
          pageSize: 1,
          sortField: "SODate",
          sortOrder: "DESC",
        },
      });
      const latest = Array.isArray(res.data?.list) ? (res.data.list[0] as OrderListRow | undefined) : undefined;
      const next = incrementTrailingNumber(latest?.SONumber);
      if (next) setDraftSoNumber(next);
    } catch {
      setDraftSoNumber("New");
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [ordersRes, customersRes] = await Promise.all([
        API.get("/so/list", {
          params: {
            page: 1,
            pageSize: 100,
            mobileReview: true,
            sortField: "SODate",
            sortOrder: "DESC",
          },
        }),
        customers.length > 0
          ? Promise.resolve({ data: { customers } })
          : API.get("/mobile/sales-orders/customers"),
      ]);
      const mappedCustomers = Array.isArray(customersRes.data?.customers)
        ? (customersRes.data.customers as Customer[]).map(normalizeCustomer)
        : [];
      const activeMappedCustomers = selectableMappedCustomers(mappedCustomers);
      if (customers.length === 0) setCustomers(activeMappedCustomers);
      const rawOrders = Array.isArray(ordersRes.data?.list)
        ? (ordersRes.data.list as OrderListRow[])
        : [];
      setOrders(rawOrders);
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to load sales orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    if (activeTab === "review" && !selectedOrder) void loadOrders();
    if (activeTab === "place" && !selectedCustomer) void loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "place" || selectedCustomer || loading) return;
    const timer = window.setTimeout(() => {
      customerSelectRef.current?.focus();
      customerSelectRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loading, selectedCustomer]);

  const loadCompanies = async () => {
    if (companies.length > 0) return;
    setLoadingCompanies(true);
    try {
      const res = await API.get("/mobile/companies");
      setCompanies(Array.isArray(res.data?.companies) ? res.data.companies : []);
    } catch {
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadItemDetail = async (id: number | string) => {
    const res = await API.get(`/mobile/sales-orders/items/${id}`, {
      params: { asOnDate: todayISODate() },
    });
    return res.data?.item as ItemInfo | null;
  };

  const hydrateItemDetails = async (items: Array<{ id: number | string }>, limit = 50) => {
    const results = await Promise.all(
      items.slice(0, limit).map(async (item) => {
        try {
          return await loadItemDetail(item.id);
        } catch {
          return null;
        }
      }),
    );
    return results.filter((item): item is ItemInfo => Boolean(item));
  };

  useEffect(() => {
    if (!selectedCustomer && !selectedOrder) return;
    if (itemSourceTab === "companies") void loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSourceTab, selectedCustomer, selectedOrder]);

  useEffect(() => {
    if (!selectedItem) return;
    const keepEditorVisible = () => {
      const editor = selectedItemEditorRef.current;
      if (!editor) return;

      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        const current = selectedItemEditorRef.current;
        if (!current) return;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const topInset = 76;
        const bottomInset = 118;
        const rect = current.getBoundingClientRect();
        const delta =
          rect.top < topInset
            ? rect.top - topInset
            : rect.bottom > viewportHeight - bottomInset
              ? rect.bottom - (viewportHeight - bottomInset)
              : 0;
        if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: "smooth" });
      }, 120);
    };

    const timers = [50, 350, 750].map((delay) =>
      window.setTimeout(keepEditorVisible, delay),
    );
    const viewport = window.visualViewport;
    const handleViewportResize = () => window.setTimeout(keepEditorVisible, 80);
    viewport?.addEventListener("resize", handleViewportResize);
    keepEditorVisible();
    const focusTimer = window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(focusTimer);
      viewport?.removeEventListener("resize", handleViewportResize);
    };
  }, [selectedItem]);

  const resetEntry = () => {
    setSelectedCustomer(null);
    setSelectedOrder(null);
    setCart([]);
    setLoadedCartSignature("");
    setSavedCartSignature("");
    setCartSearch("");
    setItemQuery("");
    setSelectedItem(null);
    setEditingCartUid(null);
    setItemSourceTab("search");
    setSelectedCompany(null);
    setCompanyItems([]);
    setCompanySearch("");
    setReviewAddingItem(false);
    setQty1(1);
    setQty2(0);
    setDraftSoNumber("New");
    setDraftSoDate(todayISODate());
    setShowCart(false);
    setNewOrderSavedId(null);
    setMessage("");
  };

  const openCustomerOrder = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedOrder(null);
    setCart([]);
    setLoadedCartSignature("");
    setSavedCartSignature("");
    setCartSearch("");
    setItemQuery("");
    setSelectedItem(null);
    setEditingCartUid(null);
    setItemSourceTab("search");
    setSelectedCompany(null);
    setCompanyItems([]);
    setCompanySearch("");
    setReviewAddingItem(false);
    setQty1(1);
    setQty2(0);
    setDraftSoNumber("New");
    setDraftSoDate(todayISODate());
    setShowCart(false);
    setNewOrderSavedId(null);
    setMessage("");
    void loadDraftSoNumber();
    window.setTimeout(() => {
      itemSelectRef.current?.focus();
      itemSelectRef.current?.select();
    }, 0);
  };

  const handleFallbackCustomerSelect = (item: {
    id: number | string;
    label1: string;
    label2?: string;
    label3?: string;
    label4?: string;
    label5?: string;
  }) => {
    openCustomerOrder({
      id: Number(item.id),
      CustomerName: item.label1,
      AddressLine1: item.label2 ?? "",
      AddressLine2: item.label3 ?? "",
      AddressLine3: item.label4 ?? "",
      LastOrderDate: "",
      LastOrderTime: "",
      NumItems: 0,
      Status: "-",
    });
  };

  const handleItemSelect = async (item: { id: number | string; label1: string }) => {
    setMessage("");
    setItemQuery("");
    try {
      setSelectedItem(await loadItemDetail(item.id));
      setEditingCartUid(null);
      setShowCart(false);
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement) activeElement.blur();
      window.setTimeout(() => {
        selectedItemEditorRef.current?.scrollIntoView({ block: "nearest" });
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 0);
    } catch {
      setSelectedItem(null);
    }
  };

  const selectItemInfo = (item: ItemInfo) => {
    setSelectedItem(item);
    setEditingCartUid(null);
    setItemQuery("");
    setShowCart(false);
    setMessage("");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement) activeElement.blur();
    window.setTimeout(() => {
      selectedItemEditorRef.current?.scrollIntoView({ block: "nearest" });
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  };

  const openCompanyItems = async (company: CompanyRow) => {
    setSelectedCompany(company);
    setCompanyItems([]);
    setSelectedItem(null);
    setLoadingCompanyItems(true);
    setMessage("");
    try {
      const res = await API.get(`/mobile/sales-orders/companies/${company.id}/items`, {
        params: { asOnDate: todayISODate() },
      });
      let rows = Array.isArray(res.data?.items) ? (res.data.items as ItemInfo[]) : [];
      if (rows.length === 0) {
        const fallback = await API.get(`/mobile/companies/${company.id}/items`);
        const companyRows = Array.isArray(fallback.data?.items)
          ? (fallback.data.items as Array<{ id: number | string }>)
          : [];
        rows = await hydrateItemDetails(companyRows, 100);
      }
      setCompanyItems(rows);
    } catch (error: any) {
      try {
        const fallback = await API.get(`/mobile/companies/${company.id}/items`);
        const companyRows = Array.isArray(fallback.data?.items)
          ? (fallback.data.items as Array<{ id: number | string }>)
          : [];
        setCompanyItems(await hydrateItemDetails(companyRows, 100));
      } catch {
        setCompanyItems([]);
        setMessage(error?.response?.data?.error || "Unable to load company items.");
      }
    } finally {
      setLoadingCompanyItems(false);
    }
  };

  const registerSelectedItem = () => {
    if (selectedOrder && !canEditSOStatus(selectedOrder.header?.Status)) return;
    if (!selectedItem) {
      setMessage("Select an item first.");
      return;
    }
    const q1 = toNumber(qty1);
    const q2 = toNumber(qty2);
    if (q1 <= 0 && q2 <= 0) {
      setMessage("Enter Qty or Free quantity.");
      return;
    }

    setCart((current) => {
      if (editingCartUid) {
        return distinctCartItems(current.map((row) =>
          row.uid === editingCartUid
            ? {
                ...row,
                ...selectedItem,
                uid: row.uid,
                rowId: row.rowId,
                Qty1: q1,
                Qty2: q2,
                pending: row.pending || !selectedItem.StockAvailable,
              }
            : row,
        ));
      }
      const existing = current.find((row) => row.id === selectedItem.id);
      if (existing) {
        return current.map((row) =>
          row.uid === existing.uid
            ? { ...row, Qty1: row.Qty1 + q1, Qty2: row.Qty2 + q2 }
            : row,
        );
      }
      return distinctCartItems([
        ...current,
        {
          ...selectedItem,
          uid: newUid(),
          Qty1: q1,
          Qty2: q2,
          pending: !selectedItem.StockAvailable,
        },
      ]);
    });
    setItemQuery("");
    setSelectedItem(null);
    setEditingCartUid(null);
    setQty1(1);
    setQty2(0);
    setShowCart(itemSourceTab !== "companies");
    if (itemSourceTab === "companies") setReviewAddingItem(true);
    setMessage("");
  };

  const statusForAction = (mode: "save" | "submit" | "update") => {
    if (mode === "save") return "SAVED";
    if (mode === "submit") return "SUBMITTED";
    const current = String(selectedOrder?.header?.Status || "").toUpperCase();
    if (current === "PENDING" || current === "PARTIAL" || current === "OPEN-PENDING") return "SAVED";
    return current || "SAVED";
  };

  const rowsForPayload = (items: CartItem[], customer: Customer) =>
    items.map((item, index) => ({
      id: item.rowId ?? 0,
      CustId: customer.id,
      RowNo: index + 1,
      ItemId: item.id,
      CompanyId: item.CompanyID,
      HSNCode: item.HSNCode,
      LatestMRP: item.MRP,
      LatestRetailRate: item.RetRate,
      GSTPercent: item.GSTPercent,
      Qty1: item.Qty1,
      Qty2: item.Qty2,
      SchmQty: item.SchmQty,
      SchmFree: item.SchmFree,
      ApplySchm: item.SchmQty > 0 || item.SchmFree > 0,
      SplDiscPct: 0,
      ApplyNetRate: true,
      NetRateEdited: false,
      NetRate: item.RetRate,
      BaseValue: item.Qty1 * item.RetRate,
    }));

  const saveOrder = async (mode: "save" | "submit" | "update") => {
    if (selectedOrder && !canEditSelectedOrder) return;
    const customer = selectedCustomer ?? selectedOrder?.customer;
    if (!customer || cart.length === 0) {
      setMessage("Select a customer and add at least one item.");
      return;
    }

    const status = statusForAction(mode);

    setBusy(true);
    setMessage("");
    try {
      if (selectedOrder?.header?.ID) {
        await API.put(`/so/${selectedOrder.header.ID}`, {
          header: {
            ...selectedOrder.header,
            id: selectedOrder.header.ID,
            CustId: customer.id,
            SODate: toApiDateTime(selectedOrder.header.SODate),
            PeriodFrom: toApiDateTime(selectedOrder.header.PeriodFrom),
            PeriodTo: toApiDateTime(selectedOrder.header.PeriodTo),
            Status: status,
          },
          rows: rowsForPayload(cart, customer),
        });
        setSelectedOrder((current) =>
          current
            ? {
                ...current,
                header: { ...current.header, Status: status, NumItems: cart.length },
                rows: cart,
                customer: { ...current.customer, Status: statusForMobile(status), NumItems: cart.length },
              }
            : current,
        );
        setLoadedCartSignature(cartSignature(cart));
        setMessage(mode === "submit" ? "Order submitted." : "Order saved.");
        await loadOrders();
        return;
      }

      const createResponse = await API.post("/so", {
        header: {
          CustId: customer.id,
          SODate: toApiDateTime(draftSoDate),
          PeriodFrom: toApiDateTime(draftSoDate),
          PeriodTo: toApiDateTime(draftSoDate),
          SalesRep: "",
          Remarks: mode === "submit" ? "Mobile sales order submitted." : "Mobile sales order saved.",
          OverallDiscPct: 0,
          Status: status,
        },
        rows: rowsForPayload(cart, customer),
      });

      const createdId = Number(
        createResponse.data?.id || createResponse.data?.ID || createResponse.data?.header?.ID || 0,
      );
      setNewOrderSavedId(createdId > 0 ? createdId : null);
      setSavedCartSignature(createdId > 0 ? cartSignature(cart) : "");

      setMessage(mode === "submit" ? "Order submitted." : "Order saved.");
      setCartSearch("");
      setSelectedItem(null);
      setEditingCartUid(null);
      setShowCart(true);
      setDraftSoNumber("New");
      setDraftSoDate(todayISODate());
      await loadCustomers();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to save sales order.");
    } finally {
      setBusy(false);
    }
  };

  const openReviewOrder = async (row: OrderListRow) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await API.get(`/so/${row.ID}`);
      const header = res.data?.header ?? {};
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const mappedCustomer = customers.find((item) => item.id === Number(header.CustId || row.CustId));
      const customer: Customer = {
        id: Number(header.CustId || row.ID),
        CustomerName: header.CustomerName || row.CustomerName,
        AddressLine1: header.AddressLine1 || row.AddressLine1 || "",
        AddressLine2: header.AddressLine2 || row.AddressLine2 || "",
        AddressLine3: header.AddressLine3 || row.AddressLine3 || "",
        LastOrderDate: header.SODate || row.SODate,
        LastOrderTime: "",
        NumItems: Number(header.NumItems || row.NumItems || rows.length),
        Status: statusForMobile(header.Status || row.Status),
        MobileNo: mappedCustomer?.MobileNo || header.MobileNo || "",
        WhatsappNo: mappedCustomer?.WhatsappNo || header.WhatsappNo || "",
        EmailID: mappedCustomer?.EmailID || header.EmailID || "",
        GstNo: customerGstNo(mappedCustomer || header),
      };
      const loadedRows = rows.map((item: any) => ({
        uid: newUid(),
        rowId: Number(item.ID || item.id || 0),
        id: Number(item.ItemId || 0),
        ItemName: item.ItemName || "",
        Packing: item.Packing || "",
        CompanyID: Number(item.CompanyId || 0),
        CompShort: item.CompShort || "",
        HSNCode: item.HSNCode || "",
        Location: "",
        RackNumber: "",
        MRP: Number(item.LatestMRP || 0),
        RetRate: Number(item.LatestRetailRate || item.NetRate || 0),
        GSTPercent: Number(item.GSTPercent || 0),
        Scheme:
          Number(item.SchmQty || 0) || Number(item.SchmFree || 0)
            ? `${Number(item.SchmQty || 0)}+${Number(item.SchmFree || 0)}`
            : "-",
        SchmQty: Number(item.SchmQty || 0),
        SchmFree: Number(item.SchmFree || 0),
        StockQty1: 0,
        StockQty2: 0,
        StockAvailable: true,
        Qty1: Number(item.Qty1 || 0),
        Qty2: Number(item.Qty2 || 0),
        pending: statusForMobile(header.Status) === "Pending",
      }));
      setSelectedOrder({
        header,
        customer,
        rows: loadedRows,
      });
      setSelectedCustomer(customer);
      const distinctLoadedRows = distinctCartItems(loadedRows);
      setCart(distinctLoadedRows);
      setLoadedCartSignature(cartSignature(distinctLoadedRows));
      setSavedCartSignature("");
      setCartSearch("");
      setSelectedItem(null);
      setEditingCartUid(null);
      setShowCart(true);
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to open order.");
    } finally {
      setBusy(false);
    }
  };

  const revertReviewChanges = () => {
    if (!selectedOrder) return;
    setCart(selectedOrder.rows);
    setLoadedCartSignature(cartSignature(selectedOrder.rows));
    setSelectedItem(null);
    setEditingCartUid(null);
    setReviewAddingItem(false);
    setShowCart(true);
    setMessage("");
  };

  const printSelectedOrder = async (requestedFormat = shareFormat) => {
    const orderId = selectedOrder?.header?.ID || newOrderSavedId;
    if (!orderId) {
      setMessage("Sales order saved, but its print reference was not returned.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const selectedForPrint = selectedCustomer ?? selectedOrder?.customer;
      let target = String(selectedForPrint?.WhatsappNo || "").trim();
      if (selectedForPrint?.id) {
        try {
          const customerResponse = await API.get(`/customers/${selectedForPrint.id}`);
          target = String(
            customerResponse.data?.SalesInvDefaultWhatsapp ||
              customerResponse.data?.WhatsappNo ||
              target,
          ).trim();
        } catch {
          // Use the number captured when the customer was selected.
        }
      }
      if (!target) {
        setMessage("The selected customer has no WhatsApp number.");
        return;
      }

      const orderNumber = entrySoNumber || `SO-${orderId}`;
      const orderText = salesOrderText(orderNumber, entrySoDate, entryStatus, cart);
      if (requestedFormat === "text") {
        await sendText(target, orderText);
        setMessage("Sales Order text sent to the customer on WhatsApp.");
        return;
      }

      if (requestedFormat === "image") {
        const res = await API.get(`/so/${orderId}/pdf-link`, { params: { format: "png" } });
        const outputUrl = String(res.data?.downloadUrl || res.data?.outputUrl || "").trim();
        if (!outputUrl) {
          setMessage("PNG report generated, but no file URL was returned.");
          return;
        }
        const baseUrl = String(API.defaults.baseURL || window.location.origin);
        const pngUrl = new URL(outputUrl, baseUrl).toString();
        const pngResponse = await API.get(pngUrl, { responseType: "arraybuffer" });
        const bytes = new Uint8Array(pngResponse.data);
        const chunkSize = 0x8000;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const pngBase64 = `data:image/png;base64,${btoa(binary)}`;

        await sendMedia(
          target,
          pngBase64,
          `${orderNumber}.png`,
          salesOrderShareMessage,
        );
        setMessage("Jasper Sales Order image sent to the customer on WhatsApp.");
        return;
      }

      const res = await API.get(`/so/${orderId}/pdf-link`);
      const outputUrl = String(res.data?.downloadUrl || res.data?.outputUrl || "").trim();
      if (!outputUrl) {
        setMessage("PDF generated, but no file URL was returned.");
        return;
      }
      const baseUrl = String(API.defaults.baseURL || window.location.origin);
      const pdfUrl = new URL(outputUrl, baseUrl).toString();
      const pdfResponse = await API.get(pdfUrl, { responseType: "arraybuffer" });
      const bytes = new Uint8Array(pdfResponse.data);
      const chunkSize = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const pdfBase64 = `data:application/pdf;base64,${btoa(binary)}`;

      await sendMedia(target, pdfBase64, `${orderNumber}.pdf`, salesOrderShareMessage);
      setMessage("SO PDF generated and sent to the customer on WhatsApp.");
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to print sales order.");
    } finally {
      setBusy(false);
    }
  };

  const updateShareFormat = (format: SalesOrderShareFormat) => {
    setShareFormat(format);
    window.localStorage.setItem("sales-order-share-format", format);
  };

  const selectedHeading = selectedCustomer ?? selectedOrder?.customer;
  const entrySoNumber = String(selectedOrder?.header?.SONumber || draftSoNumber || "New");
  const entrySoDate = String(selectedOrder?.header?.SODate || draftSoDate || todayISODate());
  const entryStatus = selectedOrder
    ? statusForMobile(selectedOrder.header?.Status)
    : "New";
  const selectedOrderStatus = String(selectedOrder?.header?.Status || "");
  const canEditSelectedOrder = canEditSOStatus(selectedOrderStatus);
  const reviewHasChanges =
    Boolean(selectedOrder) && loadedCartSignature !== "" && cartSignature(cart) !== loadedCartSignature;
  const printableStatuses = new Set(["SAVED", "SUBMITTED", "CANCELLED", "CANCELED"]);
  const printStatus = normalizedStatus(selectedOrderStatus || (newOrderSavedId ? "SAVED" : ""));
  const printReady = printableStatuses.has(printStatus) &&
    (selectedOrder
      ? showCart && !reviewHasChanges && !selectedItem
      : Boolean(newOrderSavedId && savedCartSignature && cartSignature(cart) === savedCartSignature && showCart && !selectedItem));
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((company) =>
      `${company.CompName} ${company.CompShort}`.toLowerCase().includes(q),
    );
  }, [companies, companySearch]);

  const filteredCart = useMemo(() => {
    const q = cartSearch.trim().toLowerCase();
    if (!q) return cart;
    return cart.filter((item) =>
      `${item.ItemName} ${item.Packing} ${item.CompShort}`.toLowerCase().includes(q),
    );
  }, [cart, cartSearch]);
  const shouldShowCartSearch = cart.length > 5;

  const backFromEntry = (reviewMode: boolean) => {
    if (reviewMode) {
      setSelectedOrder(null);
      setSelectedCustomer(null);
      setCart([]);
      void loadOrders();
    } else {
      resetEntry();
    }
  };

  const startNewOrderFromReview = () => {
    resetEntry();
    setActiveTab("place");
    window.setTimeout(() => customerSelectRef.current?.focus(), 0);
  };

  const removeSelectedOrder = async () => {
    if (!selectedOrder?.header?.ID || !canEditSelectedOrder) return;
    setBusy(true);
    setMessage("");
    try {
      await API.delete(`/so/${selectedOrder.header.ID}`);
      backFromEntry(true);
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to remove sales order.");
    } finally {
      setBusy(false);
    }
  };

  const openItemSelection = () => {
    if (selectedOrder && !canEditSelectedOrder) return;
    setShowCart(false);
    setReviewAddingItem(true);
    setSelectedItem(null);
    setEditingCartUid(null);
    setItemQuery("");
    setItemSourceTab("search");
    setSelectedCompany(null);
    setCompanyItems([]);
    focusItemSearch();
  };

  const exitItemSelection = () => {
    setSelectedItem(null);
    setEditingCartUid(null);
    setItemQuery("");
    setReviewAddingItem(false);
    setShowCart(true);
    setMessage("");
  };

  const focusItemSearch = () => {
    window.setTimeout(() => {
      itemSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      itemSelectRef.current?.focus();
      itemSelectRef.current?.select();
    }, 0);
    window.setTimeout(() => {
      itemSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  };

  const editCartItem = (item: CartItem) => {
    if (selectedOrder && !canEditSelectedOrder) return;
    setSelectedItem(item);
    setEditingCartUid(item.uid);
    setQty1(Number(item.Qty1 || 0));
    setQty2(Number(item.Qty2 || 0));
    setReviewAddingItem(true);
    setShowCart(false);
    setMessage("");
    window.setTimeout(() => {
      selectedItemEditorRef.current?.scrollIntoView({ block: "nearest" });
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  };

  const renderItemResultButton = (item: ItemInfo, index: number) => (
    <button
      key={`${item.id}-${index}`}
      type="button"
      onClick={() => selectItemInfo(item)}
      className={`block w-full border-b border-slate-200 px-3 py-3 text-left last:border-b-0 ${
        index % 2 === 0 ? "bg-white" : "bg-sky-50/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-slate-900">{item.ItemName}</span>
        <span className="shrink-0 truncate text-xs font-semibold text-slate-600">{item.Packing}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
        <span className="truncate">{item.CompShort || ""}</span>
        <span className="truncate">Rack: {item.RackNumber || "-"}</span>
        <span className="truncate">MRP: {money(item.MRP)}</span>
        {item.StockAvailable && <span className="shrink-0 font-semibold text-emerald-700">Available</span>}
      </div>
    </button>
  );

  const renderSelectedItemEditor = (reviewMode: boolean) =>
    selectedItem ? (
      <div ref={selectedItemEditorRef} className="relative mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 pb-14">
        <div className="flex min-w-0 items-baseline gap-2 pr-10">
          <div className="truncate font-bold text-slate-900">{selectedItem.ItemName}</div>
          <div className="shrink-0 truncate text-xs font-semibold text-slate-600">{selectedItem.Packing}</div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-700">
          <span>Company: {selectedItem.CompShort || "-"}</span>
          <span>Location: {selectedItem.Location || "-"}</span>
          <span>Rack: {selectedItem.RackNumber || "-"}</span>
          <span>MRP: {money(selectedItem.MRP)}</span>
          <span>Scheme: {selectedItem.Scheme || "-"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FloatingLabelDecimalInput
            ref={qtyInputRef}
            id="sales-order-qty"
            label="Qty"
            value={qty1}
            minValue={0}
            onChange={setQty1}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                freeInputRef.current?.focus();
                freeInputRef.current?.select();
              }
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
          />
          <FloatingLabelDecimalInput
            ref={freeInputRef}
            id="sales-order-free"
            label="Free"
            value={qty2}
            minValue={0}
            onChange={setQty2}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                registerSelectedItem();
              }
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
          />
        </div>
        <div className="absolute bottom-2 right-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedItem(null);
              setEditingCartUid(null);
              setReviewAddingItem(true);
              setShowCart(false);
              focusItemSearch();
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-xl font-bold text-slate-600 shadow-sm"
            aria-label="Cancel item entry"
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => {
              registerSelectedItem();
              if (reviewMode && itemSourceTab !== "companies") setReviewAddingItem(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-sm"
            aria-label={editingCartUid ? "Update item" : "Add item"}
          >
            {editingCartUid ? "✓" : "+"}
          </button>
        </div>
        {/* Keep the actions in the card's lower-right corner as specified in the entry brief. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        >
          {editingCartUid ? "Update Item" : "Add"}
        </button>
      </div>
    ) : null;

  const renderEntry = (reviewMode = false) => {
    const itemEntryMode = !showCart && (!reviewMode || reviewAddingItem);
    const visibleCompanyItems = companyItems.filter(
      (item) => item.id !== selectedItem?.id,
    );

    return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
      <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-3 py-2">
          <div
            className={`min-w-0 ${onEditCustomer ? "cursor-pointer" : ""}`}
            onDoubleClick={() => {
              if (onEditCustomer && selectedHeading) onEditCustomer(selectedHeading);
            }}
            title={onEditCustomer ? "Double-click to update customer" : undefined}
          >
            <div className="truncate text-base font-bold text-blue-950">
            {selectedHeading?.CustomerName}
            </div>
            <div className="mt-1 text-xs leading-4 text-slate-600">
              {addressOf(selectedHeading || {})}
            </div>
            {reviewMode && (
              <div className="mt-2 flex flex-nowrap items-center gap-2 overflow-visible text-xs font-bold text-blue-900">
                <FloatingLabelInput
                  id="sales-order-number"
                  label="No."
                  value={entrySoNumber}
                  onChange={() => undefined}
                  disabled
                  className="h-9 w-[9.5rem] rounded-md border border-blue-200 bg-transparent px-2 py-1 text-xs font-bold text-blue-900 disabled:opacity-100"
                  labelBgClassName="bg-blue-50"
                />
                <FloatingLabelInput
                  id="sales-order-date"
                  label="Date"
                  value={displayDateTime(entrySoDate)}
                  onChange={() => undefined}
                  disabled
                  className="h-9 w-[7.5rem] rounded-md border border-blue-200 bg-transparent px-2 py-1 text-xs font-bold text-blue-900 disabled:opacity-100"
                  labelBgClassName="bg-blue-50"
                />
                <span className="shrink-0 rounded-md border border-blue-200 bg-white px-2 py-2">{entryStatus}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowCart((current) => !current)}
              className={`rounded-full shadow-sm ${
                showCart ? "bg-blue-100 ring-2 ring-blue-300" : "bg-white"
              }`}
              aria-label="Show cart items"
            >
              <CartCountIcon count={cartCount} />
            </button>
          </div>
        </div>

        {showCart ? (
          <div className="max-h-[calc(100dvh-23rem)] overflow-y-auto divide-y divide-slate-200 pb-2">
            {cart.length === 0 ? (
              <>
                <div className="p-4 text-sm text-slate-500">No items in cart.</div>
                {!reviewMode && (
                  <div className="sticky bottom-0 z-10 bg-white px-3 py-3">
                    <button
                      type="button"
                      onClick={openItemSelection}
                      className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {shouldShowCartSearch && (
                  <div className="p-3">
                    <input
                      type="search"
                      value={cartSearch}
                      onChange={(event) => setCartSearch(event.target.value)}
                      placeholder="Search Item"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
                <div className="divide-y divide-slate-200">
                  {filteredCart.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">No matching items.</div>
                  ) : (
                    filteredCart.map((item, index) => (
                      <div key={item.uid} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-3">
                        {(!selectedOrder || canEditSelectedOrder) ? (
                          <button
                            type="button"
                            onClick={() => editCartItem(item)}
                            className="min-w-0 text-left"
                          >
                            <div className="font-semibold text-slate-900">
                              {index + 1}. {item.ItemName}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-600">
                              {item.Packing} x ({item.Qty1}+{item.Qty2})
                            </div>
                          </button>
                        ) : (
                          <div className="min-w-0 text-left">
                            <div className="font-semibold text-slate-900">
                              {index + 1}. {item.ItemName}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-600">
                              {item.Packing} x ({item.Qty1}+{item.Qty2})
                            </div>
                          </div>
                        )}
                        {(!selectedOrder || canEditSelectedOrder) && (
                          <button
                            type="button"
                            onClick={() => setCart((current) => current.filter((row) => row.uid !== item.uid))}
                            className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-red-50 text-red-700"
                            aria-label={`Remove ${item.ItemName}`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v5" />
                              <path d="M14 11v5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {(!reviewMode || canEditSelectedOrder) && (
                  <div className="sticky bottom-0 z-10 bg-white px-3 py-3">
                    <button
                      type="button"
                      onClick={openItemSelection}
                      className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (!reviewMode || (reviewAddingItem && canEditSelectedOrder)) && (
          <div className="border-b border-slate-200 p-3">
            <div className="mb-3 grid grid-cols-2 rounded-lg border border-blue-200 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setItemSourceTab("search");
                  setSelectedCompany(null);
                }}
                className={`rounded-md px-2 py-2 text-sm font-bold ${
                  itemSourceTab === "search" ? "bg-blue-600 text-white" : "text-blue-800"
                }`}
              >
                Search Item
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemSourceTab("companies");
                  setSelectedCompany(null);
                  setCompanyItems([]);
                  void loadCompanies();
                }}
                className={`rounded-md px-2 py-2 text-sm font-bold ${
                  itemSourceTab === "companies" ? "bg-blue-600 text-white" : "text-blue-800"
                }`}
              >
                From Companies
              </button>
            </div>

            {renderSelectedItemEditor(reviewMode)}

            {itemSourceTab === "search" ? (
              <>
                {!selectedItem && (
                  <GenericAutoComplete
                    ref={itemSelectRef}
                    endpoint={`/mobile/sales-orders/items/search?asOnDate=${encodeURIComponent(
                      todayISODate(),
                    )}`}
                    searchQuery={itemQuery}
                    setSearchQuery={setItemQuery}
                    onSelect={handleItemSelect}
                    topLabel="Select Item"
                    myplacehoder="Select Item [ Live ]"
                    minChars={ITEM_SEARCH_MIN_CHARS}
                    mode="live"
                    hideFloatingLabel
                    salesOrderItemLayout
                  />
                )}

              </>
            ) : (
              <div className="space-y-3">
                {selectedCompany ? (
                  <section className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="border-b bg-blue-50 px-3 py-2">
                      <div className="min-w-0 text-left text-sm font-bold text-blue-950">
                        {selectedCompany.CompName}
                      </div>
                    </div>
                    {loadingCompanyItems ? (
                      <div className="p-3 text-sm text-slate-500">Loading items...</div>
                    ) : visibleCompanyItems.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500">No items.</div>
                    ) : (
                      visibleCompanyItems.map(renderItemResultButton)
                    )}
                  </section>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="search"
                      value={companySearch}
                      onChange={(event) => setCompanySearch(event.target.value)}
                      placeholder="Search company name"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <section className="overflow-hidden rounded-lg border border-blue-200 bg-white">
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem_4.25rem] gap-2 border-b bg-blue-50 px-3 py-2 text-xs font-bold uppercase text-blue-900">
                      <span>Company Name</span>
                      <span className="text-right">Short</span>
                      <span className="text-right">Items</span>
                    </div>
                    {loadingCompanies ? (
                      <div className="p-3 text-sm text-slate-500">Loading companies...</div>
                    ) : filteredCompanies.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500">No matching companies.</div>
                    ) : (
                      filteredCompanies.map((company, index) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => void openCompanyItems(company)}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_4rem_4.25rem] gap-2 border-b border-slate-200 px-3 py-3 text-left last:border-b-0 ${
                            index % 2 === 0 ? "bg-white" : "bg-sky-50/70"
                          }`}
                        >
                          <span className="min-w-0 font-semibold text-slate-900">{company.CompName}</span>
                          <span className="text-right text-sm text-slate-600">{company.CompShort}</span>
                          <span className="text-right font-bold tabular-nums text-blue-800">
                            {company.ItemCount}
                          </span>
                        </button>
                      ))
                    )}
                    </section>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </section>

      {message && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {message}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <div
          className={`mx-auto grid max-w-3xl gap-2 ${
            itemEntryMode ? "grid-cols-2" : reviewMode ? (reviewHasChanges ? "grid-cols-3" : canEditSelectedOrder ? "grid-cols-5" : "grid-cols-3") :
              newOrderSavedId ? "grid-cols-2" : cart.length > 0 ? "grid-cols-4" : "grid-cols-2"
          }`}
        >
          {itemEntryMode ? (
            <>
              <BottomActionButton
                type="button"
                onClick={exitItemSelection}
                label="Back"
                icon="back"
                className="border border-blue-300 bg-white text-blue-700"
              />
              <BottomActionButton
                type="button"
                onClick={exitItemSelection}
                label="Cancel"
                icon="cancel"
                className="border border-slate-300 bg-white text-slate-700"
              />
            </>
          ) : reviewMode ? (
            <>
              {reviewHasChanges && canEditSelectedOrder ? (
                <>
                  <BottomActionButton
                    type="button"
                    disabled={busy || cart.length === 0}
                    onClick={() => void saveOrder("save")}
                    label="Save"
                    icon="save"
                    className={`${buttonBase} bg-amber-500 text-white`}
                  />
                  <BottomActionButton
                    type="button"
                    disabled={busy || cart.length === 0}
                    onClick={() => void saveOrder("submit")}
                    label="Send"
                    icon="submit"
                    className={`${buttonBase} bg-emerald-600 text-white`}
                  />
                  <BottomActionButton
                    type="button"
                    onClick={revertReviewChanges}
                    label="Cancel"
                    icon="cancel"
                    className={`${buttonBase} border border-slate-300 bg-white text-slate-700`}
                  />
                </>
              ) : (
                <>
                  <BottomActionButton
                    type="button"
                    onClick={startNewOrderFromReview}
                    label="New"
                    icon="new"
                    className={`${buttonBase} border border-blue-300 bg-white text-blue-700`}
                  />
                  {canEditSelectedOrder && (
                    <BottomActionButton
                      type="button"
                      disabled={busy || cart.length === 0}
                      onClick={() => void saveOrder("submit")}
                      label="Send"
                      icon="submit"
                      className={`${buttonBase} bg-emerald-600 text-white`}
                    />
                  )}
                  <BottomActionButton
                    type="button"
                    onClick={() => backFromEntry(true)}
                    label="Back"
                    icon="back"
                    className={`${buttonBase} border border-slate-300 bg-white text-slate-700`}
                  />
                  {canEditSelectedOrder && (
                    <BottomActionButton
                      type="button"
                      disabled={busy}
                      onClick={() => void removeSelectedOrder()}
                      label="Remove"
                      icon="remove"
                      className={`${buttonBase} bg-red-600 text-white`}
                    />
                  )}
                </>
              )}
            </>
          ) : newOrderSavedId ? (
              <>
                <BottomActionButton
                  type="button"
                  onClick={resetEntry}
                  label="New"
                  icon="new"
                  className={`${buttonBase} bg-blue-600 text-white`}
                />
              </>
            ) : cart.length === 0 ? (
              <>
                <BottomActionButton
                  type="button"
                  onClick={resetEntry}
                  label="Cancel"
                  icon="cancel"
                  className={`${buttonBase} border border-slate-300 bg-white text-slate-700`}
                />
                <BottomActionButton
                  type="button"
                  onClick={() => backFromEntry(false)}
                  label="Back"
                  icon="back"
                  className={`${buttonBase} border border-blue-300 bg-white text-blue-700`}
                />
              </>
            ) : (
              <>
                <BottomActionButton
                  type="button"
                  disabled={busy}
                  onClick={() => void saveOrder("save")}
                  label="Save"
                  icon="save"
                  className={`${buttonBase} bg-amber-500 text-white`}
                />
                <BottomActionButton
                  type="button"
                  onClick={resetEntry}
                  label="Cancel"
                  icon="cancel"
                  className={`${buttonBase} border border-slate-300 bg-white text-slate-700`}
                />
                <BottomActionButton
                  type="button"
                  disabled={busy}
                  onClick={() => void saveOrder("submit")}
                  label="Send"
                  icon="submit"
                  className={`${buttonBase} bg-emerald-600 text-white`}
                />
                <BottomActionButton
                  type="button"
                  onClick={() => backFromEntry(false)}
                  label="Back"
                  icon="back"
                  className={`${buttonBase} border border-blue-300 bg-white text-blue-700`}
                />
              </>
            )
          }
        </div>
      </div>
      {printReady && (
        <FloatingPrintButton
          disabled={busy}
          format={shareFormat}
          onFormatChange={updateShareFormat}
          onPrint={(format) => void printSelectedOrder(format)}
        />
      )}
    </div>
    );
  };

  const filteredOrders = useMemo(
    () => orders.map((order) => ({ ...order, Status: statusForMobile(order.Status) })),
    [orders],
  );

  if (selectedCustomer && !selectedOrder) return renderEntry(false);
  if (selectedOrder) return renderEntry(true);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
      <div className="mb-3 grid grid-cols-2 rounded-lg border border-blue-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("place")}
          className={`rounded-md px-3 py-2 text-sm font-bold ${
            activeTab === "place" ? "bg-blue-600 text-white" : "text-blue-800"
          }`}
        >
          Place an Order
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`rounded-md px-3 py-2 text-sm font-bold ${
            activeTab === "review" ? "bg-blue-600 text-white" : "text-blue-800"
          }`}
        >
          Review
        </button>
      </div>

      {message && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg bg-white p-4 text-sm shadow-sm">Loading...</div>
      ) : activeTab === "place" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
            <GenericAutoComplete
              ref={customerSelectRef}
              endpoint="/customers/autocomplete"
              searchQuery={customerQuery}
              setSearchQuery={setCustomerQuery}
              onSelect={handleFallbackCustomerSelect}
              topLabel="Select Customer"
              myplacehoder="Select Customer [ Live ]"
              minChars={2}
              mode="live"
              hideFloatingLabel
            />
          </div>
          {customers.map((customer) => (
            <section key={customer.id} className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
              <div className="font-bold text-slate-900">{customer.CustomerName}</div>
              <div className="mt-1 text-xs leading-4 text-slate-600">{addressOf(customer)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                <span>Last: {displayDateTime(customer.LastOrderDate, customer.LastOrderTime)}</span>
                <span>Items: {customer.NumItems || 0}</span>
                <span>Status: {customer.Status || "-"}</span>
                <button
                  type="button"
                  onClick={() => openCustomerOrder(customer)}
                  className="justify-self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Order
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
            {filteredOrders.map((order, index) => (
              <button
                key={order.ID}
                type="button"
                onClick={() => void openReviewOrder(order)}
                className={`block w-full border-b border-slate-200 px-3 py-3 text-left text-sm transition last:border-b-0 hover:bg-blue-50 ${
                  index % 2 === 0 ? "bg-white" : "bg-sky-50/60"
                }`}
              >
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-bold text-slate-900">{order.CustomerName}</span>
                  <span className="shrink-0 font-bold text-blue-800">
                    <CartCountIcon count={order.NumItems || 0} compact />
                  </span>
                </span>
                <span className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] gap-2 text-xs text-slate-600">
                  <span className="min-w-0 truncate">{order.SONumber}</span>
                  <span className="shrink-0">{displayDateTime(order.SODate)}</span>
                  <span className="max-w-[6rem] truncate text-right font-bold text-slate-700">{order.Status}</span>
                </span>
              </button>
            ))}
            {orderStatuses.length > 0 && filteredOrders.length === 0 && (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-4 py-8 text-center text-sm text-slate-600">
                No sales orders found.
              </div>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <BottomActionButton
                type="button"
                onClick={startNewOrderFromReview}
                label="New"
                icon="new"
                className="bg-blue-600 text-white"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
