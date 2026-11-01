import { useCallback, useEffect, useState } from "react";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import SalesOrderPage from "./SalesOrderPage";
type Order = { id: number; soNumber: string; soDate: string; status: string; numItems: number };
type Item = { itemId: number; itemName: string; quantity: number; freeQuantity: number };
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Unable to load or save the order.";
export default function PortalOrders({ onBack }: { onBack: () => void }) {
 const [creating,setCreating] = useState(false);
 const [orders,setOrders] = useState<Order[]>([]);
 const [selected,setSelected] = useState<Order | null>(null);
 const [items,setItems] = useState<Item[]>([]);
 const [remark,setRemark] = useState("");
 const [query,setQuery] = useState("");
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [busy,setBusy] = useState(false);
 const load = useCallback(async () => { try { const { data } = await API.get("/mobile/customer-portal/orders");setOrders(data.orders ?? []); } catch (error) { setError(errorText(error)); } }, []);
 useEffect(() => { void Promise.resolve().then(load); }, [load]);
 const open = async (order: Order) => {
  setBusy(true);setError("");setNotice("");
  try { const { data } = await API.get(`/mobile/customer-portal/orders/${order.id}`);setSelected(order);setItems(data.items ?? []);setRemark(data.order.Remarks ?? ""); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 const save = async () => {
  if (!selected) return;
  setBusy(true);setError("");setNotice("");
  try { await API.put(`/mobile/customer-portal/orders/${selected.id}`,{ items,remark });setNotice("Order updated.");setSelected(null);await load(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
 };
 if (creating) return <SalesOrderPage customerProfileMode onBackToHome={() => { setCreating(false);void load(); }} />;
 const editable = selected && ["SUBMITTED","SAVED"].includes(selected.status);
 return <section className="mx-auto max-w-3xl space-y-4 px-3 py-4">
  <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Orders</h2><button className="text-blue-700 underline" onClick={onBack}>Back</button></div>
  {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
  <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white" onClick={() => setCreating(true)}>Place a new order</button>
  {selected ? <section className="space-y-4 rounded-xl border bg-white p-4"><h3 className="font-bold">{selected.soNumber} / {selected.status}</h3>
   {editable && <GenericAutoComplete endpoint="/mobile/sales-orders/items/search" searchQuery={query} setSearchQuery={setQuery} minChars={3} mode="live" topLabel="Add an item" onSelect={item => { const id = Number(item.id);setItems(current => current.some(row => row.itemId === id) ? current : [...current,{ itemId:id,itemName:item.label1,quantity:1,freeQuantity:0 }]);setQuery(""); }} />}
   {items.map(item => <div key={item.itemId} className="space-y-2 border-t pt-3"><p className="font-semibold">{item.itemName}</p><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Quantity<input aria-label={`Quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.quantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,quantity:Number(event.target.value) } : row))} /></label><label className="text-sm">Free<input aria-label={`Free quantity for ${item.itemName}`} disabled={!editable || busy} className="mt-1 block w-24 rounded border px-2 py-2" type="number" min={0} max={10000} value={item.freeQuantity} onChange={event => setItems(current => current.map(row => row.itemId === item.itemId ? { ...row,freeQuantity:Number(event.target.value) } : row))} /></label>{editable && <button disabled={busy} className="py-2 text-red-700 underline" onClick={() => setItems(current => current.filter(row => row.itemId !== item.itemId))}>Remove</button>}</div></div>)}
   <label className="block text-sm">Remark<textarea disabled={!editable || busy} className="mt-1 w-full rounded border p-2" maxLength={1000} value={remark} onChange={event => setRemark(event.target.value)} /></label><div className="flex gap-3">{editable && <button disabled={busy || !items.length} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => void save()}>Save changes</button>}<button className="rounded border px-4 py-2" onClick={() => setSelected(null)}>Close</button></div>{!editable && <p className="text-sm text-slate-500">This order is already being processed and cannot be changed.</p>}
  </section> : <section className="space-y-2">{orders.map(order => <button key={order.id} disabled={busy} className="flex w-full justify-between gap-3 rounded-xl border bg-white p-4 text-left" onClick={() => void open(order)}><span><strong className="block">{order.soNumber}</strong><span className="text-sm text-slate-500">{order.soDate?.slice(0,10)} / {order.numItems} items</span></span><span className="text-sm font-semibold">{order.status}</span></button>)}{!orders.length && <p className="text-slate-500">No orders yet.</p>}</section>}
 </section>;
}
