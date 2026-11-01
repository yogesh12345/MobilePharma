import { useEffect, useLayoutEffect, useRef, useState } from "react";
import API from "../services/api";
import CompaniesPage, { type CompaniesPageHandle } from "./CompaniesPage";
import SalesOrderPage from "./SalesOrderPage";
import RecentPurchases from "./RecentPurchases";
import type { PurchaseInvoice } from "./RecentPurchases";
import RaiseCreditNote from "./RaiseCreditNote";
import { ArrowLeftIcon, BuildingOffice2Icon, ClipboardDocumentListIcon, DocumentTextIcon, ReceiptRefundIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";

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

const task = "flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl text-center text-sm font-semibold transition hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:text-base";

export default function CustomerPortalPage({ linked, onOpenProfile }: { linked: boolean; onOpenProfile: () => void }) {
  const [view, setView] = useState<View>("home");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const outstandingListRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const companiesRef = useRef<CompaniesPageHandle>(null);
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

  useLayoutEffect(() => {
    if (visibleView !== "outstanding" || outstanding.length === 0) return;
    const updateHeight = () => {
      const list = outstandingListRef.current;
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
  }, [visibleView, outstanding.length, error, message]);

  const goHome = () => { setView("home"); setError(""); setMessage(""); };
  const footerBack = () => {
    if (visibleView === "companies" && companiesRef.current?.backToCompaniesList()) return;
    goHome();
  };

  return <section className={`mx-auto w-full max-w-3xl space-y-4 px-4 pt-1 ${visibleView === "credit" || visibleView === "companies" ? "pb-0" : visibleView === "home" ? "pb-5" : "pb-24"}`}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {visibleView === "home" && <>
      {!linked && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The company catalog is available now. Activate your customer profile to place orders. <button type="button" className="font-bold underline" onClick={onOpenProfile}>Open profile</button></div>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => setView("companies")} className={`${task} text-blue-900`}><BuildingOffice2Icon className="h-11 w-11" aria-hidden="true" /><span>Companies</span></button>
        {linked && <button type="button" onClick={() => setView("orders")} className={`${task} text-violet-900`}><ClipboardDocumentListIcon className="h-11 w-11" aria-hidden="true" /><span>Sales Order</span></button>}
        {linked && <button type="button" onClick={() => setView("credit")} className={`${task} text-rose-900`}><ReceiptRefundIcon className="h-11 w-11" aria-hidden="true" /><span>Raise credit note</span></button>}
        {linked && <button type="button" onClick={() => setView("purchases")} className={`${task} text-emerald-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>Recent purchases</span></button>}
        {linked && <button type="button" onClick={() => setView("outstanding")} className={`${task} text-amber-900`}><DocumentTextIcon className="h-11 w-11" aria-hidden="true" /><span>Outstanding invoices</span></button>}
      </div>
    </>}
    {visibleView === "companies" && <CompaniesPage ref={companiesRef} compactTop canUpdateCompany={false} canUpdateRack={false} />}
    {visibleView === "orders" && linked && <SalesOrderPage customerProfileMode onBackToHome={goHome} />}
    {visibleView === "credit" && linked && <RaiseCreditNote />}
    {visibleView === "purchases" && linked && <RecentPurchases invoices={invoices} fillViewport />}
    {visibleView === "outstanding" && linked && <>
      <h2 className="text-xl font-bold">Outstanding invoices</h2>
      {outstanding.length ? (
        <div ref={outstandingListRef} className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[540px] border-collapse text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
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
    {visibleView !== "home" && visibleView !== "orders" && <div id="customer-portal-footer" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><div className="mx-auto max-w-3xl"><button type="button" onClick={footerBack} aria-label="Back" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-blue-700 hover:bg-blue-50"><ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /><span>Back</span></button></div></div>}
  </section>;
}
