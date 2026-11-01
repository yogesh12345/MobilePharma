import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import FloatingLabelDecimalInput from "../components/FloatingLabelDecimalInput";
import FloatingLabelInput from "../components/FloatingLabelInput";
import FloatingLabelSelect from "../components/FloatingLabelSelect";
import FloatingLabelShow from "../components/FloatingLabelShow";
import RecentPurchases from "./RecentPurchases";
import type { InvoiceItem, PurchaseInvoice } from "./RecentPurchases";

type Reason = "Expired" | "Near Expiry" | "Breakage" | "Spoiled" | "Rate Difference";
type Batch = { batSrNo: number; batchNo: string; mrp: number; expiry: string; retailRate: number; gstPercent: number };
type ClaimItem = { key: string; source: "invoice" | "manual"; invoiceId?: number; invoiceYear?: number; invoiceNo?: string; saleDetailId?: number; saleLocation?: number; itemId: number; itemName: string; batchNo: string; batSrNo: number; mrp: number; expiry: string; retailRate: number; gstPercent: number; invoiceQty1?: number; invoiceQty2?: number; quantity: number; reason: Reason | ""; reductionPercent: number };
type Claim = { id: number; claimNo: string; claimDate: string; status: string; claimAmount: number; includeGst: boolean; items?: Omit<ClaimItem, "key">[] };
type Config = { claimDate: string; sequenceMode: string; suggestedClaimNo: string };
const reasons: Reason[] = ["Expired", "Near Expiry", "Breakage", "Spoiled", "Rate Difference"];
const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
const money = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const claimValue = (item: ClaimItem) => round(round(item.quantity * item.retailRate) * (1 - item.reductionPercent / 100));
const errorText = (e: unknown, fallback: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;

export default function RaiseCreditNote() {
  const containerRef = useRef<HTMLElement>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualItem, setManualItem] = useState<{ id: number; name: string } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [includeGst, setIncludeGst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    const updateHeight = () => {
      const container = containerRef.current;
      const footer = document.getElementById("customer-portal-footer");
      if (!container || !footer) return;
      container.style.maxHeight = `${Math.max(120, Math.floor(footer.getBoundingClientRect().top - container.getBoundingClientRect().top - 8))}px`;
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, []);

  const load = async () => {
    const [a, b, c] = await Promise.all([API.get("/mobile/customer-portal/claims/config"), API.get("/mobile/customer-portal/invoices", { params: { forClaim: 1 } }), API.get("/mobile/customer-portal/claims")]);
    setConfig(a.data); setInvoices(b.data.invoices ?? []); setClaims(c.data.claims ?? []);
  };
  useEffect(() => { let active = true; Promise.all([API.get("/mobile/customer-portal/claims/config"), API.get("/mobile/customer-portal/invoices", { params: { forClaim: 1 } }), API.get("/mobile/customer-portal/claims")]).then(([a, b, c]) => { if (active) { setConfig(a.data); setInvoices(b.data.invoices ?? []); setClaims(c.data.claims ?? []); } }).catch(e => { if (active) setError(errorText(e, "Unable to load claim information.")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const addInvoiceItem = (invoice: PurchaseInvoice, row: InvoiceItem) => {
    const key = `invoice:${invoice.invoiceYear}:${invoice.id}:${row.saleDetailId}:${row.saleLocation}`;
    if (items.some(item => item.key === key)) { document.getElementById(`credit-claim-qty-${key}`)?.focus(); setError("This invoice item is already in the claim. Edit its quantity below."); return; }
    if (!row.saleDetailId || !row.itemId || !row.batSrNo) { setError("This invoice item has incomplete batch details."); return; }
    const available = Math.floor(Number(row.qty || 0) + Number(row.free || 0));
    if (available <= 0) { setError("This invoice item has no whole units available to claim."); return; }
    setItems(current => [...current, { key, source: "invoice", invoiceId: invoice.id, invoiceYear: invoice.invoiceYear, invoiceNo: invoice.invoiceNo, saleDetailId: row.saleDetailId, saleLocation: row.saleLocation, itemId: row.itemId, itemName: row.itemName, batchNo: row.batchNo, batSrNo: row.batSrNo, mrp: Number(row.mrp), expiry: row.expiry, retailRate: Number(row.retailRate), gstPercent: Number(row.gstPercent), invoiceQty1: Number(row.qty), invoiceQty2: Number(row.free), quantity: Math.min(1, available), reason: "", reductionPercent: 0 }]); setError("");
    window.setTimeout(() => document.getElementById(`credit-claim-qty-${key}`)?.focus(), 0);
  };
  const selectManualItem = async (result: { id: string | number; label1: string }) => {
    const id = Number(result.id); setManualItem({ id, name: result.label1 }); setManualQuery(result.label1); setBatches([]); setSelectedBatch(""); setError("");
    try { const { data } = await API.get(`/mobile/customer-portal/claims/items/${id}/batches`); setBatches(data.batches ?? []); }
    catch (e) { setError(errorText(e, "Unable to load item batches.")); }
  };
  const addManualItem = () => {
    const batch = batches.find(b => String(b.batSrNo) === selectedBatch);
    if (!manualItem || !batch) { setError("Select an item and batch first."); return; }
    setItems(current => [...current, { key: `manual:${Date.now()}:${Math.random()}`, source: "manual", itemId: manualItem.id, itemName: manualItem.name, batchNo: batch.batchNo, batSrNo: batch.batSrNo, mrp: Number(batch.mrp), expiry: batch.expiry, retailRate: Number(batch.retailRate), gstPercent: Number(batch.gstPercent), quantity: 1, reason: "", reductionPercent: 0 }]);
    setManualItem(null); setManualQuery(""); setBatches([]); setSelectedBatch(""); setError("");
  };
  const patchItem = (key: string, patch: Partial<ClaimItem>) => setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
  const totals = useMemo(() => items.reduce((sum, item) => { const base = claimValue(item); return { base: round(sum.base + base), gst: round(sum.gst + round(base * item.gstPercent / 100)) }; }, { base: 0, gst: 0 }), [items]);
  const submit = async () => {
    setError(""); setSuccess("");
    if (!items.length) { setError("Add at least one item to the claim."); return; }
    for (const item of items) { const limit = (item.invoiceQty1 ?? 0) + (item.invoiceQty2 ?? 0); if (!Number.isInteger(item.quantity) || item.quantity <= 0 || (item.source === "invoice" && item.quantity > limit)) { setError(`Enter a whole-number claim quantity for ${item.itemName}${item.source === "invoice" ? ` (maximum ${Math.floor(limit)})` : ""}.`); return; } if (!item.reason) { setError(`Select a claim reason for ${item.itemName}.`); return; } if (!Number.isFinite(item.reductionPercent) || item.reductionPercent < 0 || item.reductionPercent > 100) { setError(`Enter a reduction percentage from 0 to 100 for ${item.itemName}.`); return; } }
    setBusy(true);
    try { const payload = { includeGst, items: items.map(({ source, invoiceId, invoiceYear, saleDetailId, saleLocation, itemId, itemName, batSrNo, quantity, reason, reductionPercent }) => ({ source, invoiceId, invoiceYear, saleDetailId, saleLocation, itemId, itemName, batSrNo, quantity, reason, reductionPercent })) }; const { data } = editingClaim ? await API.put(`/mobile/customer-portal/claims/${editingClaim.id}`,payload) : await API.post("/mobile/customer-portal/claims",payload); setEditingClaim(null); setSuccess(`Claim ${data.claim.claimNo} submitted for review.`); setItems([]); try { await load(); } catch { setError("Claim submitted, but the recent claims list could not be refreshed."); } }
    catch (e) { setError(errorText(e, "Unable to submit the claim.")); }
    finally { setBusy(false); }
  };

  return <section ref={containerRef} className="space-y-5 overflow-y-auto overscroll-contain">
    <div><h2 className="text-xl font-bold">{editingClaim ? `Update claim ${editingClaim.claimNo}` : "Raise a credit note claim"}</h2>{editingClaim && <button type="button" className="text-sm text-blue-700 underline" onClick={() => { setEditingClaim(null);setItems([]); }}>Cancel editing</button>}<p className="text-sm text-slate-600">Add products from an invoice in the last six months, or search for an older item and choose its batch. Claims are submitted for review.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
    {loading ? <p>Loading claim details...</p> : <>
      <div className={`${box} flex flex-wrap items-center gap-x-8 gap-y-2 text-sm`}><div className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-slate-500">Claim date:</span><strong>{config?.claimDate ?? "—"}</strong></div><div className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-slate-500">Claim No.:</span><strong>{config?.suggestedClaimNo ?? "—"}</strong></div><p className="w-full text-xs text-slate-500">Sequence resets {config?.sequenceMode === "financial_year" ? "each financial year" : "monthly"}. The final number is assigned on submit.</p></div>
      <div className={box}>
        <h3 className="mb-2 font-bold">A. Select from recent invoices</h3>
        <div className="pt-3"><FloatingLabelInput id="credit-invoice-search" label="Search invoices" type="search" className={input} value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Invoice number or date" /></div>
        <div className="mt-3"><RecentPurchases
          invoices={invoices.filter(invoice => `${invoice.invoiceNo} ${invoice.invoiceDate}`.toLowerCase().includes(invoiceSearch.toLowerCase()))}
          onItemSelect={addInvoiceItem}
          title="Invoices from the last six months"
        /></div>
      </div>
      <div className={box}><h3 className="mb-2 font-bold">B. Search an item and batch</h3><GenericAutoComplete endpoint="/mobile/sales-orders/items/search" searchQuery={manualQuery} setSearchQuery={value => { setManualQuery(value); if (manualItem && value !== manualItem.name) { setManualItem(null); setBatches([]); setSelectedBatch(""); } }} onSelect={selectManualItem} minChars={3} mode="live" topLabel="Search item" myplacehoder="Type at least 3 characters" />{manualItem && <div className="mt-4 space-y-3"><FloatingLabelSelect id="credit-claim-batch" label="Batch" value={selectedBatch} onChange={setSelectedBatch} placeholder="Select batch" options={batches.map(batch => ({ value: String(batch.batSrNo), label: `${batch.batchNo} · Exp ${batch.expiry || "—"}` }))} className="min-h-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-900" />{selectedBatch && (() => { const batch = batches.find(b => String(b.batSrNo) === selectedBatch); return batch ? <p className="text-sm text-slate-600">MRP ₹{money(batch.mrp)} · Retail ₹{money(batch.retailRate)} · GST {batch.gstPercent}%</p> : null; })()}<button type="button" onClick={addManualItem} disabled={!selectedBatch} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add to claim</button>{!batches.length && <p className="text-sm text-slate-500">No batches available for this item.</p>}</div>}</div>
      <div className={box}>
        <h3 className="mb-3 font-bold">Claim items ({items.length})</h3>
        <div className="space-y-3">
          {items.map(item => {
            const max = (item.invoiceQty1 ?? 0) + (item.invoiceQty2 ?? 0);
            const base = claimValue(item);
            const gst = round(base * item.gstPercent / 100);
            return <div key={item.key} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <strong>{item.itemName}</strong>
                <button type="button" className="text-red-700 underline" onClick={() => setItems(current => current.filter(row => row.key !== item.key))}>Remove</button>
              </div>
              <p className="mt-1 text-slate-600">{item.invoiceNo ? `Invoice ${item.invoiceNo} | ` : "Manual | "}Batch {item.batchNo || "-"} | Exp {item.expiry || "-"} | MRP {money(item.mrp)} | Retail {money(item.retailRate)} | GST {item.gstPercent}%{item.source === "invoice" && ` | Max qty ${Math.floor(max)}`}</p>
              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[560px] grid-cols-[minmax(90px,1fr)_minmax(135px,1.45fr)_minmax(90px,.9fr)_minmax(95px,.95fr)_minmax(85px,.9fr)] items-end gap-1.5">
                  <div className="min-w-0 pt-3">
                    <FloatingLabelDecimalInput id={`credit-claim-qty-${item.key}`} label="Claim quantity" width="100%" fractionalDigits={0} minValue={0} value={item.quantity} onChange={quantity => patchItem(item.key, { quantity })} clampOnBlur={quantity => Math.max(0, Math.min(Math.trunc(quantity), item.source === "invoice" ? Math.floor(max) : quantity))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right text-sm tabular-nums" />
                  </div>
                  <div className="min-w-0 pt-3">
                    <FloatingLabelSelect id={`credit-claim-reason-${item.key}`} label="Reason" value={item.reason} onChange={value => patchItem(item.key, { reason: value as Reason | "" })} placeholder="Select reason" options={reasons.map(reason => ({ value: reason, label: reason }))} className="min-h-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900" />
                  </div>
                  <div className="min-w-0 pt-3">
                    <FloatingLabelDecimalInput id={`credit-claim-reduction-${item.key}`} label="Reduction %" width="100%" fractionalDigits={2} minValue={0} value={item.reductionPercent} onChange={reductionPercent => patchItem(item.key, { reductionPercent })} clampOnBlur={reductionPercent => Math.max(0, Math.min(100, reductionPercent))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right text-sm tabular-nums" />
                  </div>
                  <div className="min-w-0 pt-3"><FloatingLabelShow id={`credit-claim-value-${item.key}`} label="Claim value" value={base} fractionalDigits={2} width="100%" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 disabled:opacity-100" /></div>
                  <div className="min-w-0 pt-3"><FloatingLabelShow id={`credit-claim-gst-${item.key}`} label="GST amount" value={gst} fractionalDigits={2} width="100%" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 disabled:opacity-100" /></div>
                </div>
              </div>
            </div>;
          })}
          {!items.length && <p className="text-sm text-slate-500">Add an item from A or B.</p>}
        </div>
      </div>
      <div className={box}><div className="space-y-1 text-sm"><p className="flex justify-between"><span>Item value</span><strong>₹{money(totals.base)}</strong></p><p className="flex justify-between"><span>GST</span><strong>₹{money(totals.gst)}</strong></p></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeGst} onChange={e => setIncludeGst(e.target.checked)} />Include GST in approximate claim amount</label><p className="mt-3 flex justify-between border-t pt-3 font-bold"><span>Approximate claim</span><span>₹{money(round(totals.base + (includeGst ? totals.gst : 0)))}</span></p><button type="button" disabled={busy || !items.length} onClick={() => void submit()} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : editingClaim ? "Update claim" : "Submit claim"}</button></div>
      <div className={box}><h3 className="mb-2 font-bold">Recent claims</h3>{claims.map(claim => <p key={claim.id} className="border-t py-2 text-sm"><strong>{claim.claimNo}</strong> · {claim.claimDate.slice(0, 10)} · {claim.status} · ₹{money(claim.claimAmount)}{claim.status === "PENDING" && <button type="button" disabled={busy} className="ml-3 text-blue-700 underline" onClick={() => { setEditingClaim(claim);setIncludeGst(claim.includeGst);setItems((claim.items ?? []).map((item,index) => ({ ...item,key:`edit:${claim.id}:${index}`,reason:String(item.reason) === "Expire" ? "Expired" : item.reason })));setError("");setSuccess("");containerRef.current?.scrollTo({ top:0,behavior:"smooth" }); }}>Edit</button>}</p>)}{!claims.length && <p className="text-sm text-slate-500">No claims submitted yet.</p>}</div>
    </>}
  </section>;
}
