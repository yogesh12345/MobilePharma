import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import { useMobileAccess } from "../context/mobileAccess";

type Row = { invoiceType: "Cash" | "Credit" | "Grand Total"; bucket: string; startInvoiceNo: string; endInvoiceNo: string; invoiceCount: number; invoiceAmount: number; uniqueCustomers: number; averageInvoiceAmount: number };
type Summary = { rows: Row[]; totals: Record<"Cash" | "Credit", Row>; grandTotal: Row };
type Period = "currentDate" | "specifiedDate" | "currentMonth" | "specifiedMonth";
type Type = "Cash" | "Credit";
const kinds: Type[] = ["Cash", "Credit"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const money = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit" });
const fullDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const timeLabel = (start: string) => {
  const [h, m] = start.split(":").map(Number);
  const end = h * 60 + m + 90;
  return `${start}–${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
};

export default function SalesSummary() {
  const access = useMobileAccess();
  const allowed = access.data?.account.kind === "INTERNAL" && access.data.account.active && access.data.taskPermissions?.includes("sales_summary");
  const [period, setPeriod] = useState<Period>("currentDate");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [month, setMonth] = useState(() => isoDate(new Date()).slice(0, 7));
  const [selected, setSelected] = useState<Type[]>(["Cash", "Credit"]);
  const [view, setView] = useState<"report" | "chart">("report");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const isMonth = period === "currentMonth" || period === "specifiedMonth";
  const today = isoDate(new Date());
  const value = period === "currentDate" ? today : period === "currentMonth" ? today.slice(0, 7) : period === "specifiedDate" ? date : month;
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setSummary(null);
      if (!allowed || !value) return;
      setLoading(true); setError("");
      try {
        const { data } = await API.get<Summary>("/mobile/sales-summary", { params: { period: isMonth ? "month" : "date", value } });
        if (active) setSummary(data);
      } catch (reason: unknown) {
        if (active) setError((reason as { response?: { data?: { error?: string } } })?.response?.data?.error || "Unable to load sales summary.");
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [allowed, isMonth, value, refresh]);
  const displayRows = useMemo(() => kinds.filter(kind => selected.includes(kind)).map(kind => ({
    kind, rows: (summary?.rows ?? []).filter(row => row.invoiceType === kind).sort((a, b) => a.bucket.localeCompare(b.bucket)), total: summary?.totals?.[kind],
  })), [summary, selected]);
  const grand = selected.length === 2 ? summary?.grandTotal : null;
  if (!allowed) return null;
  const totalCells = (row: Row) => <><td className="px-1.5 py-2 text-right">{row.invoiceCount}</td><td className="px-1.5 py-2 text-right">{money(row.invoiceAmount)}</td><td className="px-1.5 py-2 text-right">{row.uniqueCustomers}</td><td className="px-1.5 py-2 text-right">{money(row.averageInvoiceAmount)}</td></>;
  return <section className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 text-slate-900">
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold text-blue-950">Sales Summary</h2><button type="button" onClick={() => setRefresh(n => n + 1)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-800">Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Period<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3" value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="currentDate">Current Date</option><option value="specifiedDate">Specified Date</option><option value="currentMonth">Current Month</option><option value="specifiedMonth">Specified Month</option></select></label>
      {period === "specifiedDate" && <label className="text-sm font-medium">Date<input className="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}
      {period === "specifiedMonth" && <label className="text-sm font-medium">Month<input className="mt-1 w-full rounded-lg border border-slate-300 p-3" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>}
    </div>
    <fieldset><legend className="mb-2 text-sm font-medium">Invoice Type</legend><div className="flex gap-5">{kinds.map(kind => <label key={kind} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(kind)} onChange={event => setSelected(current => event.target.checked ? [...current, kind] : current.length === 1 ? kinds.filter(item => item !== kind) : current.filter(item => item !== kind))} />{kind} Sales</label>)}</div></fieldset>
    <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Summary view"><button type="button" onClick={() => setView("report")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${view === "report" ? "bg-white text-blue-800 shadow" : "text-slate-600"}`}>Summary Report</button><button type="button" onClick={() => setView("chart")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${view === "chart" ? "bg-white text-blue-800 shadow" : "text-slate-600"}`}>Bar Chart</button></div>
    {!isMonth && value && <h3 className="font-semibold text-blue-950">{fullDate(value)}</h3>}
    {isMonth && value && <h3 className="font-semibold text-blue-950">{new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>}
    {loading && <p role="status" className="text-sm">Loading summary…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && summary && view === "report" && <div className="max-h-[70dvh] overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm"><thead className="sticky top-0 z-10 bg-blue-50 text-blue-950"><tr><th rowSpan={2} className="px-1.5 py-2 text-left">{isMonth ? "Date" : "Time slot"}</th><th colSpan={2} className="px-1.5 pt-2 text-center">Invoice Nos.</th><th rowSpan={2} className="px-1.5 py-2 text-right">No. of Invoices</th><th rowSpan={2} className="px-1.5 py-2 text-right">Total Invoice Amount</th><th rowSpan={2} className="px-1.5 py-2 text-right">Unique Customers</th><th rowSpan={2} className="px-1.5 py-2 text-right">Avg. Invoice Amount</th></tr><tr><th className="px-1.5 pb-2 text-left">Start</th><th className="px-1.5 pb-2 text-left">End</th></tr></thead><tbody>
      {displayRows.map(({ kind, rows, total }) => <FragmentRows key={kind} kind={kind} rows={rows} total={total} isMonth={isMonth} totalCells={totalCells} />)}
      {grand && <tr className="border-t-2 border-blue-300 bg-blue-50 font-bold"><th colSpan={3} className="px-1.5 py-2 text-left">Grand Total</th>{totalCells(grand)}</tr>}
    </tbody></table></div>}
    {!loading && summary && view === "chart" && <SalesBarChart rows={summary.rows} selected={selected} isMonth={isMonth} />}
  </section>;
}

function FragmentRows({ kind, rows, total, isMonth, totalCells }: { kind: Type; rows: Row[]; total?: Row; isMonth: boolean; totalCells: (row: Row) => React.ReactNode }) {
  return <>
    <tr className="border-t border-slate-200 bg-slate-50 font-semibold"><th colSpan={7} className="px-1.5 py-2 text-left">{kind} Sales</th></tr>
    {rows.length === 0 && <tr><td colSpan={7} className="px-1.5 py-2 text-slate-500">No invoices</td></tr>}
    {rows.map(row => <tr key={row.bucket} className="border-t border-slate-100">
      <td className="whitespace-nowrap px-1.5 py-2">{isMonth ? dayLabel(row.bucket) : timeLabel(row.bucket)}</td>
      {row.invoiceCount === 1 ? <td colSpan={2} className="whitespace-nowrap px-1.5 py-2 text-center">{row.startInvoiceNo || row.endInvoiceNo}</td> : <>
        <td className="whitespace-nowrap px-1.5 py-2">{row.startInvoiceNo}</td>
        <td className="whitespace-nowrap px-1.5 py-2">{row.endInvoiceNo}</td>
      </>}
      {totalCells(row)}
    </tr>)}
    {total && <tr className="border-t border-slate-300 bg-slate-50 font-semibold"><th colSpan={3} className="px-1.5 py-2 text-left">{kind} Total</th>{totalCells(total)}</tr>}
  </>;
}

function SalesBarChart({ rows, selected, isMonth }: { rows: Row[]; selected: Type[]; isMonth: boolean }) {
  const visibleRows = rows.filter(row => selected.includes(row.invoiceType as Type) && row.invoiceAmount > 0);
  const buckets = [...new Set(visibleRows.map(row => row.bucket))].sort();
  const maxAmount = Math.max(0, ...visibleRows.map(row => row.invoiceAmount));
  const axisStep = maxAmount > 0 ? 10 ** Math.floor(Math.log10(maxAmount)) / 2 : 1;
  const axisMax = maxAmount > 0 ? Math.ceil(maxAmount * 1.1 / axisStep) * axisStep : 0;
  return <div className="space-y-3">
    <div className="flex gap-4 text-xs">{kinds.filter(kind => selected.includes(kind)).map(kind => <span key={kind} className="flex items-center gap-1"><i className={`h-3 w-3 rounded-sm ${kind === "Cash" ? "bg-emerald-600" : "bg-blue-600"}`} />{kind} Sales</span>)}</div>
    <div className="text-xs text-slate-500">Invoice Amount (₹)</div>
    {buckets.length === 0 ? <p className="text-sm text-slate-600">No sales in this period.</p> : <>
      <div className="flex gap-2">
        <div className="flex h-52 shrink-0 flex-col justify-between text-right text-[10px] text-slate-500"><span>₹{money(axisMax)}</span><span>₹{money(axisMax / 2)}</span><span>₹0</span></div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-full gap-2 border-b border-slate-300" style={{ width: `max(100%, ${buckets.length * (isMonth ? 64 : 58)}px)` }}>
            {buckets.map(bucket => <div key={bucket} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex h-52 w-full items-end justify-center gap-0.5">
                {kinds.filter(kind => selected.includes(kind)).map(kind => {
                  const row = visibleRows.find(item => item.invoiceType === kind && item.bucket === bucket);
                  const amount = row?.invoiceAmount ?? 0;
                  const description = `${kind} ${isMonth ? dayLabel(bucket) : timeLabel(bucket)}: ₹${money(amount)}; ${row?.invoiceCount ?? 0} invoices`;
                  return <div key={kind} title={description} aria-label={description} className={`w-4 rounded-t-sm ${kind === "Cash" ? "bg-emerald-600" : "bg-blue-600"}`} style={{ height: amount > 0 ? `${amount / axisMax * 100}%` : 0 }} />;
                })}
              </div>
              <span className="h-7 whitespace-nowrap pt-1 text-center text-[10px] text-slate-600">{isMonth ? dayLabel(bucket) : bucket}</span>
            </div>)}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">{isMonth ? "Day and date" : "90 minute time slot"} →</p>
    </>}
  </div>;
}
