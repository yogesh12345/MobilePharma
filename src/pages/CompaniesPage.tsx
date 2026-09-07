import { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";

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

  // These may still be returned by /mobile/companies/:id/items,
  // but they are intentionally NOT used for current stock display.
  StockQty1?: number;
  StockQty2?: number;
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
  onEditRack?: (item: { id: number; ItemName: string }) => void;
  focusItemId?: number | null;
  focusRequestKey?: number;
}

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

const STOCK_BATCH_SIZE = 10;

export default function CompaniesPage({
  onEditRack,
  focusItemId = null,
  focusRequestKey = 0,
}: CompaniesPageProps) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [currentStock, setCurrentStock] = useState<Record<number, CurrentStock>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
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
    } catch (e: any) {
      setMessage(
        e?.response?.data?.error || "Unable to load companies.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  /*
   * Load true CURRENT/CLOSING stock from the existing stock controller.
   *
   * We deliberately do not use StockQty1 / StockQty2 returned by the
   * mobile company-items endpoint, because those values can represent
   * the stock opening snapshot (nstkopbal).
   *
   * /stock/current/:itemId uses GetCurrentStockHandler and the existing
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
              const res = await API.get<CurrentStock>(
                `/stock/current/${item.id}`,
              );

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
    } catch (e: any) {
      setMessage(
        e?.response?.data?.error ||
          "Unable to load company items.",
      );
    } finally {
      setLoadingItems(false);
    }
  };

  const closeCompany = () => {
    stockRequestKeyRef.current += 1;
    setSelected(null);
    setItems([]);
    setCurrentStock({});
    setItemSearch("");
    setLoadingStock(false);
    setMessage("");
  };

  const hasChange =
    !!selected &&
    (compName.trim() !== selected.CompName.trim() ||
      compShort.trim() !== selected.CompShort.trim());

  const saveCompany = async () => {
    if (!selected || !hasChange) return;

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
    } catch (e: any) {
      setMessage(
        e?.response?.data?.error ||
          "Unable to update company.",
      );
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

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) =>
      `${item.ItemName} ${item.Packing}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, itemSearch]);

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <button
          type="button"
          onClick={closeCompany}
          className="mb-3 text-sm font-semibold text-blue-700"
        >
          ← Companies
        </button>

        <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-5">
            <FloatingLabelInput
              id="mobileCompName"
              label="Company Name"
              value={compName}
              onChange={(e) => {
                setCompName(e.target.value);
                setMessage("");
              }}
              className={inputClass}
              labelBgClassName="bg-white"
            />

            <FloatingLabelInput
              id="mobileCompShort"
              label="Short Name"
              value={compShort}
              onChange={(e) => {
                setCompShort(e.target.value);
                setMessage("");
              }}
              className={inputClass}
              labelBgClassName="bg-white"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
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
          </div>

          {message && (
            <div className="mt-3 text-sm font-medium">
              {message}
            </div>
          )}
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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

          {loadingStock && (
            <div className="border-b bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Updating current closing stock...
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
                    onEditRack?.({
                      id: item.id,
                      ItemName: item.ItemName,
                    })
                  }
                  className={`block w-full border-b border-slate-200 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-blue-100 active:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    focusItemId === item.id
                      ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                      : index % 2 === 0
                        ? "bg-white"
                        : "bg-sky-50/70"
                  }`}
                  title="Open this item in Update Rack"
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

                        <div className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-700">
                          {item.Packing}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-x-4 text-xs font-medium text-gray-600">
                        <span>
                          Rack: {item.RackNumber?.trim() || "-"}
                        </span>

                        <span>
                          PTR: {money(item.PTR)}
                        </span>

                        <span>
                          MRP: {money(item.MRP)}
                        </span>

                        <span className="ml-auto whitespace-nowrap text-right">
                          Stock:{" "}
                          {stock === undefined
                            ? "--"
                            : formatStock(stock.ClosingQty1, stock.ClosingQty2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
      {message && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_4rem_4.25rem] gap-2 border-b bg-blue-50 px-3 py-2 text-xs font-bold uppercase text-blue-900">
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
}
