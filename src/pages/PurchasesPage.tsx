import { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";

type PurchaseInvoice = {
  id: number;
  MonthKey: string;
  MonthLabel: string;
  InvoiceDate: string;
  InvoiceNo: string;
  SupplierName: string;
  ReceivedOn: string;
  GrNo: string;
  InvoiceAmount: number;
  NumItems: number;
};

type PurchaseMonth = {
  MonthKey: string;
  MonthLabel: string;
  InvoiceCount: number;
  invoices: PurchaseInvoice[];
};

type PurchaseItem = {
  TranID: number;
  ItemID: number;
  ItemName: string;
  Packing: string;
  BatchNo: string;
  RackNumber: string;
  PTR: number;
  MRP: number;
  Qty1: number;
  Qty2: number;
};

interface PurchasesPageProps {
  onEditRack?: (item: {
    id: number;
    ItemName: string;
    invoiceId: number;
    tranId: number;
  }) => void;
  canUpdateRack?: boolean;
  focusInvoiceId?: number | null;
  focusItemId?: number | null;
  focusTranId?: number | null;
  focusRequestKey?: number;
}

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const monthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const monthLabelFromKey = (key: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex >= monthNames.length) return key;

  return `${monthNames[monthIndex]} ${year}`;
};

const grNoValue = (value?: string | null) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isNaN(parsed) ? -1 : parsed;
};

const purchaseRange = () => {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  return {
    from: localDateKey(previousMonth),
    to: localDateKey(today),
    allowedMonths: new Set([monthKey(today), monthKey(previousMonth)]),
  };
};

