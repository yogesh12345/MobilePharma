import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import API from "../services/api";
import CompaniesPage from "./CompaniesPage";
import SalesOrderPage from "./SalesOrderPage";
import RecentPurchases from "./RecentPurchases";
import type { PurchaseInvoice } from "./RecentPurchases";

type View = "home" | "companies" | "orders" | "credit" | "purchases" | "outstanding";
type Invoice = PurchaseInvoice;
type CreditRequest = { id: number; invoiceNo: string; reason: string; status: string };
type OutstandingInvoice = { invoiceNo: string; invoiceDate: string; dueDate: string | null; balanceAmount: number };

const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function CustomerPortalPage({ linked, onOpenProfile }: { linked: boolean; onOpenProfile: () => void }) {
  const [view, setView] = useState<View>("home");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const [invoiceKey, setInvoiceKey] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visibleView = !linked && view !== "home" && view !== "companies" ? "home" : view;

  useEffect(() => {
    if ((view !== "credit" && view !== "purchases") || !linked) return;
    let active = true;
    Promise.all([API.get("/mobile/customer-portal/invoices"), view === "credit" ? API.get("/mobile/customer-portal/credit-note-requests") : Promise.resolve(null)])
      .then(([invoiceResult, requestResult]) => {
        if (!active) return;
        setInvoices(invoiceResult.data.invoices ?? []);
        if (requestResult) setRequests(requestResult.data.requests ?? []);
      }).catch(() => { if (active) setError("Unable to load invoices or requests."); });
    return () => { active = false; };
  }, [view, linked]);

  useEffect(() => {
    if (view !== "outstanding" || !linked) return;
    let active = true;
    API.get("/mobile/customer-portal/outstanding").then(({ data }) => { if (active) setOutstanding(data.invoices ?? []); })
      .catch(() => { if (active) setError("Unable to load outstanding invoices."); });
    return () => { active = false; };
  }, [view, linked]);

  const raiseCreditRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const [invoiceYear, invoiceId] = invoiceKey.split(":").map(Number);
      await API.post("/mobile/customer-portal/credit-note-requests", { invoiceId, invoiceYear, reason });
      setInvoiceKey(""); setReason(""); setMessage("Credit note request submitted for review.");
      const list = await API.get("/mobile/customer-portal/credit-note-requests"); setRequests(list.data.requests ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? "Unable to submit request.");
    } finally { setBusy(false); }
  };

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
    {visibleView === "credit" && linked && <><h2 className="text-xl font-bold">Raise a credit note request</h2><form onSubmit={raiseCreditRequest} className={`${box} space-y-4`}><p className="text-sm text-slate-600">Select one of your invoices and describe the issue. Your request will be reviewed before a credit note is issued.</p><select required className={input} value={invoiceKey} onChange={e => setInvoiceKey(e.target.value)}><option value="">Select invoice</option>{invoices.map(invoice => <option key={`${invoice.invoiceYear}:${invoice.id}`} value={`${invoice.invoiceYear}:${invoice.id}`}>{invoice.invoiceNo} · ₹{Number(invoice.amount).toLocaleString("en-IN")}</option>)}</select><textarea required minLength={10} maxLength={1000} rows={4} className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for credit note request" /><button disabled={busy} type="submit" className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Submitting..." : "Submit request"}</button></form><h3 className="font-bold">Recent requests</h3><div className="space-y-2">{requests.map(request => <div className={box} key={request.id}><strong>{request.invoiceNo}</strong><span className="ml-2 text-sm text-slate-600">{request.status}</span><p className="mt-1 text-sm">{request.reason}</p></div>)}{!requests.length && <p className="text-sm text-slate-500">No requests yet.</p>}</div></>}
    {visibleView === "purchases" && linked && <RecentPurchases invoices={invoices} />}
    {visibleView === "outstanding" && linked && <><h2 className="text-xl font-bold">Outstanding invoices</h2><div className="space-y-2">{outstanding.map((invoice, index) => <div className={box} key={`${invoice.invoiceNo}:${index}`}><strong>{invoice.invoiceNo}</strong><span className="ml-2 text-sm text-slate-600">Due {invoice.dueDate?.slice(0, 10) ?? "—"}</span><span className="block text-sm font-semibold">Balance ₹{Number(invoice.balanceAmount).toLocaleString("en-IN")}</span></div>)}{!outstanding.length && <p className="text-sm text-slate-500">No outstanding invoices found.</p>}</div></>}
  </section>;
}
