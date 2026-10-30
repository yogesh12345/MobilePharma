import { Fragment, useRef, useState } from "react";
import API from "../services/api";

export type PurchaseInvoice = {
  id: number;
  invoiceYear: number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  totalGST: number;
  amount: number;
  status: string;
};

type InvoiceItem = {
  itemName: string;
  packing: string;
  qty: number;
  free: number;
  mrp: number;
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
const quantity = (value: number) => Number(value || 0).toLocaleString("en-IN");
const quantityWithFree = (qty: number, free: number) =>
  Number(free || 0) !== 0 ? `${quantity(qty)}+${quantity(free)}` : quantity(qty);
const visibleInvoiceItem = (item: InvoiceItem) =>
  Math.round(Math.abs(Number(item.value || 0)) * 100) !== 0 &&
  (Number(item.qty || 0) !== 0 || Number(item.free || 0) !== 0);
const invoiceKey = (invoice: PurchaseInvoice) => `${invoice.invoiceYear}:${invoice.id}`;

export default function RecentPurchases({ invoices }: { invoices: PurchaseInvoice[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItem[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const lastTap = useRef<{ key: string; at: number } | null>(null);
  const lastTouchOpen = useRef(0);
  const pendingKeys = useRef(new Set<string>());

  const openInvoice = async (invoice: PurchaseInvoice) => {
    const key = invoiceKey(invoice);
    setSelectedKey(key);
    setDetailError("");
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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Recent purchases</h2>
        <p className="mt-1 text-sm text-slate-600">Double tap an invoice to view its items. On a keyboard, press Enter.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[670px] w-full border-collapse text-left text-xs sm:text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">Invoice Date</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">Invoice No.</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total GST</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Invoice Amount</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">Due Date</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const key = invoiceKey(invoice);
              const expanded = selectedKey === key;
              const items = itemsByInvoice[key];
              const visibleItems = items?.filter(visibleInvoiceItem);
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
                    <td className="whitespace-nowrap px-2 py-2">{date(invoice.invoiceDate)}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-semibold text-blue-900">{invoice.invoiceNo}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{money(invoice.totalGST)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{money(invoice.amount)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{date(invoice.dueDate)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{invoice.status || "—"}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-blue-200 bg-blue-50/60">
                      <td colSpan={6} className="p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="font-semibold">Items in {invoice.invoiceNo} · {date(invoice.invoiceDate)} · {money(invoice.amount)}</h3>
                          <button type="button" onClick={() => setSelectedKey(null)} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">Close</button>
                        </div>
                        {loadingKey === key ? <p className="py-2 text-slate-600">Loading items...</p> : detailError ? <p role="alert" className="py-2 text-red-700">{detailError}</p> : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="min-w-[710px] w-full text-left text-[11px]">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  {["Item Name", "Packing", "Qty+Free", "MRP", "Batch No.", "Expiry", "GST%", "Value"].map((heading) => (
                                    <th key={heading} className={`whitespace-nowrap px-2 py-1.5 text-xs font-semibold ${["Qty+Free", "MRP", "GST%", "Value"].includes(heading) ? "text-right" : "text-left"}`}>{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {visibleItems?.map((item, index) => <tr key={index} className="border-t border-slate-100">
                                  <td className="min-w-36 max-w-48 px-2 py-1.5 text-xs">{item.itemName || "—"}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{item.packing || "—"}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{quantityWithFree(item.qty, item.free)}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{money(item.mrp)}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5">{item.batchNo || "—"}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5">{item.expiry || "—"}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{Number(item.gstPercent || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{money(item.value)}</td>
                                </tr>)}
                                {visibleItems?.length === 0 && <tr><td colSpan={8} className="px-2 py-3 text-slate-600">No billable items found for this invoice.</td></tr>}
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
            {invoices.length === 0 && <tr><td colSpan={6} className="px-3 py-5 text-slate-600">No purchases found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
