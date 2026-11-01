import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";
import { searchCompanyItems } from "./companyItemSearch";

type CompanyRow = {
  id: number;
  CompName: string;
  CompShort: string;
  ItemCount: number;
};

type CompanyItem = {
  id: number;
  ItemName: string;
  Packing: string;
  PTR: number;
  MRP: number;
  PurDate?: string | null;
  RackNumber?: string | null;
};

type CompanyDetail = {
  id: number;
  CompName: string;
  CompShort: string;
};

type CurrentStock = {
  ClosingQty1: number;
  ClosingQty2: number;
  StringClosing?: string;
};

interface CompaniesPageProps {
  compactTop?: boolean;
  onEditRack?: (item: { id: number; ItemName: string }) => void;
  canUpdateCompany?: boolean;
  canUpdateRack?: boolean;
  focusItemId?: number | null;
  focusRequestKey?: number;
}

export type CompaniesPageHandle = {
  backToCompaniesList: () => boolean;
};

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const qty = (n: number) => {
  const x = Number(n || 0);
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
};

const formatStock = (qty1: number, qty2: number) => {
  const q1 = Number(qty1 || 0);
  const q2 = Number(qty2 || 0);

  if (q1 > 0 && q2 > 0) {
    return `${qty(q1)}+${qty(q2)}`;
  }

  if (q1 > 0) {
    return qty(q1);
  }

  if (q2 > 0) {
    return `0+${qty(q2)}`;
  }

  return "0";
};

const inputClass =
  "w-full rounded-md border border-blue-400 bg-white px-3 py-2.5 font-semibold text-gray-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200";

const apiErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

const STOCK_BATCH_SIZE = 10;

