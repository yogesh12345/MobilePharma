import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMobileAccess } from "../context/mobileAccess";
import API from "../services/api";
import { navigationKey, readNavigation, saveNavigation } from "../services/navigationState";
import { useTaskState } from "../hooks/useTaskState";
import CompaniesPage, { type CompaniesPageHandle } from "./CompaniesPage";
import PortalOrders from "./PortalOrders";
import RecentPurchases from "./RecentPurchases";
import type { PurchaseInvoice } from "./RecentPurchases";
import RaiseCreditNote from "./RaiseCreditNote";
import ArrivalsAndSchemes from "./ArrivalsAndSchemes";
import ItemLocationPage from "./ItemLocationPage";
import CustomersPage from "./CustomersPage";
import GenericAutoComplete from "../components/GenericAutoComplete";
import PurchasesPage from "./PurchasesPage";
import StockSalesStatement from "./StockSalesStatement";
import type { CurrentStock } from "../utils/stockDisplay";
import { ArrowLeftIcon, BuildingOffice2Icon, ClipboardDocumentListIcon, DocumentTextIcon, ReceiptRefundIcon, ShoppingBagIcon, MapPinIcon, UserGroupIcon, ClockIcon } from "@heroicons/react/24/outline";

type View = "home" | "companies" | "orders" | "credit" | "purchases" | "outstanding" | "arrivals" | "rack" | "customer_information" | "recent_purchases" | "stock_statement";
type Invoice = PurchaseInvoice;
type RackTarget = { id: number; itemName: string; requestKey: number; stock?: CurrentStock | null } & (
  | { source: "purchases"; invoiceId: number; tranId: number }
  | { source: "companies" }
);
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
const savedViews: View[] = ["home", "companies", "orders", "credit", "purchases", "outstanding", "arrivals", "rack", "customer_information", "recent_purchases", "stock_statement"];