const normalizeMonths = (rawMonths: PurchaseMonth[]) => {
  const { allowedMonths } = purchaseRange();

  return rawMonths
    .filter((month) => allowedMonths.has(month.MonthKey))
    .map((month) => {
      const invoices = Array.isArray(month.invoices) ? [...month.invoices] : [];
      invoices.sort((a, b) => {
        const grNoCompare = grNoValue(b.GrNo) - grNoValue(a.GrNo);
        if (grNoCompare !== 0) return grNoCompare;
        const grNoTextCompare = String(b.GrNo || "").localeCompare(String(a.GrNo || ""));
        if (grNoTextCompare !== 0) return grNoTextCompare;
        const dateCompare = String(b.InvoiceDate || "").localeCompare(String(a.InvoiceDate || ""));
        if (dateCompare !== 0) return dateCompare;
        return Number(b.id || 0) - Number(a.id || 0);
      });

      return {
        ...month,
        MonthLabel: monthLabelFromKey(month.MonthKey),
        InvoiceCount: invoices.length,
        invoices,
      };
    })
    .sort((a, b) => b.MonthKey.localeCompare(a.MonthKey));
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const qty = (value: number) => {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const formatQtyPair = (qty1: number, qty2: number) => {
  const q1 = Number(qty1 || 0);
  const q2 = Number(qty2 || 0);

  if (q1 > 0 && q2 > 0) return `${qty(q1)}+${qty(q2)}`;
  if (q1 > 0) return qty(q1);
  if (q2 > 0) return `0+${qty(q2)}`;
  return "0";
};

export default function PurchasesPage({
  onEditRack,
  canUpdateRack = true,
  focusInvoiceId = null,
  focusItemId = null,
  focusTranId = null,
  focusRequestKey = 0,
}: PurchasesPageProps) {
  const [months, setMonths] = useState<PurchaseMonth[]>([]);
  const [openMonth, setOpenMonth] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [message, setMessage] = useState("");

  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const itemRequestKeyRef = useRef(0);

  const invoiceById = useMemo(() => {
    const index: Record<number, PurchaseInvoice> = {};
    months.forEach((month) => {
      month.invoices.forEach((invoice) => {
        index[invoice.id] = invoice;
      });
    });
    return index;
  }, [months]);

  useEffect(() => {
    let disposed = false;

    const loadPurchases = async () => {
      setLoading(true);
      setMessage("");

      try {
        const { from, to } = purchaseRange();
        const res = await API.get("/mobile/purchases", {
          params: { from, to },
        });
        const rawMonths = Array.isArray(res.data?.months) ? res.data.months : [];
        const nextMonths = normalizeMonths(rawMonths);
        if (disposed) return;

        setMonths(nextMonths);
        if (nextMonths.length > 0) setOpenMonth(nextMonths[0].MonthKey);
      } catch (error: any) {
        if (!disposed) {
          setMessage(error?.response?.data?.error || "Unable to load purchases.");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void loadPurchases();

    return () => {
      disposed = true;
    };
  }, []);

  const openInvoice = async (invoice: PurchaseInvoice) => {
    if (selectedInvoice?.id === invoice.id) {
      itemRequestKeyRef.current += 1;
      setSelectedInvoice(null);
      setItems([]);
      setMessage("");
      setLoadingItems(false);
      return;
    }

    const requestKey = ++itemRequestKeyRef.current;
    setSelectedInvoice(invoice);
    setItems([]);
    setMessage("");
    setLoadingItems(true);

    try {
      const res = await API.get(`/mobile/purchases/${invoice.id}/items`);
      if (itemRequestKeyRef.current !== requestKey) return;
      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(nextItems);
    } catch (error: any) {
      setMessage(error?.response?.data?.error || "Unable to load purchase items.");
    } finally {
      if (itemRequestKeyRef.current === requestKey) setLoadingItems(false);
    }
  };

  const renderInvoiceItems = (invoice: PurchaseInvoice) => {
    if (selectedInvoice?.id !== invoice.id) return null;

    return (
      <section className="border-t border-blue-200 bg-white">
        <div className="border-b bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
          {selectedInvoice.InvoiceNo} - {selectedInvoice.SupplierName}
        </div>

        {loadingItems ? (
          <div className="p-4 text-sm">Loading invoice items...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No items found for this invoice.</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.TranID}
              ref={(element) => {
                itemRefs.current[item.TranID] = element;
              }}
              type="button"
              onClick={() =>
                canUpdateRack
                  ? onEditRack?.({
                      id: item.ItemID,
                      ItemName: item.ItemName,
                      invoiceId: selectedInvoice.id,
                      tranId: item.TranID,
                    })
                  : undefined
              }
              className={`block w-full border-b border-slate-200 px-3 py-3 text-left transition-colors last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                canUpdateRack ? "hover:bg-blue-100 active:bg-blue-200" : "cursor-default"
              } ${
                focusTranId === item.TranID || (!focusTranId && focusItemId === item.ItemID)
                  ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                  : index % 2 === 0
                    ? "bg-white"
                    : "bg-sky-50/70"
              }`}
              title={
                canUpdateRack
                  ? "Open this item in Update Rack"
                  : "View-only access"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold text-gray-900">{item.ItemName}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-700">
                  {item.Packing}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs font-medium text-gray-600 sm:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
                <span>Rack No.: {item.RackNumber?.trim() || "-"}</span>
                <span>Batch No.: {item.BatchNo?.trim() || "-"}</span>
                <span>MRP: {money(item.MRP)}</span>
                <span className="text-right">Qty: {formatQtyPair(item.Qty1, item.Qty2)}</span>
              </div>
            </button>
          ))
        )}
      </section>
    );
  };

  useEffect(() => {
    if (!focusInvoiceId || focusRequestKey <= 0) return;

    const invoice = invoiceById[focusInvoiceId];
    if (!invoice) return;

    setOpenMonth(invoice.MonthKey);
    void openInvoice(invoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusInvoiceId, focusRequestKey, invoiceById]);

  useEffect(() => {
    if ((!focusTranId && !focusItemId) || focusRequestKey <= 0 || items.length === 0) return;

    const timer = window.setTimeout(() => {
      const rowKey =
        focusTranId ??
        items.find((item) => item.ItemID === focusItemId)?.TranID ??
        0;
      const button = itemRefs.current[rowKey];
      if (!button) return;

      button.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      button.focus({ preventScroll: true });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [focusItemId, focusTranId, focusRequestKey, items]);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
      {message && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg bg-white p-4 text-sm shadow-sm">
          Loading purchases...
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-4 py-10 text-center text-sm text-gray-600">
          No purchases found since last month.
        </div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => {
            const expanded = openMonth === month.MonthKey;

            return (
              <section
                key={month.MonthKey}
                className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMonth(expanded ? "" : month.MonthKey);
                    setSelectedInvoice(null);
                    setItems([]);
                    setMessage("");
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 bg-blue-50 px-3 py-3 text-left transition hover:bg-blue-100"
                >
                  <span className="font-bold text-blue-900">{month.MonthLabel}</span>
                  <span className="text-sm font-semibold text-blue-800">
                    No. of Invoices {month.InvoiceCount}
                  </span>
                </button>

                {expanded && (
                  <div>
                    {month.invoices.map((invoice, index) => {
                      const selected = selectedInvoice?.id === invoice.id;

                      return (
                        <div key={invoice.id}>
                          <button
                            type="button"
                            onClick={() => void openInvoice(invoice)}
                            className={`block w-full border-t border-slate-200 px-3 py-3 text-left transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                              selected
                                ? "bg-amber-50"
                                : index % 2 === 0
                                  ? "bg-white"
                                  : "bg-sky-50/70"
                            }`}
                          >
                            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)_10rem_6rem]">
                              <span>{formatDate(invoice.InvoiceDate)}</span>
                              <span className="font-semibold text-gray-900">{invoice.InvoiceNo}</span>
                              <span className="text-right">Received: {formatDate(invoice.ReceivedOn)}</span>
                              <span className="text-right">Gr.No.: {invoice.GrNo || "-"}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs font-medium text-gray-600">
                              <span className="min-w-0 truncate">{invoice.SupplierName}</span>
                              <span className="text-right">Items: {invoice.NumItems}</span>
                            </div>
                          </button>
                          {renderInvoiceItems(invoice)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

    </div>
  );
}
