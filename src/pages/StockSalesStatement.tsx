import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import API from "../services/api";
import { documentOpener } from "../services/invoicePdf";
import { useMobileAccess } from "../context/mobileAccess";
import FloatingLabelInput from "../components/FloatingLabelInput";
import FloatingLabelSelect from "../components/FloatingLabelSelect";
import FloatingLabelDateInput from "../components/FloatingLabelDateInput";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
const selectClass = "min-h-12 rounded-lg border-slate-300 bg-white px-3 text-sm text-slate-900";
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateValue = (value: string) => value ? new Date(`${value}T00:00:00`) : undefined;

export default function StockSalesStatement() {
  const access = useMobileAccess();
  const allowed = access.data?.account.kind === "INTERNAL" && access.data.account.active && access.data.taskPermissions?.includes("company_stock_sales_statement");
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [query, setQuery] = useState("");
  const [statement, setStatement] = useState("1");
  const [format, setFormat] = useState("txt");
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(() => localDate(new Date()).slice(0, 7));
  const [fromDate, setFromDate] = useState(() => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDate, setToDate] = useState(() => localDate(new Date()));
  const [asOnDate, setAsOnDate] = useState(() => localDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void API.get("/mobile/stock-statements/companies").then(({ data }) => {
      if (active) setCompanies(data.companies ?? []);
    }).catch(() => { if (active) setError("Unable to load companies. Please retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, retry]);
  if (!allowed) return null;

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    let from = fromDate, to = toDate;
    if (statement === "5") {
      from = asOnDate; to = asOnDate;
    } else if (mode === "month") {
      const [year, number] = month.split("-").map(Number);
      from = `${month}-01`; to = localDate(new Date(year, number, 0));
    }
    if (!companyId || !from || !to || from > to) { setError("Select a company and a valid period."); return; }
    const tab = Capacitor.isNativePlatform() ? null : window.open("", "_blank");
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await API.post("/mobile/stock-statements", { companyId: Number(companyId), statement, format, fromDate: from, toDate: to }, { responseType: "blob", timeout: 180000 });
      const mimeType = format === "pdf" ? "application/pdf" : "text/plain";
      const blob = new Blob([response.data], { type: mimeType });
      const fileName = `stock-sales-${companyId}-${from}-to-${to}.${format}`;
      if (Capacitor.isNativePlatform()) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
          reader.onerror = () => reject(new Error("Unable to read statement."));
          reader.readAsDataURL(blob);
        });
        await documentOpener.open({ data, fileName, mimeType });
      } else {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        const link = document.createElement("a"); link.href = url; link.download = fileName; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 300000);
      }
      setNotice("Statement generated.");
    } catch (error: unknown) {
      tab?.close();
      const response = error as { response?: { data?: Blob }; message?: string };
      let detail = "";
      if (response.response?.data instanceof Blob) {
        try { detail = (JSON.parse(await response.response.data.text()) as { error?: string }).error || ""; } catch { /* Use fallback. */ }
      }
      setError(detail || response.message || "Unable to generate statement.");
    } finally { setBusy(false); }
  };

  return <form onSubmit={event => void generate(event)} className="space-y-4 rounded-xl border border-blue-200 bg-white/95 p-4">
    <h2 className="text-lg font-bold text-blue-950">Stock &amp; Sales Statement</h2>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {loading ? <p role="status">Loading companies...</p> : !companies.length && <button type="button" className="text-blue-700 underline" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>Reload companies</button>}
    <fieldset disabled={busy || loading} className="space-y-5 pt-2 disabled:opacity-60">
      <FloatingLabelInput id="statement-company-search" label="Find company" type="search" className={inputClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search company name" />
      <FloatingLabelSelect id="statement-company" label="Company" value={companyId} onChange={setCompanyId} placeholder="Select company" className={selectClass} options={companies.filter(company => String(company.id) === companyId || company.name.toLowerCase().includes(query.toLowerCase())).map(company => ({ value: String(company.id), label: company.name }))} />
      <FloatingLabelSelect id="statement-type" label="Stock Statement" value={statement} onChange={setStatement} className={selectClass} options={[1, 2, 3, 4, 5].map(value => ({ value: String(value), label: `Stock Statement ${value}` }))} />
      <FloatingLabelSelect id="statement-format" label="Output format" value={format} onChange={setFormat} className={selectClass} options={[{ value: "txt", label: "Text" }, { value: "pdf", label: "PDF" }]} />
      {statement === "5" ? <FloatingLabelDateInput id="statement-as-on-date" label="As on date" value={dateValue(asOnDate)} onChange={value => setAsOnDate(value ? localDate(value) : "")} className={inputClass} /> : <>
      <FloatingLabelSelect id="statement-period" label="Period" value={mode} onChange={setMode} className={selectClass} options={[{ value: "month", label: "Month" }, { value: "range", label: "Date range" }]} />
      {mode === "month" ? <FloatingLabelInput id="statement-month" label="Month" type="month" required className={inputClass} value={month} onChange={event => setMonth(event.target.value)} /> : <div className="grid grid-cols-2 gap-3">
        <FloatingLabelDateInput id="statement-from-date" label="From date" value={dateValue(fromDate)} maxDate={dateValue(toDate)} onChange={value => setFromDate(value ? localDate(value) : "")} className={inputClass} />
        <FloatingLabelDateInput id="statement-to-date" label="To date" value={dateValue(toDate)} onChange={value => setToDate(value ? localDate(value) : "")} className={inputClass} />
      </div>}
      </>}
      <button type="submit" disabled={!companyId} className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Generating..." : "Generate statement"}</button>
    </fieldset>
  </form>;
}
