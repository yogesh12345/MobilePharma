import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";
import API from "../services/api";
import { openSalesOrderPdf } from "../services/invoicePdf";
import { useMobileAccess } from "../context/mobileAccess";

type Order = { id: number; customerName: string; customerAddress: string; soNumber: string; soDate: string | null; numItems: number; status: string };
const formatDate = (value: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1].slice(2)}` : "—";
};

export default function RecentSalesOrders() {
  const access = useMobileAccess();
  const allowed = access.data?.account.kind === "INTERNAL" && access.data.account.active && (access.data.taskPermissions?.includes("list_recent_sales_orders") || access.data.taskPermissions?.includes("list_recent_purchases"));
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (currentPage: number, signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await API.get<{ orders: Order[]; hasMore: boolean }>("/mobile/recent-sales-orders", { params: { page: currentPage }, signal });
      setOrders(data.orders ?? []);
      setHasMore(Boolean(data.hasMore));
    } catch (cause: unknown) {
      if (signal.aborted) return;
      const response = cause as { response?: { data?: { error?: string } } };
      setError(response.response?.data?.error || "Unable to load recent sales orders.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(page, controller.signal); });
    return () => controller.abort();
  }, [allowed, page, retry, load]);

  useLayoutEffect(() => {
    if (!allowed) return;
    const updateHeight = () => {
      const list = listRef.current;
      const footer = document.getElementById("customer-portal-footer");
      if (!list || !footer) return;
      const pagination = document.getElementById("recent-so-pagination");
      const reserved = pagination ? pagination.getBoundingClientRect().height + 16 : 0;
      list.style.maxHeight = `${Math.max(100, Math.floor(footer.getBoundingClientRect().top - list.getBoundingClientRect().top - reserved - 8))}px`;
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [allowed, loading, error, orders.length, hasMore, page]);

  if (!allowed) return null;

  const view = async (order: Order) => {
    if (viewingId !== null) return;
    setViewingId(order.id);
    setError("");
    try { await openSalesOrderPdf(order.id, order.soNumber, "recent"); }
    catch (cause: unknown) {
      const response = cause as { response?: { data?: { error?: string } }; message?: string };
      setError(response.response?.data?.error || response.message || "Unable to view sales order PDF.");
    } finally { setViewingId(null); }
  };

  return <section className="space-y-3">
    <h2 className="text-xl font-bold">Recent Sales Orders</h2>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry</button></div>}
    <div ref={listRef} className="overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[350px] table-fixed border-collapse text-left text-[11px] sm:text-sm">
        <colgroup><col className="w-[35%]" /><col className="w-[17%]" /><col className="w-[10%]" /><col className="w-[25%]" /><col className="w-[13%]" /></colgroup>
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700"><tr>
          <th scope="col" className="px-2 py-2">SO Number</th>
          <th scope="col" className="px-1 py-2">Date</th>
          <th scope="col" className="px-1 py-2 text-center leading-tight">No. of Items</th>
          <th scope="col" className="px-1 py-2">Status</th>
          <th scope="col" className="px-1 py-2"><span className="sr-only">View</span></th>
        </tr></thead>
        <tbody>
          {orders.map((order, index) => <Fragment key={order.id}>
            <tr className={index % 2 ? "bg-blue-50" : "bg-white"}><td colSpan={5} className="border-t border-slate-200 px-2 pb-0 pt-2 font-semibold text-slate-900"><div className="truncate" title={[order.customerName, order.customerAddress].filter(Boolean).join(" — ")}>{order.customerName}{order.customerAddress && <span className="font-normal text-slate-600"> — {order.customerAddress}</span>}</div></td></tr>
            <tr className={index % 2 ? "bg-blue-50" : "bg-white"}>
              <td className="whitespace-nowrap px-2 pb-2 pt-1 font-medium">{order.soNumber}</td>
              <td className="whitespace-nowrap px-1 pb-2 pt-1 tabular-nums">{formatDate(order.soDate)}</td>
              <td className="px-1 pb-2 pt-1 text-center tabular-nums">{order.numItems}</td>
              <td className="px-1 pb-2 pt-1 font-medium">{order.status}</td>
              <td className="px-1 pb-1 pt-0 text-center"><button type="button" disabled={viewingId !== null} onClick={() => void view(order)} aria-label={`View sales order ${order.soNumber}`} title="View sales order PDF" className="inline-grid h-9 w-9 place-items-center rounded-md text-blue-700 hover:bg-blue-100 disabled:opacity-50"><EyeIcon className="h-5 w-5" aria-hidden="true" /></button></td>
            </tr>
          </Fragment>)}
        </tbody>
      </table>
      {!loading && !orders.length && <p className="p-4 text-sm text-slate-500">No recent sales orders.</p>}
      {loading && <p role="status" className="p-4 text-sm text-slate-600">Loading sales orders...</p>}
    </div>
    {(page > 1 || hasMore) && <div id="recent-so-pagination" className="flex items-center justify-between gap-3">
      <button type="button" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)} className="min-h-10 rounded-lg border border-blue-200 bg-white px-4 font-semibold text-blue-700 disabled:opacity-50">Previous</button>
      <span className="text-sm text-slate-600">Page {page}</span>
      <button type="button" disabled={!hasMore || loading} onClick={() => setPage(value => value + 1)} className="min-h-10 rounded-lg border border-blue-200 bg-white px-4 font-semibold text-blue-700 disabled:opacity-50">Next</button>
    </div>}
  </section>;
}
