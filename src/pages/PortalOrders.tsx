import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import SalesOrderPage from "./SalesOrderPage";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useTaskState } from "../hooks/useTaskState";
import { useMobileAccess } from "../context/mobileAccess";
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
 const save = async () => {
  if (selected?.status.toUpperCase() !== "SAVED") return;
  setBusy(true);setError("");setNotice("");
  try { if (updateOrderStock) await syncStock(items, selected.id); await API.put(`/mobile/customer-portal/orders/${selected.id}`,{ items,remark,draftKey: updateOrderStock ? draftKey : undefined });setNotice("Order updated.");setSelected(null);await load(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 if (creating) return <SalesOrderPage customerProfileMode onBackToHome={() => { setCreating(false);void load(); }} />;
 const editable = selected?.status.toUpperCase() === "SAVED";
 return <section className="mx-auto max-w-3xl space-y-4 px-1 py-1 sm:px-4 sm:py-4">
  <h2 className="text-xl font-bold">Orders</h2>
  {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
  <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white" onClick={() => setCreating(true)}>Place a new order</button>
  {selected ? <section className="space-y-4 rounded-xl border bg-white p-4"><h3 className="font-bold">{selected.soNumber} / {selected.status}</h3>
   {editable && <GenericAutoComplete endpoint="/mobile/sales-orders/items/search" searchQuery={query} setSearchQuery={setQuery} minChars={3} mode="live" topLabel="Add an item" onSelect={item => { const id = Number(item.id);setItems(current => current.some(row => row.itemId === id) ? current : [...current,{ itemId:id,itemName:item.label1,quantity:1,freeQuantity:0 }]);setQuery(""); }} />}
   {items.map(item => <div key={item.itemId} className="space-y-2 border-t pt-3"><p className="font-semibold">{item.itemName}</p><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Quantity<input aria-label={`Quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.quantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,quantity:Number(event.target.value) } : row))} /></label><label className="text-sm">Free<input aria-label={`Free quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.freeQuantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,freeQuantity:Number(event.target.value) } : row))} /></label>{editable && <button disabled={busy} className="py-2 text-red-700 underline" onClick={() => setItems(current => current.filter(row => row.itemId !== item.itemId))}>Remove</button>}</div></div>)}
   <label className="block text-sm">Remark<textarea disabled={!editable || busy} className="mt-1 w-full rounded border p-2" maxLength={1000} value={remark} onChange={event => setRemark(event.target.value)} /></label><div className="flex gap-3">{editable && <button disabled={busy || !items.length} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => void save()}>Save changes</button>}<button className="rounded border px-4 py-2" onClick={() => { if (updateOrderStock && editable) clearStock(selected.id); setSelected(null); }}>Close</button></div>{!editable && <p className="text-sm text-slate-500">This order is already being processed and cannot be changed.</p>}
  </section> : <section className="space-y-2 overflow-x-auto">
   {orders.length > 0 && (
    <div className="grid min-w-[31rem] grid-cols-[minmax(9rem,1.5fr)_minmax(5rem,0.8fr)_minmax(6rem,0.7fr)_minmax(5rem,0.8fr)] gap-3 px-4 text-xs font-semibold text-slate-600 sm:text-sm">
     <span>SO Number</span><span>Date</span><span>No. of Items</span><span>Status</span>
    </div>
   )}
   {orders.map(order => (
    <button
     key={order.id}
     type="button"
     disabled={busy}
     className="grid w-full min-w-[31rem] grid-cols-[minmax(9rem,1.5fr)_minmax(5rem,0.8fr)_minmax(6rem,0.7fr)_minmax(5rem,0.8fr)] items-center gap-3 rounded-xl border bg-white p-4 text-left text-xs sm:text-sm"
     onClick={() => void open(order)}
    >
     <strong className="whitespace-nowrap">{order.soNumber}</strong>
     <span className="whitespace-nowrap">{formatOrderDate(order.soDate)}</span>
     <span>{order.numItems}</span>
     <span className="whitespace-nowrap font-semibold">{order.status}</span>
    </button>
   ))}
   {!orders.length && <p className="text-slate-500">No orders yet.</p>}
  </section>}
  <div id="customer-portal-footer" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><div className="mx-auto max-w-3xl"><button type="button" onClick={() => { if (updateOrderStock && editable && selected) clearStock(selected.id); onBack(); }} aria-label="Back" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-blue-700 hover:bg-blue-50"><ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /><span>Back</span></button></div></div>
 </section>;
}
