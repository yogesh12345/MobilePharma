import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import SalesOrderPage from "./SalesOrderPage";
import { ArrowLeftIcon, CheckIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTaskState } from "../hooks/useTaskState";
import { useMobileAccess } from "../context/mobileAccess";
import { openSalesOrderPdf } from "../services/invoicePdf";
type Order = { id: number; soNumber: string; soDate: string; status: string; numItems: number };
type Item = { itemId: number; itemName: string; quantity: number; freeQuantity: number };
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Unable to load or save the order.";
const formatOrderDate = (value: string) => {
 const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
 return match ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : "-";
};
export default function PortalOrders({ onBack }: { onBack: () => void }) {
 const access = useMobileAccess();
 const updateOrderStock = access.data?.account.UPDORDER2STOCK === true;
 const customerId = access.customer?.customerId ?? access.data?.selectedCustomer?.customerId;
 const [draftKey] = useState(() => {
  const storageKey = "portal-orders:stock-draft-key";
  const stored = window.sessionStorage.getItem(storageKey);
  if (stored && /^O[A-Za-z0-9]{1,9}$/.test(stored)) return stored;
  const generated = `O${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
 });
 const stockSyncRef = useRef<Promise<unknown>>(Promise.resolve());
 const [creating,setCreating] = useTaskState("portal-orders", "creating", false, (value): value is boolean => typeof value === "boolean");
 const [orders,setOrders] = useState<Order[]>([]);
 const [selected,setSelected] = useTaskState<Order | null>("portal-orders", "selected", null, (value): value is Order | null => value === null || (typeof value === "object" && value !== null && Number.isSafeInteger((value as Order).id)));
 const [items,setItems] = useTaskState<Item[]>("portal-orders", "items", [], (value): value is Item[] => Array.isArray(value));
 const [remark,setRemark] = useTaskState("portal-orders", "remark", "", (value): value is string => typeof value === "string");
 const [query,setQuery] = useState("");
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [busy,setBusy] = useState(false);
 const [viewingOrderId,setViewingOrderId] = useState<number | null>(null);
 const orderListRef = useRef<HTMLDivElement>(null);
 useLayoutEffect(() => {
  if (selected || orders.length === 0) return;
  const updateHeight = () => {
   const list = orderListRef.current;
   const footer = document.getElementById("customer-portal-footer");
   if (!list || !footer) return;
   list.style.maxHeight = `${Math.max(120, Math.floor(footer.getBoundingClientRect().top - list.getBoundingClientRect().top - 8))}px`;
  };
  updateHeight();
  window.addEventListener("resize", updateHeight);
  window.visualViewport?.addEventListener("resize", updateHeight);
  return () => {
   window.removeEventListener("resize", updateHeight);
   window.visualViewport?.removeEventListener("resize", updateHeight);
  };
 }, [selected, orders.length, error, notice]);
 const syncStock = useCallback((rows: Item[], orderId: number, clearOnly = false) => {
  if (!customerId) return Promise.reject(new Error("Customer is unavailable"));
  const next = stockSyncRef.current.catch(() => undefined).then(() => API.put("/mobile/sales-orders/stock-draft", { draftKey, customerId, orderId, clearOnly, items: rows.map(row => ({ itemId: row.itemId, qty1: row.quantity, qty2: row.freeQuantity })) }));
  stockSyncRef.current = next;
  return next;
 }, [customerId, draftKey]);
 const clearStock = (orderId: number) => {
  void syncStock([], orderId, true).catch(error => setError(errorText(error)));
 };
 useEffect(() => {
  if (!updateOrderStock || selected?.status.toUpperCase() !== "SAVED" || !customerId) return;
  void syncStock(items, selected.id).catch(error => setError(errorText(error)));
 }, [items, selected, updateOrderStock, customerId, syncStock]);
 const load = useCallback(async () => { try { const { data } = await API.get("/mobile/customer-portal/orders");setOrders(data.orders ?? []); } catch (error) { setError(errorText(error)); } }, []);
 useEffect(() => { void Promise.resolve().then(load); }, [load]);
 const open = async (order: Order) => {
  if (updateOrderStock && selected?.status.toUpperCase() === "SAVED") clearStock(selected.id);
  setBusy(true);setError("");setNotice("");
  try { const { data } = await API.get(`/mobile/customer-portal/orders/${order.id}`);setSelected({ ...order, status: String(data.order.Status ?? order.status) });setItems(data.items ?? []);setRemark(data.order.Remarks ?? ""); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 const viewPdf = async (order: Order) => {
  if (viewingOrderId !== null) return;
  setViewingOrderId(order.id);setError("");setNotice("");
  try { await openSalesOrderPdf(order.id, order.soNumber, true); }
  catch (error) { setError((error as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error || (error as Error).message || "Unable to view sales order PDF."); }
  finally { setViewingOrderId(null); }
 };
 const save = async (submit = false) => {
  if (busy || selected?.status.toUpperCase() !== "SAVED" || !items.length) return;
  setBusy(true);setError("");setNotice("");
  try { if (updateOrderStock) await syncStock(items, selected.id); await API.put(`/mobile/customer-portal/orders/${selected.id}`,{ items,remark,status: submit ? "SUBMITTED" : "SAVED",draftKey: updateOrderStock ? draftKey : undefined });setNotice(submit ? "Order submitted." : "Order updated.");setSelected(null);await load(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 const cancel = async () => {
  if (busy || selected?.status.toUpperCase() !== "SAVED") return;
  setBusy(true);setError("");setNotice("");
  try { await stockSyncRef.current.catch(() => undefined); await API.post(`/mobile/customer-portal/orders/${selected.id}/cancel`); if (updateOrderStock) clearStock(selected.id); setNotice("Order cancelled.");setSelected(null);await load(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 if (creating) return <SalesOrderPage customerProfileMode onBackToHome={() => { setCreating(false);void load(); }} />;
 const editable = selected?.status.toUpperCase() === "SAVED";
 return <section className={`mx-auto max-w-3xl space-y-4 px-1 pt-1 sm:px-4 sm:pt-4 ${editable ? "pb-32 sm:pb-24" : "pb-1 sm:pb-4"}`}>
  <h2 className="text-xl font-bold">Orders</h2>
  {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
  <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white" onClick={() => setCreating(true)}>Place a new order</button>
  {selected ? <section className="space-y-4 rounded-xl border bg-white p-4"><h3 className="font-bold">{selected.soNumber} / {selected.status}</h3>
   {editable && <GenericAutoComplete endpoint="/mobile/sales-orders/items/search" searchQuery={query} setSearchQuery={setQuery} minChars={3} mode="live" topLabel="Add an item" onSelect={item => { const id = Number(item.id);setItems(current => current.some(row => row.itemId === id) ? current : [...current,{ itemId:id,itemName:item.label1,quantity:1,freeQuantity:0 }]);setQuery(""); }} />}
   {items.map(item => <div key={item.itemId} className="space-y-2 border-t pt-3"><p className="font-semibold">{item.itemName}</p><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Quantity<input aria-label={`Quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.quantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,quantity:Number(event.target.value) } : row))} /></label><label className="text-sm">Free<input aria-label={`Free quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.freeQuantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,freeQuantity:Number(event.target.value) } : row))} /></label>{editable && <button type="button" disabled={busy} aria-label={`Remove ${item.itemName}`} title="Remove item" className="rounded-lg p-2 text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50" onClick={() => setItems(current => current.filter(row => row.itemId !== item.itemId))}><TrashIcon className="h-5 w-5" aria-hidden="true" /></button>}</div></div>)}
   <label className="block text-sm">Remark<textarea disabled={!editable || busy} className="mt-1 w-full rounded border p-2" maxLength={1000} value={remark} onChange={event => setRemark(event.target.value)} /></label>{!editable && <p className="text-sm text-slate-500">This order is already being processed and cannot be changed.</p>}
  </section> : orders.length > 0 ? (
   <div ref={orderListRef} className="overflow-auto overscroll-contain rounded-xl border border-slate-300 bg-white shadow-sm">
    <table className="w-full min-w-[350px] border-collapse text-left text-[11px] sm:text-sm">
     <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
      <tr>
       <th scope="col" className="whitespace-nowrap px-2 py-3 font-semibold sm:px-3">SO Number</th>
       <th scope="col" className="whitespace-nowrap px-2 py-3 font-semibold sm:px-3">Date</th>
       <th scope="col" className="px-2 py-3 text-center font-semibold sm:px-3">No. of Items</th>
       <th scope="col" className="px-2 py-3 font-semibold sm:px-3">Status</th>
       <th scope="col" className="px-1 py-3"><span className="sr-only">View PDF</span></th>
      </tr>
     </thead>
     <tbody className="divide-y divide-slate-200">
      {orders.map(order => <tr key={order.id} className="odd:bg-white even:bg-blue-50/70 hover:bg-blue-100/70">
       <td className="whitespace-nowrap px-2 py-1 sm:px-3"><button type="button" disabled={busy} onClick={() => void open(order)} className="py-1 text-left font-semibold text-slate-900 disabled:opacity-50">{order.soNumber}</button></td>
       <td className="whitespace-nowrap px-2 py-1 sm:px-3">{formatOrderDate(order.soDate)}</td>
       <td className="px-2 py-1 text-center tabular-nums sm:px-3">{order.numItems}</td>
       <td className="px-2 py-1 font-medium sm:px-3">{order.status}</td>
       <td className="px-1 py-1 text-center"><button type="button" disabled={viewingOrderId !== null} onClick={() => void viewPdf(order)} aria-label={`View sales order ${order.soNumber} as PDF`} title="View PDF" className="inline-grid h-9 w-9 place-items-center rounded-md text-blue-700 hover:bg-blue-100 disabled:opacity-50"><EyeIcon className="h-5 w-5" aria-hidden="true" /></button></td>
      </tr>)}
     </tbody>
    </table>
   </div>
  ) : <p className="text-slate-500">No orders yet.</p>}
  <div id="customer-portal-footer" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={() => { if (updateOrderStock && editable && selected) clearStock(selected.id); onBack(); }} aria-label="Back" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /><span>Back</span></button>{editable && <><button type="button" disabled={busy || !items.length} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50">Save changes</button><button type="button" disabled={busy || !items.length} onClick={() => void save(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white disabled:opacity-50"><CheckIcon className="h-5 w-5" aria-hidden="true" />Submit</button><button type="button" disabled={busy} onClick={() => void cancel()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-4 font-semibold text-white disabled:opacity-50"><TrashIcon className="h-5 w-5" aria-hidden="true" />Remove</button></>}</div></div>
 </section>;
}
