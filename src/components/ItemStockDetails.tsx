import { useEffect, useState } from "react";
import API from "../services/api";
import { formatStock, stockDate, type CurrentStock } from "../utils/stockDisplay";

type BatchStock = {
  BatSrNo: number;
  BatchNo: string;
  ExpDate: string | null;
  PurDate: string | null;
  MRP: number;
  ClosingQty1At: number;
  ClosingQty2At: number;
};

export default function ItemStockDetails({ itemId, initialStock }: { itemId: number; initialStock?: CurrentStock | null }) {
  const [stock, setStock] = useState<CurrentStock | null>(initialStock ?? null);
  const [stockError, setStockError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [batches, setBatches] = useState<BatchStock[] | null>(null);
  const [batchError, setBatchError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [batchRetry, setBatchRetry] = useState(0);

  useEffect(() => {
    // Company rows already have current stock. Keep that snapshot until the
    // user requests batches; null means the list's stock was unavailable.
    if (initialStock !== undefined) return;
    let active = true;
    const load = async () => {
      try {
        let response;
        try {
          response = await API.get<CurrentStock>(`/mobile/stock/current/${itemId}`);
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
          response = await API.get<CurrentStock>(`/stock/current/${itemId}`);
        }
        const q1 = Number(response.data.ClosingQty1);
        const q2 = Number(response.data.ClosingQty2);
        if (!Number.isFinite(q1) || !Number.isFinite(q2)) throw new Error("Invalid stock");
        if (active) setStock({ ClosingQty1: q1, ClosingQty2: q2 });
      } catch {
        if (active) setStockError(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [itemId, retry, initialStock]);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    const today = new Date();
    const asOfDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    API.get<{ Rows: BatchStock[] }>(`/stock/closing/item/${itemId}`, { params: { asOfDate } })
      .then(({ data }) => {
        if (!Array.isArray(data.Rows)) throw new Error("Invalid batch stock");
        const total = data.Rows.reduce<CurrentStock>((sum, row) => {
          const qty1 = Number(row.ClosingQty1At);
          const qty2 = Number(row.ClosingQty2At);
          if (!Number.isFinite(qty1) || !Number.isFinite(qty2)) throw new Error("Invalid batch quantity");
          return { ClosingQty1: sum.ClosingQty1 + qty1, ClosingQty2: sum.ClosingQty2 + qty2 };
        }, { ClosingQty1: 0, ClosingQty2: 0 });
        if (active) {
          setBatches(data.Rows.filter(row => Number(row.ClosingQty1At) !== 0 || Number(row.ClosingQty2At) !== 0));
          setStock(previous => previous?.ClosingQty1 === total.ClosingQty1 && previous?.ClosingQty2 === total.ClosingQty2 ? previous : total);
        }
      })
      .catch(() => { if (active) setBatchError(true); });
    return () => { active = false; };
  }, [itemId, expanded, batchRetry]);

  const nonzero = stock !== null && (stock.ClosingQty1 !== 0 || stock.ClosingQty2 !== 0);

  return <section aria-label="Item stock" className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-gray-700">Total Stock:</span>
      {stock || initialStock === null ? <button type="button" disabled={stock !== null && !nonzero && !expanded} aria-expanded={expanded} aria-controls={`batch-stock-${itemId}`}
        onClick={() => { setBatches(null); setBatchError(false); setExpanded(value => !value); }}
        className="min-h-11 rounded px-3 text-lg font-bold tabular-nums text-blue-800 enabled:underline enabled:underline-offset-4 enabled:hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default">
        {stock ? formatStock(stock.ClosingQty1, stock.ClosingQty2) : "--"}
      </button> : stockError ? <span role="status" className="text-sm text-red-700">Stock unavailable. <button type="button" className="min-h-11 px-2 underline" onClick={() => { setStockError(false); setRetry(value => value + 1); }}>Retry</button></span>
        : <span role="status" className="text-sm text-gray-600">Loading stock...</span>}
    </div>
    {expanded && <div id={`batch-stock-${itemId}`} className="mt-2">
      {batchError ? <p role="status" className="text-sm text-red-700">Unable to load batch stock. <button type="button" className="min-h-11 px-2 underline" onClick={() => { setBatchError(false); setBatches(null); setBatchRetry(value => value + 1); }}>Retry</button></p>
        : batches === null ? <p role="status" className="text-sm text-gray-600">Loading batches...</p>
        : <div className="overflow-x-auto rounded border border-blue-200 bg-white" role="region" aria-label="Batch stock details" tabIndex={0}>
          <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
            <caption className="sr-only">Batch wise current stock</caption>
            <thead className="bg-blue-100 text-blue-900"><tr>
              {["Batch No.", "Expiry", "MRP", "PurDate", "Stock"].map((heading, index) => <th key={heading} scope="col" className={`px-3 py-2 ${index === 2 || index === 4 ? "text-right" : ""}`}>{heading}</th>)}
            </tr></thead>
            <tbody>{batches.length ? batches.map((batch, index) => <tr key={`${batch.BatSrNo}-${index}`} className="border-t border-blue-100 even:bg-sky-50/70">
              <td className="px-3 py-2">{batch.BatchNo || "—"}</td>
              <td className="px-3 py-2">{stockDate(batch.ExpDate, true)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Number(batch.MRP || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-2">{stockDate(batch.PurDate)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatStock(batch.ClosingQty1At, batch.ClosingQty2At)}</td>
            </tr>) : <tr><td colSpan={5} className="px-3 py-3 text-gray-600">No nonzero batch stock available.</td></tr>}</tbody>
          </table>
        </div>}
    </div>}
  </section>;
}