export default function CustomerPortalPage({ linked }: { linked: boolean }) {
  const access = useMobileAccess();
  const savedNavigationKey = navigationKey(access.data?.account.userId ?? 0, access.customer?.customerId ?? null);
  const [view, setView] = useState<View>(() => {
    const saved = readNavigation(savedNavigationKey).view;
    return savedViews.includes(saved as View) ? saved as View : "home";
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const outstandingListRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customerQuery, setCustomerQuery] = useTaskState("customer-portal", "customer-query", "", (value): value is string => typeof value === "string");
  const [selectingCustomer, setSelectingCustomer] = useState(false);
  const companiesRef = useRef<CompaniesPageHandle>(null);
  const rackRequestKey = useRef(0);
  const [rackTarget, setRackTarget] = useTaskState<RackTarget | null>("customer-portal", "rack-target", null, (value): value is RackTarget | null => value === null || (typeof value === "object" && value !== null && Number.isSafeInteger((value as RackTarget).id)));
  const [purchaseFocus, setPurchaseFocus] = useState<{ invoiceId: number; itemId: number; tranId: number; requestKey: number } | null>(null);
  const [companyFocus, setCompanyFocus] = useState<{ itemId: number; requestKey: number } | null>(null);
  const isInternal = access.data?.account.kind === "INTERNAL";
  const hasInternalTask = (permission: string) => isInternal && !!access.data?.taskPermissions?.includes(permission) && access.can(permission);
  const showInternalTasks = ["update_rack", "update_customer_information", "list_recent_purchases", "internal_catalog", "internal_arrivals", "company_stock_sales_statement"].some(hasInternalTask) || (!linked && (hasInternalTask("catalog") || hasInternalTask("arrivals")));
  const showCustomerTasks = ["orders", "credit_notes", "invoices", "outstanding"].some(access.can) || (access.can("catalog") && !hasInternalTask("internal_catalog")) || (access.can("arrivals") && !hasInternalTask("internal_arrivals"));
  const viewPermission: Record<Exclude<View, "home">, string> = { companies: "catalog", orders: "orders", credit: "credit_notes", purchases: "invoices", outstanding: "outstanding", arrivals: "arrivals", rack: "update_rack", customer_information: "update_customer_information", recent_purchases: "list_recent_purchases", stock_statement: "company_stock_sales_statement" };
  const internalView = view === "rack" || view === "customer_information" || view === "recent_purchases" || view === "stock_statement";
  const visibleView = view === "home" || (access.can(viewPermission[view]) && (!internalView || isInternal) && (view !== "stock_statement" || hasInternalTask("company_stock_sales_statement")) && (linked || !["orders", "credit", "purchases", "outstanding"].includes(view))) ? view : "home";
  useEffect(() => {
    saveNavigation(savedNavigationKey, { view: visibleView });
  }, [savedNavigationKey, visibleView]);
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

  const goHome = () => { setRackTarget(null); saveNavigation(savedNavigationKey, { view: "home", companyId: null }); setView("home"); setError(""); setMessage(""); };
  const returnToRackSource = (updatedRackNumber?: string) => {
    if (!rackTarget) { goHome(); return; }
    if (rackTarget.source === "purchases") {
      setPurchaseFocus({ invoiceId: rackTarget.invoiceId, itemId: rackTarget.id, tranId: rackTarget.tranId, requestKey: ++rackRequestKey.current });
      setView("recent_purchases");
    } else {
      if (updatedRackNumber !== undefined) companiesRef.current?.updateItemRack(rackTarget.id, updatedRackNumber);
      setCompanyFocus({ itemId: rackTarget.id, requestKey: ++rackRequestKey.current });
      setView("companies");
    }
    setRackTarget(null);
  };
  const footerBack = () => {
    if (visibleView === "rack" && rackTarget) { returnToRackSource(); return; }
    if (visibleView === "home" && isInternal && linked) {
      access.selectCustomer(null);
      return;
    }
    if (visibleView === "companies" && companiesRef.current?.backToCompaniesList()) return;
    goHome();
  };

  return <section className={`mx-auto w-full space-y-4 pt-1 ${visibleView === "home" ? "px-4" : "px-1 sm:px-4"} ${visibleView === "recent_purchases" ? "max-w-6xl" : "max-w-3xl"} ${["credit", "companies", "arrivals", "rack", "customer_information", "orders"].includes(visibleView) ? "pb-0" : visibleView === "home" && !(isInternal && linked) ? "pb-5" : "pb-16"}`}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {visibleView === "home" && <>
      {isInternal && <>
        {showInternalTasks &&
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {hasInternalTask("update_rack") && <button type="button" onClick={() => setView("rack")} className={`${task} text-emerald-900`}><MapPinIcon className="h-11 w-11" aria-hidden="true" /><span>Update Rack No.</span></button>}
            {hasInternalTask("update_customer_information") && <button type="button" onClick={() => setView("customer_information")} className={`${task} text-rose-900`}><UserGroupIcon className="h-11 w-11" aria-hidden="true" /><span>Update Customer Information</span></button>}
            {hasInternalTask("list_recent_purchases") && <button type="button" onClick={() => { setPurchaseFocus(null); setView("recent_purchases"); }} className={`${task} text-amber-900`}><ClockIcon className="h-11 w-11" aria-hidden="true" /><span>List Recent Purchases</span></button>}
            {hasInternalTask("company_stock_sales_statement") && <button type="button" onClick={() => setView("stock_statement")} className={`${task} text-indigo-900`}><DocumentTextIcon className="h-11 w-11" aria-hidden="true" /><span>Stock &amp; Sales Statement</span></button>}
            {(hasInternalTask("internal_catalog") || (!linked && hasInternalTask("catalog"))) && <button type="button" onClick={() => setView("companies")} className={`${task} text-blue-900`}><BuildingOffice2Icon className="h-11 w-11" aria-hidden="true" /><span>Companies and items</span></button>}
            {(hasInternalTask("internal_arrivals") || (!linked && hasInternalTask("arrivals"))) && <button type="button" onClick={() => setView("arrivals")} className={`${task} text-teal-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>New arrivals and schemes</span></button>}
          </div>}
        {!linked && hasInternalTask("search_customer") && <div className="internal-customer-search space-y-3 rounded-xl border border-blue-200 bg-white/90 p-4 shadow-sm">
          <h2 className="font-semibold text-blue-950">Search and select customer</h2>
          <GenericAutoComplete searchQuery={customerQuery} setSearchQuery={setCustomerQuery} endpoint="/mobile/customers/search" topLabel="Customer" myplacehoder="Search customer name and address" minChars={3} renderInPortal disabled={selectingCustomer} onSelect={item => {
            const id = Number(item.id);
            if (!Number.isSafeInteger(id) || id <= 0) return;
            setSelectingCustomer(true); setError("");
            void access.selectSearchedCustomer(id).catch(error => setError(error instanceof Error ? error.message : "Unable to select customer. Please try again.")).finally(() => setSelectingCustomer(false));
          }} />
          {selectingCustomer && <p role="status" className="text-sm text-slate-600">Opening customer tasks...</p>}
        </div>}
        {!linked && !!access.data?.customers.length &&
        <div className="overflow-hidden rounded-xl border border-blue-200 bg-white/90 shadow-sm">
          <h2 className="border-b border-blue-100 bg-blue-50 px-4 py-3 font-semibold text-blue-950">Assigned customers ({access.data?.customers.length ?? 0})</h2>
          <div className="max-h-[min(55dvh,34rem)] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-blue-900"><tr><th className="px-4 py-2">Customer</th><th className="hidden px-4 py-2 sm:table-cell">GST No.</th><th className="px-4 py-2 text-right">Open</th></tr></thead>
              <tbody className="divide-y divide-blue-100">
                {access.data?.customers.map(customer => <tr key={customer.customerId} className="hover:bg-blue-50"><td className="px-4 py-3 font-medium">{customer.customerName}</td><td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{customer.gstNo || "—"}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => access.selectCustomer(customer.customerId)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">Select</button></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>}
      </>}
      {!linked && !isInternal && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your account is awaiting review. You can browse companies and items while the system administrator reviews your access.</div>}
      {isInternal && linked && showInternalTasks && showCustomerTasks && <hr className="my-4 border-0 border-t border-blue-300/80" />}
      {(!isInternal || linked) && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {access.can("catalog") && !hasInternalTask("internal_catalog") && <button type="button" onClick={() => setView("companies")} className={`${task} text-blue-900`}><BuildingOffice2Icon className="h-11 w-11" aria-hidden="true" /><span>Companies</span></button>}
        {access.can("orders") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("orders")} className={`${task} text-violet-900`}><ClipboardDocumentListIcon className="h-11 w-11" aria-hidden="true" /><span>Orders</span></button>}
        {access.can("credit_notes") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("credit")} className={`${task} text-rose-900`}><ReceiptRefundIcon className="h-11 w-11" aria-hidden="true" /><span>Credit Notes</span></button>}
        {access.can("invoices") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("purchases")} className={`${task} text-emerald-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>Recent purchases</span></button>}
        {access.can("outstanding") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("outstanding")} className={`${task} text-amber-900`}><DocumentTextIcon className="h-11 w-11" aria-hidden="true" /><span>Outstanding</span></button>}
      {access.can("arrivals") && !hasInternalTask("internal_arrivals") && <button type="button" disabled={!linked} title={!linked ? "A mobile customer assignment is required" : undefined} onClick={() => setView("arrivals")} className={`${task} text-teal-900`}><ShoppingBagIcon className="h-11 w-11" aria-hidden="true" /><span>New arrivals and schemes</span></button>}
      </div>}
    </>}
    {visibleView === "arrivals" && <ArrivalsAndSchemes />}
    {visibleView === "stock_statement" && <StockSalesStatement />}
    {visibleView === "rack" && <ItemLocationPage showHeader={false} canUpdateRack={hasInternalTask("update_rack")} mobileTaskOnly rackTarget={rackTarget} onRackOperationComplete={rackTarget ? returnToRackSource : undefined} />}
    {visibleView === "customer_information" && <CustomersPage canUpdateContact />}
    {visibleView === "recent_purchases" && <PurchasesPage canUpdateRack={hasInternalTask("update_rack")} doubleTapToEditRack tableView onEditRack={(item) => {
      if (!hasInternalTask("update_rack")) return;
      setRackTarget({ source: "purchases", id: item.id, itemName: item.ItemName, invoiceId: item.invoiceId, tranId: item.tranId, requestKey: ++rackRequestKey.current });
      setView("rack");
    }} focusInvoiceId={purchaseFocus?.invoiceId} focusItemId={purchaseFocus?.itemId} focusTranId={purchaseFocus?.tranId} focusRequestKey={purchaseFocus?.requestKey} />}
    {(visibleView === "companies" || (visibleView === "rack" && rackTarget?.source === "companies")) && <div className={visibleView === "companies" ? "" : "hidden"} aria-hidden={visibleView !== "companies"}>
      <CompaniesPage ref={companiesRef} navigationStateKey={savedNavigationKey} compactTop showItemSearch={isInternal} canUpdateCompany={false} canUpdateRack={hasInternalTask("update_rack")} doubleTapToEditRack focusItemId={companyFocus?.itemId} focusRequestKey={companyFocus?.requestKey} onEditRack={(item) => {
        if (!hasInternalTask("update_rack")) return;
        setRackTarget({ source: "companies", id: item.id, itemName: item.ItemName, stock: item.stock, requestKey: ++rackRequestKey.current });
        setView("rack");
      }} />
    </div>}
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
