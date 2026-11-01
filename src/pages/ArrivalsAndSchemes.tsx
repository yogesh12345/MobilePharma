import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import FloatingLabelSelect from "../components/FloatingLabelSelect";
import FloatingLabelDateInput from "../components/FloatingLabelDateInput";
import { useMobileAccess } from "../context/mobileAccess";

type Tab = "arrivals" | "schemes";
type Item = {
  itemId: number; itemName: string; packing: string; companyId: number; companyName: string;
  addedDate: string; schemeNo: number; batchSrNo: number; schemeQty: number;
  schemeFree: number; schemePercent: number;
};
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const dateLabel = (value: string) => {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : "-";
};
const cell = "px-2 py-2";

export default function ArrivalsAndSchemes() {
  const [tab, setTab] = useState<Tab>("arrivals");
  const [days, setDays] = useState("30");
  const [threshold, setThreshold] = useState("all");
  const [asOf, setAsOf] = useState(today);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; items: Item[]; error: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const customerID = useMobileAccess().customer?.customerId;
  const requestKey = JSON.stringify([tab, days, threshold, asOf, retry, customerID]);
  const current = result?.key === requestKey ? result : null;
  const validDate = tab !== "schemes" || /^\d{4}-\d{2}-\d{2}$/.test(asOf);
  const loading = validDate && !current;
  const groups = useMemo(() => {
    const grouped = new Map<number, { name: string; items: Item[] }>();
    for (const item of current?.items ?? []) {
      const group = grouped.get(item.companyId) ?? { name: item.companyName, items: [] };
      group.items.push(item);
      grouped.set(item.companyId, group);
    }
    return [...grouped.entries()];
  }, [current]);
  const visibleCount = groups.reduce((total, [, group]) => total + group.items.length, 0);

  useEffect(() => {
    if (!validDate) return;
    const controller = new AbortController();
    void API.get("/mobile/customer-portal/arrivals", {
      params: tab === "arrivals" ? { tab, days } : { tab, threshold, asOf },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, items: data.items ?? [], error: "" });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key: requestKey, items: [], error: "Unable to load results. Please try again." });
    });
    return () => controller.abort();
  }, [tab, days, threshold, asOf, requestKey, validDate]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const updateHeight = () => {
      const bottom = document.getElementById("customer-portal-footer")?.getBoundingClientRect().top
        ?? window.visualViewport?.height ?? window.innerHeight;
      list.style.height = `${Math.max(100, Math.floor(bottom - list.getBoundingClientRect().top - 8))}px`;
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (list.parentElement) observer.observe(list.parentElement);
    const header = document.querySelector("header");
    if (header) observer.observe(header);
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, []);

  const fieldStyle = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  const selectStyle = "text-slate-900";
  return <div className="space-y-3">
    <div role="tablist" aria-label="New arrivals and schemes" className="flex gap-2">
      {(["arrivals", "schemes"] as const).map((value, index) => <button
        key={value} type="button" role="tab" id={`offers-tab-${value}`} aria-selected={tab === value}
        aria-controls={`offers-panel-${value}`} tabIndex={tab === value ? 0 : -1}
        onClick={() => setTab(value)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "arrivals" : event.key === "End" ? "schemes" : index === 0 ? "schemes" : "arrivals";
          setTab(next);
          document.getElementById(`offers-tab-${next}`)?.focus();
        }}
        className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${tab === value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:bg-blue-50"}`}>
        {value === "arrivals" ? "New arrivals" : "Schemes"}
      </button>)}
    </div>
    <div role="tabpanel" id={`offers-panel-${tab}`} aria-labelledby={`offers-tab-${tab}`} className="space-y-2">
      <div className="portal-offer-filters">
        {tab === "arrivals" ? <div className="portal-offer-duration">
          <FloatingLabelSelect id="offers-duration" label="Added in" value={days}
            onChange={(value) => setDays(value || "30")} className={selectStyle} dropdownMinWidthPx={220}
            options={[{ value: "7", label: "Last 7 days" }, { value: "15", label: "Last 15 days" }, { value: "30", label: "Last 30 days" }]} />
        </div> : <>
          <div className="portal-offer-percentage">
            <FloatingLabelSelect id="offers-percentage" label="Scheme percentage" value={threshold}
              onChange={(value) => setThreshold(value || "all")} className={selectStyle} dropdownMinWidthPx={240}
              options={[{ value: "all", label: "All schemes" }, { value: "above50", label: "Above 50%" },
                { value: "above25", label: "Above 25%" }, { value: "above10", label: "Above 10%" }, { value: "below10", label: "Less than 10%" }]} />
          </div>
          <div className="portal-offer-date">
            <FloatingLabelDateInput id="offers-as-of" label="Valid as on date"
              value={asOf ? new Date(`${asOf}T00:00:00`) : undefined}
              onChange={(value) => setAsOf(value
                ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : "")}
              className={`${fieldStyle} pr-9`} />
          </div>
        </>}
        <span role="status" className="text-xs text-slate-500">{loading ? "Loading..." : current && !current.error ? `${visibleCount} ${tab === "arrivals" ? "items" : "schemes"} / ${groups.length} companies` : ""}</span>
      </div>
      <div ref={listRef} aria-busy={loading} className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {!validDate ? <p role="alert" className="p-4 text-sm text-red-700">Choose a valid date.</p>
          : loading ? <p className="p-4 text-sm text-slate-500">Loading results...</p>
          : current?.error ? <div role="alert" className="p-4 text-sm text-red-700">{current.error} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
          : !groups.length ? <p className="p-4 text-sm text-slate-500">{tab === "arrivals" ? "No new arrivals match the selected filters." : "No active schemes match the selected filters."}</p>
          : <table className={`w-full border-collapse text-left text-xs sm:text-sm ${tab === "schemes" ? "min-w-[460px]" : "min-w-[360px]"}`}>
            <caption className="sr-only">{tab === "arrivals" ? "New arrivals" : "Active schemes"} grouped by company</caption>
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700"><tr>
              <th scope="col" className={cell}>Item name</th><th scope="col" className={cell}>Packing</th>
              {tab === "arrivals" ? <th scope="col" className={`${cell} whitespace-nowrap`}>Added on</th> : <>
                <th scope="col" className={`${cell} text-right`}>Qty</th><th scope="col" className={`${cell} text-right`}>Free</th>
                <th scope="col" className={`${cell} whitespace-nowrap text-right`}>Scheme %</th>
              </>}
            </tr></thead>
            {groups.map(([id, group]) => <tbody key={id} className="divide-y divide-slate-100">
              <tr className="bg-blue-50"><th scope="rowgroup" colSpan={tab === "arrivals" ? 3 : 5} className={`${cell} font-semibold text-blue-900`}>{group.name}</th></tr>
              {group.items.map((item, index) => <tr key={`${item.itemId}:${item.schemeNo}:${item.batchSrNo}:${index}`} className="even:bg-slate-50/50">
                <td className={`${cell} font-medium`}>{item.itemName}</td><td className={`${cell} whitespace-nowrap`}>{item.packing}</td>
                {tab === "arrivals" ? <td className={`${cell} whitespace-nowrap`}>{dateLabel(item.addedDate)}</td> : <>
                  <td className={`${cell} text-right tabular-nums`}>{item.schemeQty}</td><td className={`${cell} text-right tabular-nums`}>{item.schemeFree}</td>
                  <td className={`${cell} text-right font-semibold tabular-nums text-teal-800`}>{item.schemePercent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%</td>
                </>}
              </tr>)}
            </tbody>)}
          </table>}
      </div>
    </div>
  </div>;
}
