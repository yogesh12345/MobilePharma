import { useEffect, useState } from "react";
import API from "../services/api";
import CompaniesPage from "./CompaniesPage";
import SalesOrderPage from "./SalesOrderPage";
import RecentPurchases from "./RecentPurchases";
import type { PurchaseInvoice } from "./RecentPurchases";
import RaiseCreditNote from "./RaiseCreditNote";

type View = "home" | "companies" | "orders" | "credit" | "purchases" | "outstanding";
type Invoice = PurchaseInvoice;
type OutstandingInvoice = { invoiceNo: string; invoiceDate: string; invoiceAmount: number; balanceAmount: number };

const outstandingDate = (value: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match && match[1] !== "0000" && match[1] !== "0001"
    ? `${match[3]}/${match[2]}/${match[1].slice(2)}`
    : "—";
};
const outstandingMoney = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const outstandingStatus = (invoice: OutstandingInvoice): "PENDING" | "PART" => {
  const paid = Math.max(0, Number(invoice.invoiceAmount) - Number(invoice.balanceAmount));
  return paid <= 0.000001 ? "PENDING" : "PART";
};

const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export default function CustomerPortalPage({ linked, onOpenProfile }: { linked: boolean; onOpenProfile: () => void }) {
  const [view, setView] = useState<View>("home");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visibleView = !linked && view !== "home" && view !== "companies" ? "home" : view;

  useEffect(() => {
    if (view !== "purchases" || !linked) return;
    let active = true;
    API.get("/mobile/customer-portal/invoices")
      .then(({ data }) => { if (active) setInvoices(data.invoices ?? []); })
      .catch(() => { if (active) setError("Unable to load invoices."); });
    return () => { active = false; };
  }, [view, linked]);

  useEffect(() => {
    if (view !== "outstanding" || !linked) return;
    let active = true;
    API.get("/mobile/customer-portal/outstanding").then(({ data }) => { if (active) setOutstanding(data.invoices ?? []); })
      .catch(() => { if (active) setError("Unable to load outstanding invoices."); });
    return () => { active = false; };
  }, [view, linked]);

  return <section className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">
    {visibleView !== "home" && <button type="button" onClick={() => { setView("home"); setError(""); setMessage(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Back to home</button>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {visibleView === "home" && <>
      {!linked && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The company catalog is available now. Activate your customer profile to place orders. <button type="button" className="font-bold underline" onClick={onOpenProfile}>Open profile</button></div>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => setView("companies")} className={`${box} min-h-32 text-left font-semibold text-blue-900`}>Companies</button>
        {linked && <button type="button" onClick={() => setView("orders")} className={`${box} min-h-32 text-left font-semibold text-violet-900`}>Sales Order</button>}
        {linked && <button type="button" onClick={() => setView("credit")} className={`${box} min-h-32 text-left font-semibold text-rose-900`}>Raise credit note</button>}
        {linked && <button type="button" onClick={() => setView("purchases")} className={`${box} min-h-32 text-left font-semibold text-emerald-900`}>Recent purchases</button>}
        {linked && <button type="button" onClick={() => setView("outstanding")} className={`${box} min-h-32 text-left font-semibold text-amber-900`}>Outstanding invoices</button>}
      </div>
    </>}
    {visibleView === "companies" && <CompaniesPage canUpdateCompany={false} canUpdateRack={false} />}
    {visibleView === "orders" && linked && <SalesOrderPage customerProfileMode />}
    {visibleView === "credit" && linked && <RaiseCreditNote />}
    {visibleView === "purchases" && linked && <RecentPurchases invoices={invoices} />}
    {visibleView === "outstanding" && linked && <>
      <h2 className="text-xl font-bold">Outstanding invoices</h2>
      {outstanding.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[540px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">Invoice Date</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">Invoice No.</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Invoice Amount / Balance</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {outstanding.map((invoice, index) => {
                const status = outstandingStatus(invoice);
                const partPaid = status === "PART";
                return <tr key={`${invoice.invoiceNo}:${index}`} className={index % 2 ? "bg-slate-50/70" : "bg-white"}>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{outstandingDate(invoice.invoiceDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{invoice.invoiceNo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                    <span className="block font-semibold text-slate-900">₹{outstandingMoney(partPaid ? invoice.balanceAmount : invoice.invoiceAmount)}</span>
                    <span className="text-xs text-slate-500">{partPaid ? "Balance" : "Invoice amount"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${partPaid ? "bg-amber-100 text-amber-900" : "bg-blue-50 text-blue-800"}`}>
                      {status}
                    </span>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-500">No outstanding invoices found.</p>}
    </>}
  </section>;
}
