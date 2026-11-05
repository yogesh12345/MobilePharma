import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import API from "../services/api";
import { openInvoicePdf } from "../services/invoicePdf";
import { useTaskState } from "../hooks/useTaskState";

export type PurchaseInvoice = {
  id: number;
  invoiceYear: number;
  invoiceNo: string;
  invoiceDate: string;
  createdAt: string;
  dueDate: string | null;
  totalGST: number;
  amount: number;
  status: string;
};

export type InvoiceItem = {
  saleDetailId: number;
  saleLocation: number;
  itemId: number;
  batSrNo: number;
  itemName: string;
  packing: string;
  qty: number;
  free: number;
  mrp: number;
  retailRate: number;
  batchNo: string;
  expiry: string;
  gstPercent: number;
  value: number;
};

const date = (value?: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match && match[1] !== "0000" && match[1] !== "0001"
    ? `${match[3]}/${match[2]}/${match[1].slice(2)}`
    : "—";
};
const money = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (value?: string | null) => value?.match(/[T ](\d{2}:\d{2}:\d{2})/)?.[1] ?? "—";
const quantity = (value: number) => Number(value || 0).toLocaleString("en-IN");
const quantityWithFree = (qty: number, free: number) =>
  Number(free || 0) !== 0 ? `${quantity(qty)}+${quantity(free)}` : quantity(qty);
const visibleInvoiceItem = (item: InvoiceItem) =>
  Math.round(Math.abs(Number(item.value || 0)) * 100) !== 0 &&
  (Number(item.qty || 0) !== 0 || Number(item.free || 0) !== 0);
const invoiceKey = (invoice: PurchaseInvoice) => `${invoice.invoiceYear}:${invoice.id}`;