const CompaniesPage = forwardRef<CompaniesPageHandle, CompaniesPageProps>(function CompaniesPage({
  compactTop = false,
  onEditRack,
  canUpdateCompany = true,
  canUpdateRack = true,
  focusItemId = null,
  focusRequestKey = 0,
}: CompaniesPageProps, ref) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const companyListRef = useRef<HTMLElement>(null);
  const companyDetailRef = useRef<HTMLDivElement>(null);
  const companyFooterRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [currentStock, setCurrentStock] = useState<Record<number, CurrentStock>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockUnavailableCount, setStockUnavailableCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [compName, setCompName] = useState("");
  const [compShort, setCompShort] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  /*
   * Incremented whenever another company is opened or the selected
   * company is closed. This prevents stock responses from an older
   * request being applied to a newly selected company.
   */
  const stockRequestKeyRef = useRef(0);
  const itemButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    if (!selected) return;
    const detail = companyDetailRef.current;
    const footer = compactTop
      ? document.getElementById("customer-portal-footer")
      : companyFooterRef.current;
    if (!detail || !footer) return;
    const updateHeight = () => {
      // Use the visible viewport so the list also fits above a mobile keyboard.
      const viewport = window.visualViewport;
      const bottom = Math.min(
        footer.getBoundingClientRect().top,
        viewport ? viewport.offsetTop + viewport.height : window.innerHeight,
      );
      detail.style.height = `${Math.max(0, Math.floor(bottom - detail.getBoundingClientRect().top - 8))}px`;
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("scroll", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("scroll", updateHeight);
    };
  }, [compactTop, selected]);

  useLayoutEffect(() => {
    if (!compactTop || selected) return;
    const updateHeight = () => {
      const list = companyListRef.current;
      const footer = document.getElementById("customer-portal-footer");
      if (!list || !footer) return;
      list.style.height = `${Math.max(120, Math.floor(footer.getBoundingClientRect().top - list.getBoundingClientRect().top - 8))}px`;
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [compactTop, selected, loading, message]);

  /*
   * When control returns from Update Rack, keep the Company detail/list
   * exactly where it was, then scroll/focus the same item row.
   */
  useEffect(() => {
    if (!selected || !focusItemId || focusRequestKey <= 0) return;

    const timer = window.setTimeout(() => {
      const button = itemButtonRefs.current[focusItemId];
      if (!button) return;

      button.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      button.focus({ preventScroll: true });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [focusItemId, focusRequestKey, selected]);

  const loadCompanies = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await API.get("/mobile/companies");
      setCompanies(
        Array.isArray(res.data?.companies) ? res.data.companies : [],
      );
    } catch (error: unknown) {
      setMessage(apiErrorMessage(error, "Unable to load companies."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  /*
   * Load true current/closing stock from the existing stock controller.
   *
   * We deliberately do not use StockQty1 / StockQty2 returned by the
   * mobile company-items endpoint, because those values can represent
   * the stock opening snapshot (nstkopbal).
   *
   * /mobile/stock/current/:itemId uses GetCurrentStockHandler and the existing
   * stock-statement/closing-stock calculation already used by the web app.
   *
   * Requests are sent in small batches so a company with hundreds of
   * items does not create one large simultaneous burst of HTTP requests.
   */
  const loadCurrentStockForItems = async (
    companyItems: CompanyItem[],
    requestKey: number,
  ) => {
    if (companyItems.length === 0) {
      setLoadingStock(false);
      return;
    }

    setLoadingStock(true);

    try {
      for (
        let start = 0;
        start < companyItems.length;
        start += STOCK_BATCH_SIZE
      ) {
        if (stockRequestKeyRef.current !== requestKey) return;

        const batch = companyItems.slice(
          start,
          start + STOCK_BATCH_SIZE,
        );

        const results = await Promise.all(
          batch.map(async (item) => {
            try {
              let res;
              try {
                res = await API.get<CurrentStock>(`/mobile/stock/current/${item.id}`);
              } catch (error: unknown) {
                const status = (error as { response?: { status?: number } })?.response?.status;
                if (status !== 404) throw error;
                res = await API.get<CurrentStock>(`/stock/current/${item.id}`);
              }

              if (!Number.isFinite(Number(res.data?.ClosingQty1)) ||
                  !Number.isFinite(Number(res.data?.ClosingQty2))) {
                throw new Error("Invalid current stock response");
              }

              return {
                id: item.id,
                stock: {
                  ClosingQty1: Number(
                    res.data?.ClosingQty1 ?? 0,
                  ),
                  ClosingQty2: Number(
                    res.data?.ClosingQty2 ?? 0,
                  ),
                  StringClosing:
                    res.data?.StringClosing ?? "",
                } satisfies CurrentStock,
              };
            } catch {
              return {
                id: item.id,
                stock: {
                  ClosingQty1: 0,
                  ClosingQty2: 0,
                  StringClosing: "",
                } satisfies CurrentStock,
                failed: true,
              };
            }
          }),
        );

        if (stockRequestKeyRef.current !== requestKey) return;

        setStockUnavailableCount((count) =>
          count + results.filter((result) => result.failed).length,
        );

        setCurrentStock((current) => {
          const next = { ...current };

          for (const result of results) {
            /*
             * Do not substitute the old opening-stock fields on failure.
             * A failed stock request is represented by absence in the map,
             * so the UI shows "Stock: --".
             */
            if (!result.failed) {
              next[result.id] = result.stock;
            }
          }

          return next;
        });
      }
    } finally {
      if (stockRequestKeyRef.current === requestKey) {
        setLoadingStock(false);
      }
    }
  };

  const openCompany = async (company: CompanyRow) => {
    const requestKey = ++stockRequestKeyRef.current;

    setLoadingItems(true);
    setLoadingStock(false);
    setMessage("");
    setItemSearch("");
    setCurrentStock({});
    setStockUnavailableCount(0);

    try {
      const res = await API.get(
        `/mobile/companies/${company.id}/items`,
      );

      const c = res.data?.company as CompanyDetail;
      const companyItems: CompanyItem[] = Array.isArray(
        res.data?.items,
      )
        ? res.data.items
        : [];

      setSelected(c);
      setCompName(c?.CompName ?? "");
      setCompShort(c?.CompShort ?? "");
      setItems(companyItems);

      /*
       * Start closing-stock loading only after company items are known.
       * Do not await it here; allow the item list to render immediately
       * while stock values are progressively filled.
       */
      void loadCurrentStockForItems(companyItems, requestKey);
    } catch (error: unknown) {
      setMessage(apiErrorMessage(error, "Unable to load company items."));
    } finally {
      setLoadingItems(false);
    }
  };

  const closeCompany = useCallback(() => {
    stockRequestKeyRef.current += 1;
    setSelected(null);
    setItems([]);
    setCurrentStock({});
    setStockUnavailableCount(0);
    setItemSearch("");
    setLoadingStock(false);
    setMessage("");
  }, []);

  useImperativeHandle(ref, () => ({
    backToCompaniesList: () => {
      if (!selected) return false;
      closeCompany();
      return true;
    },
  }), [selected, closeCompany]);

  const hasChange =
    !!selected &&
    (compName.trim() !== selected.CompName.trim() ||
      compShort.trim() !== selected.CompShort.trim());

  const saveCompany = async () => {
    if (!selected || !hasChange || !canUpdateCompany) return;

    setSaving(true);
    setMessage("");

    try {
      await API.put(`/mobile/companies/${selected.id}`, {
        CompName: compName.trim(),
        CompShort: compShort.trim(),
      });

      setSelected({
        ...selected,
        CompName: compName.trim(),
        CompShort: compShort.trim(),
      });

      setCompanies((current) =>
        current
          .map((c) =>
            c.id === selected.id
              ? {
                  ...c,
                  CompName: compName.trim(),
                  CompShort: compShort.trim(),
                }
              : c,
          )
          .sort((a, b) =>
            a.CompName.localeCompare(b.CompName),
          ),
      );

      setMessage("Company updated successfully.");
    } catch (error: unknown) {
      setMessage(apiErrorMessage(error, "Unable to update company."));
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const result: Array<{
      letter: string;
      rows: CompanyRow[];
    }> = [];

    for (const c of companies) {
      const letter = (
        c.CompName.trim()[0] || "#"
      ).toUpperCase();

      const last = result[result.length - 1];

      if (!last || last.letter !== letter) {
        result.push({
          letter,
          rows: [c],
        });
      } else {
        last.rows.push(c);
      }
    }

    return result;
  }, [companies]);

  const filteredItems = useMemo(
    () => searchCompanyItems(items, itemSearch),
    [items, itemSearch],
  );

  if (selected) {
    return (
      <div ref={companyDetailRef} className={`mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-3 px-3 sm:px-4 ${compactTop ? "pt-1" : "pt-4"}`}>
        <section className="shrink-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
          <div className="p-3 sm:p-4">
            {canUpdateCompany ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <FloatingLabelInput
              id="mobileCompName"
              label="Company Name"
              value={compName}
              onChange={(e) => { setCompName(e.target.value); setMessage(""); }}
              className={inputClass}
              labelBgClassName="bg-white"
            />

            <FloatingLabelInput
              id="mobileCompShort"
              label="Short Name"
              value={compShort}
              onChange={(e) => { setCompShort(e.target.value); setMessage(""); }}
              className={inputClass}
              labelBgClassName="bg-white"
            />
            </div> : <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="min-w-0">
              <h2 className="break-words font-bold leading-snug text-gray-900">{selected.CompName}</h2>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-800">{selected.CompShort || "-"}</p>
            </div>
            </div>}

            {canUpdateCompany && <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCompName(selected.CompName);
                setCompShort(selected.CompShort);
                setMessage("");
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveCompany}
              disabled={!hasChange || saving}
              className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Updating..." : "Update"}
            </button>
            </div>}

            {message && (
              <div className="mt-3 text-sm font-medium">
                {message}
              </div>
            )}
          </div>

        <div className="border-t border-gray-200">
          <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2">
            <div className="shrink-0 text-sm font-semibold text-gray-700">
              Items: {items.length}
            </div>

            <input
              type="search"
              value={itemSearch}
              onChange={(e) =>
                setItemSearch(e.target.value)
              }
              placeholder="Search items..."
              aria-label="Search items in this company"
              className="ml-auto min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

        </div>
        </section>

        <section
          aria-label="Company items"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-blue-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {loadingStock && (
            <div className="border-b bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Updating current closing stock...
            </div>
          )}

          {stockUnavailableCount > 0 && (
            <div role="status" className="border-b bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
              Current stock is unavailable for {stockUnavailableCount} item(s).
            </div>
          )}

          {itemSearch.trim() && !loadingItems && (
            <div className="border-b bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
              Showing {filteredItems.length} of {items.length}{" "}
              item(s)
            </div>
          )}

          {loadingItems ? (
            <div className="p-4 text-sm">
              Loading items...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No matching items.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const stock = currentStock[item.id];

              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    itemButtonRefs.current[item.id] = element;
                  }}
                  type="button"
                  onClick={() =>
                    canUpdateRack
                      ? onEditRack?.({
                          id: item.id,
                          ItemName: item.ItemName,
                        })
                      : undefined
                  }
                  className={`block w-full border-b border-slate-200 px-3 py-3 text-left transition-colors last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    canUpdateRack ? "hover:bg-blue-100 active:bg-blue-200" : "cursor-default"
                  } ${
                    focusItemId === item.id
                      ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                      : index % 2 === 0
                        ? "bg-white"
                        : "bg-sky-50/70"
                  }`}
                  title={
                    canUpdateRack
                      ? "Open this item in Update Rack"
                      : "View-only access"
                  }
                >
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
                    <div className="pt-0.5 text-sm font-semibold text-gray-500">
                      {index + 1}.
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 font-semibold text-gray-900">
                          {item.ItemName}
                        </div>

                        <div className="shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums text-blue-900">
                          Stock: {stock === undefined
                            ? "--"
                            : formatStock(stock.ClosingQty1, stock.ClosingQty2)}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-gray-600">
                        <span>{item.Packing}</span>
                        <span>
                          Rack: {item.RackNumber?.trim() || "-"}
                        </span>

                        <span>
                          PTR: {money(item.PTR)}
                        </span>

                        <span>
                          MRP: {money(item.MRP)}
                        </span>

                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>
        {!compactTop && <footer ref={companyFooterRef} className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <button type="button" onClick={closeCompany} className="min-h-11 rounded-lg px-4 font-semibold text-blue-700 hover:bg-blue-50">← Back</button>
          </div>
        </footer>}
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-3xl px-3 pb-4 sm:px-4 ${compactTop ? "pt-1" : "pt-4"}`}>
      {message && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section ref={companyListRef} className="overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_4rem_4.25rem] gap-2 border-b bg-blue-50 px-3 py-2 text-xs font-bold uppercase text-blue-900">
          <span>Company Name</span>
          <span className="text-right">Short</span>
          <span className="text-right">Items</span>
        </div>

        {loading ? (
          <div className="p-4 text-sm">
            Loading companies...
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.letter}>
              <div className="bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                {group.letter}
              </div>

              {group.rows.map((company, companyIndex) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() =>
                    void openCompany(company)
                  }
                  className={`grid w-full grid-cols-[minmax(0,1fr)_4rem_4.25rem] gap-2 border-b border-slate-200 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    companyIndex % 2 === 0 ? "bg-white" : "bg-sky-50/70"
                  }`}
                >
                  <span className="min-w-0 font-semibold text-gray-900">
                    {company.CompName}
                  </span>

                  <span className="text-right text-sm text-gray-600">
                    {company.CompShort}
                  </span>

                  <span className="text-right font-bold tabular-nums text-blue-800">
                    {company.ItemCount}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
});

export default CompaniesPage;
