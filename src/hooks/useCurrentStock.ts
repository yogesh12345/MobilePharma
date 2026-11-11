import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import type { CurrentStock } from "../utils/stockDisplay";

const MAX_CONCURRENT_REQUESTS = 6;
type BatchClosing = { ClosingQty1At: number; ClosingQty2At: number };

export function useCurrentStock(enabled: boolean, asOfDate: string) {
  const [stockByItemId, setStockByItemId] = useState<Record<number, CurrentStock | null>>({});
  const queue = useRef<Array<{ itemId: number; version: number }>>([]);
  const requested = useRef(new Set<number>());
  const requestVersion = useRef(new Map<number, number>());
  const activeRequests = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const drain = useCallback(function runQueue() {
    if (!mounted.current) return;
    while (activeRequests.current < MAX_CONCURRENT_REQUESTS && queue.current.length) {
      const { itemId, version } = queue.current.shift()!;
      if (requestVersion.current.get(itemId) !== version) continue;
      activeRequests.current += 1;
      void API.get<{ Rows: BatchClosing[] }>(`/stock/closing/item/${itemId}`, { params: { asOfDate } })
        .then(({ data }) => {
          if (!Array.isArray(data?.Rows)) throw new Error("Invalid batch closing response");
          const stock = data.Rows.reduce<CurrentStock>((sum, row) => {
            const qty1 = Number(row.ClosingQty1At);
            const qty2 = Number(row.ClosingQty2At);
            if (!Number.isFinite(qty1) || !Number.isFinite(qty2)) throw new Error("Invalid batch closing quantity");
            return { ClosingQty1: sum.ClosingQty1 + Math.max(0, qty1), ClosingQty2: sum.ClosingQty2 + Math.max(0, qty2) };
          }, { ClosingQty1: 0, ClosingQty2: 0 });
          if (mounted.current && requestVersion.current.get(itemId) === version) setStockByItemId(current => ({ ...current, [itemId]: stock }));
        })
        .catch(() => {
          if (mounted.current && requestVersion.current.get(itemId) === version) setStockByItemId(current => ({ ...current, [itemId]: null }));
        })
        .finally(() => { activeRequests.current -= 1; runQueue(); });
    }
  }, [asOfDate]);

  const requestStock = useCallback((items: Array<{ id: number | string }>) => {
    if (!enabled) return;
    const newRequests: Array<{ itemId: number; version: number }> = [];
    for (const item of items) {
      const itemId = Number(item.id);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || requested.current.has(itemId)) continue;
      requested.current.add(itemId);
      const version = (requestVersion.current.get(itemId) ?? 0) + 1;
      requestVersion.current.set(itemId, version);
      newRequests.push({ itemId, version });
    }
    queue.current = [...newRequests, ...queue.current];
    drain();
  }, [enabled, drain]);

  const refreshStock = useCallback((items: Array<{ id: number | string }>) => {
    if (!enabled) return;
    const ids = items.map(item => Number(item.id)).filter(id => Number.isSafeInteger(id) && id > 0);
    if (ids.length === 0) return;
    for (const id of ids) requested.current.delete(id);
    setStockByItemId(current => {
      const next = { ...current };
      for (const id of ids) delete next[id];
      return next;
    });
    requestStock(items);
  }, [enabled, requestStock]);

  return { stockByItemId, requestStock, refreshStock };
}