export default function RecentPurchases({ invoices, onItemSelect, title = "Recent purchases", fillViewport = false }: {
  invoices: PurchaseInvoice[];
  onItemSelect?: (invoice: PurchaseInvoice, item: InvoiceItem) => void;
  title?: string;
  fillViewport?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useTaskState<string | null>(onItemSelect ? "claim-invoices" : "recent-purchases", "invoice", null, (value): value is string | null => value === null || typeof value === "string");
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItem[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const [printError, setPrintError] = useState("");
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const lastTap = useRef<{ key: string; at: number } | null>(null);
  const lastItemTap = useRef<{ key: string; at: number } | null>(null);
  const lastTouchOpen = useRef(0);
  const pendingKeys = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedKey || !invoices.length || itemsByInvoice[selectedKey] || pendingKeys.current.has(selectedKey)) return;
    const invoice = invoices.find((row) => invoiceKey(row) === selectedKey);
    if (!invoice) return;
    pendingKeys.current.add(selectedKey);
    const key = selectedKey;
    queueMicrotask(() => setLoadingKey(key));
    void API.get(`/mobile/customer-portal/invoices/${invoice.id}/items`, {
      params: { invoiceYear: invoice.invoiceYear },
    }).then(({ data }) => setItemsByInvoice((current) => ({ ...current, [key]: data.items ?? [] })))
      .catch(() => setDetailError("Unable to load invoice items."))
      .finally(() => { pendingKeys.current.delete(key); setLoadingKey((current) => current === key ? null : current); });
  }, [selectedKey, invoices, itemsByInvoice]);

  useLayoutEffect(() => {
    if (!fillViewport) return;
    const updateHeight = () => {
      const list = listRef.current;
      const footer = document.getElementById("customer-portal-footer");
      if (!list || !footer) return;
      list.style.height = `${Math.max(120, Math.floor(footer.getBoundingClientRect().top - list.getBoundingClientRect().top - 8))}px`;
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [fillViewport]);

  const openInvoice = async (invoice: PurchaseInvoice) => {
    const key = invoiceKey(invoice);
    setSelectedKey(key);
    setDetailError("");
    setPrintError("");
    if (itemsByInvoice[key] || pendingKeys.current.has(key)) return;
    pendingKeys.current.add(key);
    setLoadingKey(key);
    try {
      const { data } = await API.get(`/mobile/customer-portal/invoices/${invoice.id}/items`, {
        params: { invoiceYear: invoice.invoiceYear },
      });
      setItemsByInvoice((current) => ({ ...current, [key]: data.items ?? [] }));
    } catch (error: unknown) {
      const response = error as { response?: { data?: { error?: string } } };
      setDetailError(response.response?.data?.error ?? "Unable to load invoice items.");
    } finally {
      pendingKeys.current.delete(key);
      setLoadingKey((current) => (current === key ? null : current));
    }
  };

  const printInvoice = async (invoice: PurchaseInvoice) => {
    const key = invoiceKey(invoice);
    if (printingKey) return;
    setPrintingKey(key);
    setPrintError("");
    try {
      await openInvoicePdf(invoice.id, invoice.invoiceYear);
    } catch (error: unknown) {
      const response = error as { response?: { data?: Blob | { error?: string } }; message?: string };
      const data = response.response?.data;
      let backendError = "";
      if (data instanceof Blob) {
        try { backendError = (JSON.parse(await data.text()) as { error?: string }).error || ""; } catch { /* Use the request error. */ }
      } else {
        backendError = data?.error || "";
      }
      setPrintError(backendError || response.message || "Unable to open invoice PDF.");
    } finally {
      setPrintingKey(null);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div ref={listRef} className={`${fillViewport ? "" : "max-h-[min(60vh,32rem)]"} overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm`}>
        <table className="w-full table-fixed border-collapse text-left text-[11px] tabular-nums sm:text-sm">
          <colgroup>
            <col className="w-[20%] sm:w-[23%]" />
            <col className="w-[24%] sm:w-[25%]" />
            <col className="w-[34%] sm:w-[32%]" />
            <col className="w-[22%] sm:w-[20%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr>
              <th className="px-0.5 py-2 font-semibold leading-tight sm:px-2">Inv. Date</th>
              <th className="px-0.5 py-2 font-semibold leading-tight sm:px-2">Inv No.</th>
              <th className="px-0.5 py-2 text-right font-semibold leading-tight sm:px-2">Invoice Amount</th>
              <th className="px-0.5 py-2 text-right font-semibold leading-tight sm:px-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const key = invoiceKey(invoice);
              const expanded = selectedKey === key;
              const items = itemsByInvoice[key];
              const visibleItems = items?.filter(onItemSelect ? item => Number(item.qty || 0) + Number(item.free || 0) > 0 : visibleInvoiceItem);
              return (
                <Fragment key={key}>
                  <tr
                    tabIndex={0}
                    aria-label={`${invoice.invoiceNo}, double tap to view items`}
                    aria-expanded={expanded}
                    className={`cursor-pointer border-t border-slate-200 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${expanded ? "bg-blue-50" : ""}`}
                    style={{ touchAction: "manipulation" }}
                    onDoubleClick={() => {
                      if (Date.now() - lastTouchOpen.current > 500) void openInvoice(invoice);
                    }}
                    onTouchEnd={(event) => {
                      const now = Date.now();
                      if (lastTap.current?.key === key && now - lastTap.current.at < 400) {
                        event.preventDefault();
                        lastTap.current = null;
                        lastTouchOpen.current = now;
                        void openInvoice(invoice);
                      } else {
                        lastTap.current = { key, at: now };
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openInvoice(invoice);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap px-0.5 py-2 sm:px-2">{date(invoice.invoiceDate)}</td>
                    <td className="break-all px-0.5 py-2 font-semibold text-blue-900 sm:px-2">{invoice.invoiceNo}</td>
                    <td className="whitespace-nowrap px-0.5 py-2 text-right sm:px-2">{money(invoice.amount)}</td>
                    <td className="whitespace-nowrap px-0.5 py-2 text-right sm:px-2">{time(invoice.createdAt)}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-blue-200 bg-blue-50/60">
                      <td colSpan={4} className="px-2 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="font-semibold">Items in {invoice.invoiceNo} · {date(invoice.invoiceDate)} · {money(invoice.amount)}</h3>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => void printInvoice(invoice)} disabled={printingKey !== null} className="rounded border border-blue-700 bg-blue-700 px-3 py-1 text-sm text-white disabled:opacity-50">{printingKey === key ? "Generating..." : "Print"}</button>
                            <button type="button" onClick={() => setSelectedKey(null)} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">Close</button>
                          </div>
                        </div>
                        {printError && <p role="alert" className="mb-2 text-sm text-red-700">{printError}</p>}
                        {loadingKey === key ? <p className="py-2 text-slate-600">Loading items...</p> : detailError ? <p role="alert" className="py-2 text-red-700">{detailError}</p> : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-auto border-collapse text-left text-[11px]">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  {["Item Name", "Packing", "Qty+Free", "MRP", ...(onItemSelect ? ["Retail"] : []), "Batch No.", "Expiry", "GST%", "Value"].map((heading) => (
                                    <th key={heading} className={`whitespace-nowrap px-1 py-1.5 text-xs font-semibold ${["Qty+Free", "MRP", "Retail", "GST%", "Value"].includes(heading) ? "text-right" : "text-left"}`}>{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {visibleItems?.map((item, index) => <tr key={`${item.saleDetailId}:${item.saleLocation}:${index}`}
                                  tabIndex={onItemSelect ? 0 : undefined}
                                  aria-label={onItemSelect ? `${item.itemName}, batch ${item.batchNo}, double tap to add to claim` : undefined}
                                  className={`border-t border-slate-100 ${onItemSelect ? "cursor-pointer hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" : ""}`}
                                  style={onItemSelect ? { touchAction: "manipulation" } : undefined}
                                  onDoubleClick={() => { if (onItemSelect && Date.now() - lastTouchOpen.current > 500) onItemSelect(invoice, item); }}
                                  onTouchEnd={onItemSelect ? event => {
                                    const itemKey = `${key}:${item.saleDetailId}:${item.saleLocation}:${index}`;
                                    const now = Date.now();
                                    if (lastItemTap.current?.key === itemKey && now - lastItemTap.current.at < 400) {
                                      event.preventDefault(); lastItemTap.current = null; lastTouchOpen.current = now; onItemSelect(invoice, item);
                                    } else lastItemTap.current = { key: itemKey, at: now };
                                  } : undefined}
                                  onKeyDown={onItemSelect ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onItemSelect(invoice, item); } } : undefined}
                                >
                                  <td className="min-w-36 max-w-48 px-1 py-1.5 text-xs">{item.itemName || "—"}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5 text-xs">{item.packing || "—"}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5 text-right">{quantityWithFree(item.qty, item.free)}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5 text-right">{money(item.mrp)}</td>
                                  {onItemSelect && <td className="whitespace-nowrap px-1 py-1.5 text-right">{money(item.retailRate)}</td>}
                                  <td className="whitespace-nowrap px-1 py-1.5">{item.batchNo || "—"}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5">{item.expiry || "—"}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5 text-right">{Number(item.gstPercent || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                  <td className="whitespace-nowrap px-1 py-1.5 text-right">{money(item.value)}</td>
                                </tr>)}
                                {visibleItems?.length === 0 && <tr><td colSpan={onItemSelect ? 9 : 8} className="px-2 py-3 text-slate-600">No items found for this invoice.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {invoices.length === 0 && <tr><td colSpan={4} className="px-3 py-5 text-slate-600">No purchases found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
