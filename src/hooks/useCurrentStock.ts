import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import type { CurrentStock } from "../utils/stockDisplay";

const MAX_CONCURRENT_REQUESTS = 6;
type BatchClosing = { ClosingQty1At: number; ClosingQty2At: number };

export function useCurrentStock(enabled: boolean, asOfDate: string) {
  const [stockByItemId, setStockByItemId] = useState<Record<number, CurrentStock | null>>({});
  const queue = useRef<number[]>([]);
  const requested = useRef(new Set<number>());
  const activeRequests = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const drain = useCallback(function runQueue() {
    if (!mounted.current) return;
    while (activeRequests.current < MAX_CONCURRENT_REQUESTS && queue.current.length) {
      const itemId = queue.current.shift()!;
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
          if (mounted.current) setStockByItemId(current => ({ ...current, [itemId]: stock }));
        })
        .catch(() => {
          if (mounted.current) setStockByItemId(current => ({ ...current, [itemId]: null }));
        })
        .finally(() => { activeRequests.current -= 1; runQueue(); });
    }
  }, [asOfDate]);

  const requestStock = useCallback((items: Array<{ id: number | string }>) => {
    if (!enabled) return;
    const newIds: number[] = [];
    for (const item of items) {
      const itemId = Number(item.id);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || requested.current.has(itemId)) continue;
      requested.current.add(itemId);
      newIds.push(itemId);
    }
    queue.current = [...newIds, ...queue.current];
    drain();
  }, [enabled, drain]);

  return { stockByItemId, requestStock };
}
