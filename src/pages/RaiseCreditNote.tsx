import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import API from "../services/api";
import GenericAutoComplete from "../components/GenericAutoComplete";
import FloatingLabelDecimalInput from "../components/FloatingLabelDecimalInput";
import FloatingLabelInput from "../components/FloatingLabelInput";
import FloatingLabelSelect from "../components/FloatingLabelSelect";
import type { InvoiceItem } from "./RecentPurchases";
import { useTaskState } from "../hooks/useTaskState";

type Reason = "Expired" | "Near Expiry" | "Breakage" | "Spoiled" | "Rate Difference";
type Batch = { batSrNo: number; batchNo: string; mrp: number; expiry: string; retailRate: number; gstPercent: number };
type ClaimItem = { key: string; source: "invoice" | "manual"; invoiceId?: number; invoiceYear?: number; invoiceNo?: string; invoiceDate?: string; saleDetailId?: number; saleLocation?: number; itemId: number; itemName: string; batchNo: string; batSrNo: number; mrp: number; expiry: string; retailRate: number; gstPercent: number; invoiceQty1?: number; invoiceQty2?: number; quantity: number; reason: Reason | "" };
type Claim = { id: number; claimNo: string; claimDate: string; status: string; claimAmount: number; items?: Omit<ClaimItem, "key">[] };
type Config = { claimDate: string; sequenceMode: string; suggestedClaimNo: string };
type RecentInvoiceItem = Pick<InvoiceItem, "saleDetailId" | "saleLocation" | "itemId" | "batSrNo" | "itemName" | "packing" | "qty" | "free"> & { invoiceId: number; invoiceYear: number; invoiceNo: string; invoiceDate: string };
const reasons: Reason[] = ["Expired", "Near Expiry", "Breakage", "Spoiled", "Rate Difference"];
const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const shortDate = (value?: string | null) => { const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[3]}/${match[2]}/${match[1].slice(2)}` : value || "—"; };
const soldQuantity = (qty: number, free: number) => Number(free || 0) !== 0 ? `${Number(qty || 0)}+${Number(free)}` : String(Number(qty || 0));
const searchWords = (value: string) => value.toLocaleLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
const searchableLength = (value: string) => searchWords(value).join("").length;
const recentItemKey = (row: RecentInvoiceItem) => `${row.invoiceYear}:${row.invoiceId}:${row.saleDetailId}:${row.saleLocation}`;
const errorText = (e: unknown, fallback: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;

export default function RaiseCreditNote() {
  const containerRef = useRef<HTMLElement>(null);
  const pendingQtyFocus = useRef<string | null>(null);
  const recentMenuRef = useRef<HTMLDivElement>(null);
  const pendingBatchOpen = useRef(false);
  const manualRequest = useRef(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [recentItems, setRecentItems] = useState<RecentInvoiceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const [recentHighlighted, setRecentHighlighted] = useState(0);
  const [editingClaim, setEditingClaim] = useTaskState<Claim | null>("credit-note", "editing-claim", null, (value): value is Claim | null => value === null || (typeof value === "object" && value !== null && Number.isSafeInteger((value as Claim).id)));
  const [claims, setClaims] = useState<Claim[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useTaskState("credit-note", "invoice-search", "", (value): value is string => typeof value === "string");
  const [manualQuery, setManualQuery] = useTaskState("credit-note", "manual-query", "", (value): value is string => typeof value === "string");
  const [manualItem, setManualItem] = useTaskState<{ id: number; name: string } | null>("credit-note", "manual-item", null, (value): value is { id: number; name: string } | null => value === null || (typeof value === "object" && value !== null && Number.isSafeInteger((value as { id: number }).id)));
  const [batches, setBatches] = useTaskState<Batch[]>("credit-note", "batches", [], (value): value is Batch[] => Array.isArray(value));
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [items, setItems] = useTaskState<ClaimItem[]>("credit-note", "items", [], (value): value is ClaimItem[] => Array.isArray(value));
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

  useLayoutEffect(() => {
    const key = pendingQtyFocus.current;
    if (!key) return;
    const quantityInput = document.getElementById(`credit-claim-qty-${key}`) as HTMLInputElement | null;
    if (!quantityInput) return;
    pendingQtyFocus.current = null;
    quantityInput.focus();
    quantityInput.select();
    quantityInput.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [items]);

  useLayoutEffect(() => {
    if (!pendingBatchOpen.current || loadingBatches || batches.length < 2) return;
    const batchButton = document.getElementById("credit-claim-batch") as HTMLButtonElement | null;
    if (!batchButton) return;
    pendingBatchOpen.current = false;
    batchButton.focus();
    batchButton.click();
  }, [batches, manualItem, loadingBatches]);

  const load = async () => {
    const [a, c] = await Promise.all([API.get("/mobile/customer-portal/claims/config"), API.get("/mobile/customer-portal/claims")]);
    setConfig(a.data); setClaims(c.data.claims ?? []);
  };
  useEffect(() => { let active = true; Promise.all([API.get("/mobile/customer-portal/claims/config"), API.get("/mobile/customer-portal/claims")]).then(([a, c]) => { if (active) { setConfig(a.data); setClaims(c.data.claims ?? []); } }).catch(e => { if (active) setError(errorText(e, "Unable to load claim information.")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  useEffect(() => {
    const query = invoiceSearch.trim();
    if (searchableLength(query) < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void API.get("/mobile/customer-portal/claims/invoice-items/search", { params: { query }, signal: controller.signal })
        .then(({ data }) => { setRecentItems(data.items ?? []); setRecentHighlighted(0); setSearchError(""); })
        .catch(e => { if (!controller.signal.aborted) { setRecentItems([]); setSearchError(errorText(e, "Unable to search recent invoice items.")); } })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [invoiceSearch]);

  const addInvoiceItem = async (row: RecentInvoiceItem) => {
    const key = `invoice:${row.invoiceYear}:${row.invoiceId}:${row.saleDetailId}:${row.saleLocation}`;
    if (items.some(item => item.key === key)) { document.getElementById(`credit-claim-qty-${key}`)?.focus(); setError("This invoice item is already in the claim. Edit its quantity below."); return; }
    setAddingKey(key);
    try {
    const { data } = await API.get(`/mobile/customer-portal/invoices/${row.invoiceId}/items`, { params: { invoiceYear: row.invoiceYear } });
    const detail = (data.items as InvoiceItem[] | undefined)?.find(item => item.saleDetailId === row.saleDetailId && item.saleLocation === row.saleLocation);
    if (!detail?.saleDetailId || !detail.itemId || !detail.batSrNo) { setError("This invoice item has incomplete batch details."); return; }
    const available = Math.floor(Number(row.qty || 0) + Number(row.free || 0));
    if (available <= 0) { setError("This invoice item has no whole units available to claim."); return; }
    pendingQtyFocus.current = key;
    setItems(current => [...current, { key, source: "invoice", invoiceId: row.invoiceId, invoiceYear: row.invoiceYear, invoiceNo: row.invoiceNo, invoiceDate: row.invoiceDate, saleDetailId: row.saleDetailId, saleLocation: row.saleLocation, itemId: row.itemId, itemName: row.itemName, batchNo: detail.batchNo, batSrNo: detail.batSrNo, mrp: Number(detail.mrp), expiry: detail.expiry, retailRate: Number(detail.retailRate), gstPercent: Number(detail.gstPercent), invoiceQty1: Number(detail.qty), invoiceQty2: Number(detail.free), quantity: Math.min(1, available), reason: "" }]); setError("");
    } catch (e) { setError(errorText(e, "Unable to load invoice item details.")); }
    finally { setAddingKey(null); }
  };
  const addManualItem = (item: { id: number; name: string }, batch: Batch) => {
    const key = `manual:${Date.now()}:${Math.random()}`;
    pendingQtyFocus.current = key;
    setItems(current => [...current, { key, source: "manual", itemId: item.id, itemName: item.name, batchNo: batch.batchNo, batSrNo: batch.batSrNo, mrp: Number(batch.mrp), expiry: batch.expiry, retailRate: Number(batch.retailRate), gstPercent: Number(batch.gstPercent), quantity: 1, reason: "" }]);
    setManualItem(null); setManualQuery(""); setBatches([]); setError("");
  };
  const selectRecentItem = (row: RecentInvoiceItem) => {
    if (addingKey !== null) return;
    setInvoiceSearch("");
    setRecentItems([]);
    setRecentMenuOpen(false);
    setSearching(false);
    setSearchError("");
    void addInvoiceItem(row);
  };
  const selectManualItem = async (result: { id: string | number; label1: string }) => {
    const request = ++manualRequest.current;
    const item = { id: Number(result.id), name: result.label1 };
    setManualItem(item); setManualQuery(item.name); setBatches([]); setLoadingBatches(true); setError("");
    try {
      const { data } = await API.get(`/mobile/customer-portal/claims/items/${item.id}/batches`);
      if (request !== manualRequest.current) return;
      const available = (data.batches ?? []) as Batch[];
      if (available.length === 1) addManualItem(item, available[0]);
      else { pendingBatchOpen.current = available.length > 1; setBatches(available); }
    } catch (e) { if (request === manualRequest.current) setError(errorText(e, "Unable to load item batches.")); }
    finally { if (request === manualRequest.current) setLoadingBatches(false); }
  };
  const patchItem = (key: string, patch: Partial<ClaimItem>) => setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
  const submit = async () => {
    setError(""); setSuccess("");
    if (!items.length) { setError("Add at least one item to the claim."); return; }
    for (const item of items) { const limit = (item.invoiceQty1 ?? 0) + (item.invoiceQty2 ?? 0); if (!Number.isInteger(item.quantity) || item.quantity <= 0 || (item.source === "invoice" && item.quantity > limit)) { setError(`Enter a whole-number claim quantity for ${item.itemName}${item.source === "invoice" ? ` (maximum ${Math.floor(limit)})` : ""}.`); return; } if (!item.reason) { setError(`Select a claim reason for ${item.itemName}.`); return; } }
    setBusy(true);
    try { const payload = { includeGst: true, items: items.map(({ source, invoiceId, invoiceYear, saleDetailId, saleLocation, itemId, itemName, batSrNo, quantity, reason }) => ({ source, invoiceId, invoiceYear, saleDetailId, saleLocation, itemId, itemName, batSrNo, quantity, reason, reductionPercent: 0 })) }; const { data } = editingClaim ? await API.put(`/mobile/customer-portal/claims/${editingClaim.id}`,payload) : await API.post("/mobile/customer-portal/claims",payload); setEditingClaim(null); setSuccess(`Claim ${data.claim.claimNo} submitted for review.`); setItems([]); try { await load(); } catch { setError("Claim submitted, but the recent claims list could not be refreshed."); } }
    catch (e) { setError(errorText(e, "Unable to submit the claim.")); }
    finally { setBusy(false); }
  };

  const recentWords = searchWords(invoiceSearch);
  const visibleRecentItems = recentItems.filter(row => {
    const name = row.itemName.toLocaleLowerCase();
    return name.startsWith(recentWords[0] ?? "") && recentWords.slice(1).every(word => name.includes(word));
  });

  return <section ref={containerRef} className="space-y-5 overflow-y-auto overscroll-contain">
    <div><h2 className="text-xl font-bold">{editingClaim ? `Update claim ${editingClaim.claimNo}` : "Raise a credit note claim"}</h2>{editingClaim && <button type="button" className="text-sm text-blue-700 underline" onClick={() => { setEditingClaim(null);setItems([]); }}>Cancel editing</button>}<p className="text-sm text-slate-600">Search items from invoices in the last 10 months. For older invoices, search the item and choose its batch. Claims are submitted for review.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
    {loading ? <p>Loading claim details...</p> : <>
      <div className={`${box} flex flex-wrap items-center gap-x-8 gap-y-2 text-sm`}><div className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-slate-500">Claim date:</span><strong>{shortDate(config?.claimDate)}</strong></div><div className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-slate-500">Claim No.:</span><strong>{config?.suggestedClaimNo ?? "—"}</strong></div><p className="w-full text-xs text-slate-500">Sequence resets {config?.sequenceMode === "financial_year" ? "each financial year" : "monthly"}. The final number is assigned on submit.</p></div>
      <div className={box}>
        <h3 className="mb-3 font-bold">Claim items ({items.length})</h3>
        <div className="space-y-3">
          {items.map(item => {
            const max = (item.invoiceQty1 ?? 0) + (item.invoiceQty2 ?? 0);
            return <div key={item.key} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <strong>{item.itemName}</strong>
                <button type="button" aria-label={`Remove ${item.itemName}`} title="Remove item" className="rounded-lg p-2 text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" onClick={() => setItems(current => current.filter(row => row.key !== item.key))}><TrashIcon className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              <p className="mt-1 text-slate-600">{item.invoiceNo ? `Invoice ${item.invoiceNo}${item.invoiceDate ? ` · ${shortDate(item.invoiceDate)}` : ""} | ` : "Manual | "}Batch {item.batchNo || "-"}{item.source === "manual" && ` | MRP ₹${Number(item.mrp).toFixed(2)}`} | Exp {item.expiry || "-"} | GST {item.gstPercent}%{item.source === "invoice" && ` | Max qty ${Math.floor(max)}`}</p>
              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[240px] grid-cols-[minmax(90px,1fr)_minmax(135px,1.45fr)] items-end gap-1.5">
                  <div className="min-w-0 pt-3">
                    <FloatingLabelDecimalInput id={`credit-claim-qty-${item.key}`} label="Claim quantity" width="100%" fractionalDigits={0} minValue={0} value={item.quantity} onChange={quantity => patchItem(item.key, { quantity })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); const reasonButton = document.getElementById(`credit-claim-reason-${item.key}`) as HTMLButtonElement | null; reasonButton?.focus(); reasonButton?.click(); } }} clampOnBlur={quantity => Math.max(0, Math.min(Math.trunc(quantity), item.source === "invoice" ? Math.floor(max) : quantity))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right text-sm tabular-nums" />
                  </div>
                  <div className="min-w-0 pt-3">
                    <FloatingLabelSelect id={`credit-claim-reason-${item.key}`} label="Reason" value={item.reason} onChange={value => patchItem(item.key, { reason: value as Reason | "" })} placeholder="Select reason" options={reasons.map(reason => ({ value: reason, label: reason }))} className="min-h-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900" />
                  </div>
                </div>
              </div>
            </div>;
          })}
          {!items.length && <p className="text-sm text-slate-500">Add an item from A or B.</p>}
        </div>
      </div>
      <div className={box}>
        <h3 className="mb-2 font-bold">A. Search item from recent invoices</h3>
        <div className="relative pt-3" onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRecentMenuOpen(false); }}>
          <FloatingLabelInput id="credit-invoice-search" label="Search item" type="search" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" value={invoiceSearch}
            onFocus={() => setRecentMenuOpen(true)}
            onChange={e => { setInvoiceSearch(e.target.value); setRecentHighlighted(0); recentMenuRef.current?.scrollTo({ top: 0 }); setSearchError(""); setSearching(searchableLength(e.target.value) >= 3); setRecentMenuOpen(true); }}
            onKeyDown={e => {
              if (e.key === "Escape") { setRecentMenuOpen(false); return; }
              if (e.key === "ArrowDown" && visibleRecentItems.length) { e.preventDefault(); setRecentMenuOpen(true); setRecentHighlighted(index => Math.min(index + 1, visibleRecentItems.length - 1)); }
              if (e.key === "ArrowUp" && visibleRecentItems.length) { e.preventDefault(); setRecentMenuOpen(true); setRecentHighlighted(index => Math.max(index - 1, 0)); }
              if (e.key === "Enter" && recentMenuOpen && visibleRecentItems[recentHighlighted]) { e.preventDefault(); setRecentMenuOpen(false); selectRecentItem(visibleRecentItems[recentHighlighted]); }
            }} placeholder="Item name" />
          {recentMenuOpen && searchableLength(invoiceSearch) >= 3 && <div ref={recentMenuRef} role="listbox" aria-label="Recent invoice items" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {searchError ? <p role="alert" className="px-3 py-2 text-sm text-red-700">{searchError}</p>
              : visibleRecentItems.length ? visibleRecentItems.map((row, index) => <button key={recentItemKey(row)} type="button" role="option" aria-selected={index === recentHighlighted} disabled={addingKey !== null} onMouseEnter={() => setRecentHighlighted(index)} onClick={() => { setRecentMenuOpen(false); selectRecentItem(row); }} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 disabled:opacity-50 ${index === recentHighlighted ? "bg-blue-50" : ""}`}>
                <span className="block font-semibold text-slate-800">{row.itemName}</span>
                <span className="block text-slate-600">{row.packing} · Invoice {row.invoiceNo} · {shortDate(row.invoiceDate)} · Qty {soldQuantity(row.qty, row.free)}</span>
              </button>) : <p className="px-3 py-2 text-sm text-slate-500">{searching ? "Searching items..." : "No matching items in recent invoices."}</p>}
          </div>}
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="mb-2 font-bold">B. Search an item and batch</h3>
          <GenericAutoComplete endpoint="/mobile/sales-orders/items/search" searchQuery={manualQuery} setSearchQuery={value => {
          setManualQuery(value);
          if (manualItem && value !== manualItem.name) {
            manualRequest.current += 1;
            pendingBatchOpen.current = false;
            setManualItem(null); setBatches([]); setLoadingBatches(false);
          }
          }} onSelect={selectManualItem} minChars={3} mode="live" topLabel="Search item" myplacehoder="Type at least 3 characters" formatSecondaryItem={item => [item.label2, item.label3 ? `[${item.label3}]` : ""].filter(Boolean).join(" ")} showLabel5={false} />
          {manualItem && <div className="mt-4 space-y-3">
            {loadingBatches && <p className="text-sm text-slate-600">Loading batches...</p>}
            {!loadingBatches && batches.length > 1 && <FloatingLabelSelect id="credit-claim-batch" label="Batch" value="" onChange={value => { const batch = batches.find(row => String(row.batSrNo) === value); if (batch) addManualItem(manualItem, batch); }} placeholder="Select batch" options={batches.map(batch => ({ value: String(batch.batSrNo), label: `${batch.batchNo || `Batch ${batch.batSrNo}`} · MRP ₹${Number(batch.mrp).toFixed(2)} · Exp ${batch.expiry || "—"}` }))} className="min-h-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-900" />}
            {!loadingBatches && !batches.length && <p className="text-sm text-slate-500">No batches available for this item.</p>}
          </div>}
        </div>
      </div>
      <div className={box}><button type="button" disabled={busy || !items.length || items.some(item => !item.reason)} onClick={() => void submit()} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : editingClaim ? "Update claim" : "Submit claim"}</button></div>
      <div className={box}><h3 className="mb-2 font-bold">Recent claims</h3>{claims.map(claim => <p key={claim.id} className="border-t py-2 text-sm"><strong>{claim.claimNo}</strong> · {shortDate(claim.claimDate)} · {claim.status}{claim.status === "PENDING" && <button type="button" disabled={busy} className="ml-3 text-blue-700 underline" onClick={() => { setEditingClaim(claim);setItems((claim.items ?? []).map((item,index) => ({ ...item,key:`edit:${claim.id}:${index}`,reason:String(item.reason) === "Expire" ? "Expired" : item.reason })));setError("");setSuccess("");containerRef.current?.scrollTo({ top:0,behavior:"smooth" }); }}>Edit</button>}</p>)}{!claims.length && <p className="text-sm text-slate-500">No claims submitted yet.</p>}</div>
    </>}
  </section>;
}
