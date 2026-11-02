import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMobileAccess } from "../context/mobileAccess";
import API from "../services/api";
import CompaniesPage, { type CompaniesPageHandle } from "./CompaniesPage";
import PortalOrders from "./PortalOrders";
import RecentPurchases from "./RecentPurchases";
import type { PurchaseInvoice } from "./RecentPurchases";
import RaiseCreditNote from "./RaiseCreditNote";
import ArrivalsAndSchemes from "./ArrivalsAndSchemes";
import ItemLocationPage from "./ItemLocationPage";
import CustomersPage from "./CustomersPage";
import PurchasesPage from "./PurchasesPage";
import { ArrowLeftIcon, BuildingOffice2Icon, ClipboardDocumentListIcon, DocumentTextIcon, ReceiptRefundIcon, ShoppingBagIcon, MapPinIcon, UserGroupIcon, ClockIcon } from "@heroicons/react/24/outline";

type View = "home" | "companies" | "orders" | "credit" | "purchases" | "outstanding" | "arrivals" | "rack" | "customer_information" | "recent_purchases";
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

const task = "flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl text-center text-sm font-semibold transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:text-base";

export default function CustomerPortalPage({ linked }: { linked: boolean }) {
  const access = useMobileAccess();
  const [view, setView] = useState<View>("home");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const outstandingListRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const companiesRef = useRef<CompaniesPageHandle>(null);
  const isInternal = access.data?.account.kind === "INTERNAL";
  const viewPermission: Record<Exclude<View, "home">, string> = { companies: "catalog", orders: "orders", credit: "credit_notes", purchases: "invoices", outstanding: "outstanding", arrivals: "arrivals", rack: "update_rack", customer_information: "update_customer_information", recent_purchases: "list_recent_purchases" };
  const internalView = view === "rack" || view === "customer_information" || view === "recent_purchases";
  const visibleView = view === "home" || (access.can(viewPermission[view]) && (!internalView || access.data?.account.kind === "INTERNAL")) ? view : "home";
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
    if (visibleView === "home" && isInternal && linked) {
      access.selectCustomer(null);
      return;
    }
    if (visibleView === "companies" && companiesRef.current?.backToCompaniesList()) return;
    goHome();
  };

  return <section className={`mx-auto w-full space-y-4 px-4 pt-1 ${visibleView === "recent_purchases" ? "max-w-6xl" : "max-w-3xl"} ${visibleView === "credit" || visibleView === "companies" || visibleView === "arrivals" ? "pb-0" : visibleView === "home" && !(isInternal && linked) ? "pb-5" : "pb-24"}`}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {visibleView === "home" && <>
      {isInternal && !linked && <>
        {(access.can("update_rack") || access.can("update_customer_information") || access.can("list_recent_purchases")) &&
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {access.can("update_rack") && <button type="button" onClick={() => setView("rack")} className={`${task} text-emerald-900`}><MapPinIcon className="h-11 w-11" aria-hidden="true" /><span>Update Rack No.</span></button>}
            {access.can("update_customer_information") && <button type="button" onClick={() => setView("customer_information")} className={`${task} text-rose-900`}><UserGroupIcon className="h-11 w-11" aria-hidden="true" /><span>Update Customer Information</span></button>}
            {access.can("list_recent_purchases") && <button type="button" onClick={() => setView("recent_purchases")} className={`${task} text-amber-900`}><ClockIcon className="h-11 w-11" aria-hidden="true" /><span>List Recent Purchases</span></button>}
          </div>}
        <div className="overflow-hidden rounded-xl border border-blue-200 bg-white/90 shadow-sm">
          <h2 className="border-b border-blue-100 bg-blue-50 px-4 py-3 font-semibold text-blue-950">Assigned customers ({access.data?.customers.length ?? 0})</h2>
          <div className="max-h-[min(55dvh,34rem)] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-blue-900"><tr><th className="px-4 py-2">Customer</th><th className="hidden px-4 py-2 sm:table-cell">GST No.</th><th className="px-4 py-2 text-right">Open</th></tr></thead>
              <tbody className="divide-y divide-blue-100">
                {access.data?.customers.map(customer => <tr key={customer.customerId} className="hover:bg-blue-50"><td className="px-4 py-3 font-medium">{customer.customerName}</td><td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{customer.gstNo || "—"}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => access.selectCustomer(customer.customerId)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">Select</button></td></tr>)}
                {!access.data?.customers.length && <tr><td colSpan={3} className="px-4 py-5 text-slate-600">No active customers are assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>}
      {!linked && !isInternal && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your account is awaiting review. You can browse companies and items while the system administrator reviews your access.</div>}
      {(!isInternal || linked) && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {access.can("catalog") && <button type="button" onClick={() => setView("companies")} className={`${task} text-blue-900`}><BuildingOffice2Icon className="h-11 w-11" aria-hidden="true" /><span>Companies</span></button>}
        {access.can("orders") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("orders")} className={`${task} text-violet-900`}><ClipboardDocumentListIcon className="h-11 w-11" aria-hidden="true" /><span>Orders</span></button>}
        {access.can("credit_notes") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("credit")} className={`${task} text-rose-900`}><ReceiptRefundIcon className="h-11 w-11" aria-hidden="true" /><span>Credit Notes</span></button>}
        {access.can("invoices") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("purchases")} className={`${task} text-emerald-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>Recent purchases</span></button>}
        {access.can("outstanding") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("outstanding")} className={`${task} text-amber-900`}><DocumentTextIcon className="h-11 w-11" aria-hidden="true" /><span>Outstanding</span></button>}
      {access.can("arrivals") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("arrivals")} className={`${task} text-teal-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>New arrivals and schemes</span></button>}
      </div>}
    </>}
    {visibleView === "arrivals" && <ArrivalsAndSchemes />}
    {visibleView === "rack" && <ItemLocationPage showHeader={false} canUpdateRack />}
    {visibleView === "customer_information" && <CustomersPage canUpdateContact />}
    {visibleView === "recent_purchases" && <PurchasesPage canUpdateRack={false} tableView />}
    {visibleView === "companies" && <CompaniesPage ref={companiesRef} compactTop canUpdateCompany={false} canUpdateRack={false} />}
    {visibleView === "orders" && linked && <PortalOrders onBack={goHome} />}
    {visibleView === "credit" && linked && <RaiseCreditNote />}
    {visibleView === "purchases" && linked && <RecentPurchases invoices={invoices} fillViewport />}
    {visibleView === "outstanding" && linked && <>
      <h2 className="text-xl font-bold">Outstandings</h2>
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
                    <span className="block font-semibold text-slate-900">{outstandingMoney(partPaid ? invoice.balanceAmount : invoice.invoiceAmount)}</span>
                    {partPaid && <span className="text-xs text-slate-500">Balance</span>}
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
    {(visibleView !== "home" || (isInternal && linked)) && visibleView !== "orders" && <div id="customer-portal-footer" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><div className="mx-auto max-w-3xl"><button type="button" onClick={footerBack} aria-label="Back" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-blue-700 hover:bg-blue-50"><ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /><span>Back</span></button></div></div>}
  </section>;
}
